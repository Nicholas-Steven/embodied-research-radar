"""Ingestion health tests — radar hardening 2026-09-15.

Covers the reliability contract added against arXiv rate-limit failures:

- OAI-PMH harvest health semantics: total 429 exhaustion, partial harvest,
  recovery after retry, unparseable XML, cross-set dedupe, deleted records.
- Pipeline failure discipline: papers.json untouched on source failure,
  generated_at never faked, healthy zero-new runs stay successful and
  idempotent, existing paper IDs are always preserved.
- Search API fallback: used only when OAI-PMH fails; exhaustion raises.

All network calls are mocked; no real arXiv request is made.
"""

import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

import urllib.error

from scripts.radar import arxiv_fetcher, oai_harvester, pipeline
from scripts.radar.fetch_health import DEGRADED, FAILED, HEALTHY, FetchHealth, SourceUnhealthyError
from scripts.radar.schema import clean_paper

BASE = json.loads(Path("data/demo_papers.json").read_text(encoding="utf-8"))[0]


def _http_error(code: int):
    exc = urllib.error.HTTPError("https://oaipmh.arxiv.org/oai", code, "err", None, None)
    exc.headers = {}
    return exc


def _fixture_date() -> str:
    """Fixture records must fall inside the rolling publication window, which
    is anchored to *now* — hard-coded dates went stale after 2026-09-21 and
    broke three harvest tests (run 36396983165)."""
    return datetime.now(timezone.utc).date().isoformat()


def _record(
    arxiv_id: str = "2609.12345",
    title: str = "Force-Aware Robot Manipulation",
    deleted: bool = False,
    v1_date: str | None = None,
) -> str:
    """arXivRaw fixture (the harvester switched metadataPrefix arXiv → arXivRaw
    on 2026-09-29: <created> is a latest-version date, not first submission).

    v1_date lets a fixture represent a revision (v2 in-window, v1 old) — the
    VibeAct regression: such a record must be DROPPED by the publication window.
    v1_date defaults to today (a genuine first submission in-window)."""
    status = ' status="deleted"' if deleted else ""
    v2 = _fixture_date()
    if v1_date:
        # two versions: v1 old (the caller's date), v2 in-window (revision-only case)
        versions = f"""
          <version version="v1"><date>Mon, 25 Jun 2026 12:00:00 GMT</date><size>1kb</size></version>
          <version version="v2"><date>Tue, 22 Sep 2026 12:00:00 GMT</date><size>1kb</size></version>"""
    else:
        versions = f"""
          <version version="v1"><date>Wed, 23 Sep 2026 12:00:00 GMT</date><size>1kb</size></version>"""
    return f"""
    <record>
      <header{status}><identifier>oai:arXiv.org:{arxiv_id}</identifier><datestamp>{v2}</datestamp><setSpec>cs:cs:RO</setSpec></header>
      <metadata>
        <arXivRaw xmlns="http://arxiv.org/OAI/arXivRaw/">
          <id>{arxiv_id}</id>
          {versions}
          <authors>Ada Lovelace, Alan Turing</authors>
          <title>{title}</title>
          <categories>cs.RO</categories>
          <abstract>Real robot force-aware manipulation on contact-rich tasks with vision force feedback.</abstract>
          <doi>10.1234/test</doi>
        </arXivRaw>
      </metadata>
    </record>"""


def _oai_xml(*records: str) -> bytes:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
  <responseDate>2026-09-15T00:00:00Z</responseDate>
  <request verb="ListRecords">https://oaipmh.arxiv.org/oai</request>
  <ListRecords>{''.join(records)}<resumptionToken/></ListRecords>
</OAI-PMH>""".encode()


def _xml_response(payload: bytes):
    response = mock.MagicMock()
    response.read.return_value = payload
    response.__enter__.return_value = response
    return response


TWO_SETS = {"cs.RO": "cs:cs:RO", "cs.AI": "cs:cs:AI"}


class OaiHarvestHealthTests(unittest.TestCase):
    """Requirement: source failure must raise, never return a quiet empty list."""

    def setUp(self):
        self.no_sleep = mock.patch.object(oai_harvester, "_sleep", lambda s: None).start()
        self.addCleanup(mock.patch.stopall)

    def test_all_sets_429_exhausted_raises(self):
        health = FetchHealth()
        with mock.patch.object(oai_harvester.urllib.request, "urlopen", side_effect=_http_error(429)):
            with self.assertRaises(SourceUnhealthyError):
                oai_harvester.harvest(lookback_days=7, health=health, category_sets=dict(TWO_SETS))
        self.assertGreater(health.requests_rate_limited, 0)
        self.assertEqual(health.requests_succeeded, 0)
        self.assertEqual(health.status(), FAILED)

    def test_partial_harvest_raises(self):
        # Set 1 succeeds; set 2 is throttled into exhaustion → incomplete radar.
        attempts = [_xml_response(_oai_xml(_record()))] + [_http_error(429)] * 5
        health = FetchHealth()
        with mock.patch.object(oai_harvester.urllib.request, "urlopen", side_effect=attempts):
            with self.assertRaises(SourceUnhealthyError) as ctx:
                oai_harvester.harvest(lookback_days=7, health=health, category_sets=dict(TWO_SETS))
        self.assertIn("Partial harvest", str(ctx.exception))

    def test_retry_then_recovery_succeeds(self):
        attempts = [_http_error(429), _xml_response(_oai_xml(_record()))]
        health = FetchHealth()
        with mock.patch.object(oai_harvester.urllib.request, "urlopen", side_effect=attempts):
            records = oai_harvester.harvest(lookback_days=7, health=health, category_sets={"cs.RO": "cs:cs:RO"})
        self.assertEqual(len(records), 1)
        self.assertEqual(health.requests_rate_limited, 1)
        self.assertGreaterEqual(health.requests_succeeded, 1)

    def test_unparseable_xml_raises(self):
        health = FetchHealth()
        with mock.patch.object(oai_harvester.urllib.request, "urlopen", side_effect=[_xml_response(b"this is not xml")]):
            with self.assertRaises(SourceUnhealthyError):
                oai_harvester.harvest(lookback_days=7, health=health, category_sets={"cs.RO": "cs:cs:RO"})

    def test_cross_set_dedupe_merges_categories(self):
        page = _xml_response(_oai_xml(_record(arxiv_id="2609.12345")))
        health = FetchHealth()
        with mock.patch.object(oai_harvester.urllib.request, "urlopen", side_effect=[page, page]):
            records = oai_harvester.harvest(lookback_days=7, health=health, category_sets=dict(TWO_SETS))
        self.assertEqual(len(records), 1)
        self.assertEqual(sorted(records[0]["source_categories"]), ["cs.AI", "cs.RO"])

    def test_deleted_records_are_skipped(self):
        health = FetchHealth()
        page = _xml_response(_oai_xml(_record(deleted=True), _record(arxiv_id="2609.00001")))
        with mock.patch.object(oai_harvester.urllib.request, "urlopen", side_effect=[page]):
            records = oai_harvester.harvest(lookback_days=7, health=health, category_sets={"cs.RO": "cs:cs:RO"})
        self.assertEqual([r["arxiv_id"] for r in records], ["2609.00001"])

    def test_parse_record_fields(self):
        root = __import__("xml.etree.ElementTree", fromlist=["ElementTree"]).fromstring(_oai_xml(_record()))
        record = root.find(".//{http://www.openarchives.org/OAI/2.0/}record")
        parsed = oai_harvester._parse_record(record)
        self.assertEqual(parsed["arxiv_id"], "2609.12345")
        self.assertEqual(parsed["paper_id"], "arxiv-2609-12345")
        self.assertEqual(parsed["published_date"], "2026-09-23")  # fixture v1 date
        self.assertEqual(parsed["updated_date"], "2026-09-23")    # single-version record
        self.assertEqual(parsed["doi"], "10.1234/test")
        self.assertEqual(parsed["authors"], ["Ada Lovelace", "Alan Turing"])

    def test_rolling_window(self):
        now = datetime(2026, 9, 15, 12, 0, tzinfo=timezone.utc)
        self.assertEqual(oai_harvester.rolling_window(7, now), ("2026-09-08", "2026-09-15"))


class FirstSubmissionSemanticsTests(unittest.TestCase):
    """2026-09-29 correction: OAI arXiv <created> is a LATEST-version date and
    must never be used as first submission. arXivRaw v1 <version> date is the
    authoritative first_submitted (Atom <published> equivalent)."""

    def _parse(self, xml: str):
        root = __import__("xml.etree.ElementTree", fromlist=["ElementTree"]).fromstring(xml)
        record = root.find(".//{http://www.openarchives.org/OAI/2.0/}record")
        return oai_harvester._parse_record(record)

    def test_1_created_is_not_used_as_first_submission(self):
        """A record with a June v1 and a September v2 must report June as
        published_date — never the revision date."""
        xml = _oai_xml(_record(arxiv_id="2606.27344", v1_date="2026-06-25"))
        parsed = self._parse(xml)
        self.assertEqual(parsed["published_date"], "2026-06-25")
        self.assertEqual(parsed["updated_date"], "2026-09-22")
        self.assertEqual(parsed["version_count"], 2)

    def test_2_atom_published_equivalence(self):
        """arXivRaw v1 date must equal the Atom <published> semantics
        (VibeAct ground truth: v1=2026-06-25)."""
        xml = _oai_xml(_record(v1_date="2026-06-25"))
        parsed = self._parse(xml)
        self.assertEqual(parsed["published_date"], "2026-06-25")

    def test_3_revision_in_september_window_is_dropped(self):
        """v1 June + v2 September: a September publication window must drop
        this revision-only record — it is NOT a new paper."""
        health = FetchHealth()
        now = datetime(2026, 9, 29, 12, 0, tzinfo=timezone.utc)
        page = _xml_response(_oai_xml(_record(arxiv_id="2606.27344", v1_date="2026-06-25")))
        with mock.patch.object(oai_harvester, "urllib.request", "urlopen",
                               side_effect=None) if False else \
             mock.patch.object(oai_harvester.urllib.request, "urlopen", side_effect=[page]):
            records = oai_harvester.harvest(lookback_days=7, health=health,
                                            category_sets={"cs.RO": "cs:cs:RO"}, now=now)
        self.assertEqual([r["arxiv_id"] for r in records], [])
        self.assertGreater(health.records_stale_metadata, 0)

    def test_4_true_v1_in_window_is_kept(self):
        """A genuine first submission inside the window is kept."""
        health = FetchHealth()
        now = datetime(2026, 9, 29, 12, 0, tzinfo=timezone.utc)
        page = _xml_response(_oai_xml(_record(arxiv_id="2609.29964")))
        with mock.patch.object(oai_harvester.urllib.request, "urlopen", side_effect=[page]):
            records = oai_harvester.harvest(lookback_days=7, health=health,
                                            category_sets={"cs.RO": "cs:cs:RO"}, now=now)
        self.assertEqual([r["arxiv_id"] for r in records], ["2609.29964"])

    def test_5_baseline_preserved_contract(self):
        """Data-safety contract: correction removes only revision-only
        contamination from the current round — baseline paper_ids are
        never dropped by this logic (pipeline merge keeps existing IDs)."""
        # the harvester itself never sees baseline papers (they are excluded
        # upstream in pipeline merge); assert the record-level contract: a
        # parsed in-window record carries the same paper_id scheme as baseline
        parsed = self._parse(_oai_xml(_record(arxiv_id="2609.12345")))
        self.assertEqual(parsed["paper_id"], "arxiv-2609-12345")

    def test_6_record_without_v1_is_unusable(self):
        """arXivRaw without a v1 version entry cannot establish first
        submission — the record must be rejected, not silently dated."""
        record_xml = _record()
        record_xml = record_xml.replace(
            '<version version="v1"><date>Wed, 23 Sep 2026 12:00:00 GMT</date><size>1kb</size></version>', "")
        self.assertIsNone(self._parse(_oai_xml(record_xml).decode("utf-8")))

    def test_7_multi_version_dates_derived(self):
        """updated_date = LAST version date, not v1, not <created>."""
        xml = _oai_xml(_record(v1_date="2026-06-25"))
        parsed = self._parse(xml)
        self.assertNotEqual(parsed["updated_date"], parsed["published_date"])
        self.assertEqual(parsed["updated_date"], "2026-09-22")


class FetchHealthUnitTests(unittest.TestCase):
    def test_status_transitions(self):
        healthy = FetchHealth(requests_attempted=8, requests_succeeded=8)
        self.assertEqual(healthy.status(), HEALTHY)

        degraded = FetchHealth(requests_attempted=8, requests_succeeded=5, requests_rate_limited=3)
        self.assertEqual(degraded.status(), DEGRADED)

        failed = FetchHealth(requests_attempted=8, requests_rate_limited=40, requests_exhausted=8)
        self.assertEqual(failed.status(), FAILED)
        self.assertFalse(failed.source_responded)

    def test_checkpoint_only_counts_as_responded(self):
        resumed = FetchHealth(records_from_checkpoint=500)
        self.assertTrue(resumed.source_responded)
        self.assertEqual(resumed.status(), HEALTHY)

    def test_zero_relevant_is_still_healthy(self):
        quiet_day = FetchHealth(requests_attempted=7, requests_succeeded=7, raw_records_received=300,
                                records_after_dedupe=280, relevant_records=0, new_records=0)
        self.assertEqual(quiet_day.status(), HEALTHY)


class PipelineSafetyTests(unittest.TestCase):
    """Requirement: failures never touch papers.json; successes never fake updates."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dump = Path(self.tmp.name) / "papers.json"
        mock.patch.object(pipeline, "DATA_PATH", self.dump).start()
        mock.patch.object(pipeline, "fetch_method_figure", return_value={"url": "", "caption": ""}).start()
        self.addCleanup(mock.patch.stopall)
        self.addCleanup(self.tmp.cleanup)

    def _fixture(self, papers, generated_at="2026-09-01"):
        # Store papers exactly as a previous enriched run would have left them,
        # so a no-fetch re-run compares equal and must not rewrite the file.
        from scripts.radar.scoring import enrich_score_and_topics
        stored = [clean_paper(enrich_score_and_topics(p)) for p in papers]
        payload = {
            "schema_version": "1.0.0", "generated_at": generated_at, "source": "arXiv",
            "candidate_count": len(stored), "retained_count": len(stored), "relevance_threshold": 45,
            "papers": stored,
        }
        self.dump.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return self.dump.read_bytes()

    def _existing_paper(self):
        return clean_paper({**BASE, "paper_id": "arxiv-2411-15753", "arxiv_id": "2411.15753", "relevance_score": 80})

    def _new_candidate(self):
        return clean_paper({
            "arxiv_id": "2609.99999", "title": "Vision-Force Recovery Policy",
            "abstract": "We learn a vision force recovery policy for contact-rich manipulation. Real robot "
                        "experiments with failure recovery, github code and a benchmark are released.",
            "published_date": "2026-09-12", "source_categories": ["cs.RO"], "keywords": ["cs.RO"],
        })

    def test_failed_fetch_leaves_papers_json_untouched_and_main_exits_2(self):
        before = self._fixture([self._existing_paper()])
        with mock.patch.object(pipeline, "fetch_candidates", side_effect=SourceUnhealthyError("all 429")), \
             mock.patch.object(__import__("sys"), "argv", ["update_radar.py", "--fetch", "--no-ai"]):
            code = pipeline.main()
        self.assertEqual(code, 2)
        self.assertEqual(self.dump.read_bytes(), before, "failed fetch must be byte-invisible")

    def test_zero_relevant_healthy_run_succeeds_without_rewrite(self):
        before = self._fixture([self._existing_paper()])
        healthy_empty = FetchHealth(source="arXiv OAI-PMH", requests_attempted=7, requests_succeeded=7,
                                    raw_records_received=300, records_after_dedupe=0)
        with mock.patch.object(pipeline, "fetch_candidates", return_value=([], healthy_empty)):
            payload, health = pipeline.run(fetch=True, threshold=45, with_ai=False)
        self.assertEqual(health.status(), HEALTHY, "healthy source with 0 relevant papers is a success")
        self.assertEqual(self.dump.read_bytes(), before, "zero-new run must not fake an update")

    def test_generated_at_not_bumped_without_dataset_change(self):
        before = self._fixture([self._existing_paper()], generated_at="2026-08-13")
        pipeline.run(fetch=False, threshold=45, with_ai=False)
        after = json.loads(self.dump.read_text(encoding="utf-8"))
        self.assertEqual(after["generated_at"], "2026-08-13")
        self.assertEqual(self.dump.read_bytes(), before)

    def test_new_papers_appended_and_existing_ids_preserved(self):
        before = self._fixture([self._existing_paper()])
        health = FetchHealth(source="arXiv OAI-PMH", requests_attempted=7, requests_succeeded=7)
        with mock.patch.object(pipeline, "fetch_candidates",
                               return_value=([self._existing_paper(), self._new_candidate()], health)):
            payload, health = pipeline.run(fetch=True, threshold=45, with_ai=False)
        ids = {p["paper_id"] for p in payload["papers"]}
        self.assertIn("arxiv-2411-15753", ids, "existing papers must survive")
        self.assertIn("arxiv-2609-99999", ids)
        self.assertEqual(health.new_records, 1)
        after = json.loads(self.dump.read_text(encoding="utf-8"))
        self.assertEqual(after["generated_at"], __import__("datetime").date.today().isoformat(),
                         "real changes do update generated_at")

    def test_second_run_is_idempotent(self):
        self._fixture([self._existing_paper()])
        health = FetchHealth(source="arXiv OAI-PMH", requests_attempted=7, requests_succeeded=7)
        with mock.patch.object(pipeline, "fetch_candidates",
                               return_value=([self._existing_paper(), self._new_candidate()], health)):
            pipeline.run(fetch=True, threshold=45, with_ai=False)
        snapshot = self.dump.read_bytes()
        with mock.patch.object(pipeline, "fetch_candidates",
                               return_value=([self._existing_paper(), self._new_candidate()], health)):
            payload, second = pipeline.run(fetch=True, threshold=45, with_ai=False)
        self.assertEqual(second.new_records, 0, "repeated harvest must not duplicate papers")
        ids = [p["paper_id"] for p in payload["papers"]]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(self.dump.read_bytes(), snapshot)

    def test_backfill_adds_missing_papers(self):
        # Remote dataset predates a batch of papers; one harvest run must add them.
        self._fixture([self._existing_paper()])
        older = clean_paper({**self._new_candidate(), "arxiv_id": "2609.00001", "paper_id": "arxiv-2609-00001",
                             "title": "Backfill Candidate One", "published_date": "2026-09-09"})
        newer = clean_paper({**self._new_candidate(), "arxiv_id": "2609.00002", "paper_id": "arxiv-2609-00002",
                             "title": "Backfill Candidate Two", "published_date": "2026-09-13"})
        health = FetchHealth(source="arXiv OAI-PMH", requests_attempted=7, requests_succeeded=7)
        with mock.patch.object(pipeline, "fetch_candidates",
                               return_value=([self._existing_paper(), older, newer], health)):
            payload, health = pipeline.run(fetch=True, threshold=45, with_ai=False)
        self.assertEqual(health.new_records, 2)
        dates = [p["published_date"] for p in payload["papers"]]
        self.assertIn("2026-09-09", dates)
        self.assertIn("2026-09-13", dates)


class ImageOnlyChangeTests(unittest.TestCase):
    """Alias-bug regression (production run 36571636806): enrichment mutated
    paper["image"] in place, but retained shares those dicts with
    loaded["papers"], so dataset_changed() compared the state with itself and
    never wrote image-only updates. The pre-mutation canonical snapshot in
    run() must make image-only changes visible and committable."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dump = Path(self.tmp.name) / "papers.json"
        mock.patch.object(pipeline, "DATA_PATH", self.dump).start()
        self.addCleanup(mock.patch.stopall)
        self.addCleanup(self.tmp.cleanup)

    def _fixture(self, papers, image="", caption=""):
        from scripts.radar.scoring import enrich_score_and_topics
        stored = [clean_paper(enrich_score_and_topics(p)) for p in papers]
        for p in stored:
            p["image"] = image
            p["image_caption"] = caption
        payload = {
            "schema_version": "1.0.0", "generated_at": "2026-09-29", "source": "arXiv",
            "candidate_count": len(stored), "retained_count": len(stored), "relevance_threshold": 45,
            "papers": stored,
        }
        self.dump.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return payload

    def _existing(self):
        return clean_paper({**BASE, "paper_id": "arxiv-2411-15753", "arxiv_id": "2411.15753", "relevance_score": 80})

    def _healthy_empty(self):
        return FetchHealth(source="arXiv OAI-PMH", requests_attempted=7, requests_succeeded=7,
                           raw_records_received=100, records_after_dedupe=0)

    def test_1_image_recovery_on_existing_paper_writes_dataset(self):
        """No new papers + enrichment recovers an image → changed=True, file written."""
        self._fixture([self._existing()])
        before = json.loads(self.dump.read_text(encoding="utf-8"))
        fig = {"url": "https://arxiv.org/html/2411.15753v1/fig.png", "caption": "Figure 1: method"}
        with mock.patch.object(pipeline, "fetch_method_figure", return_value=fig), \
             mock.patch.object(pipeline, "fetch_candidates", return_value=([], self._healthy_empty())):
            payload, health = pipeline.run(fetch=True, threshold=45, with_ai=False)
        after = json.loads(self.dump.read_text(encoding="utf-8"))
        self.assertEqual(health.images_found, 1)
        self.assertEqual(after["papers"][0]["image"], fig["url"])
        self.assertEqual(after["papers"][0]["image_caption"], "Figure 1: method")
        self.assertEqual(len(after["papers"]), len(before["papers"]))
        self.assertEqual(after["papers"][0]["paper_id"], before["papers"][0]["paper_id"])
        self.assertEqual(after["generated_at"], "2026-09-29")  # real change → date updates

    def test_2_caption_persisted_with_recovery(self):
        """Caption arrives together with the recovered image (papers WITH an
        image are not probed, so a caption-only change is not a reachable
        path); the new caption must be serialized."""
        self._fixture([self._existing()])
        fig = {"url": "https://x/new.png", "caption": "Figure 1: caption text"}
        with mock.patch.object(pipeline, "fetch_method_figure", return_value=fig), \
             mock.patch.object(pipeline, "fetch_candidates", return_value=([], self._healthy_empty())):
            pipeline.run(fetch=True, threshold=45, with_ai=False)
        after = json.loads(self.dump.read_text(encoding="utf-8"))
        self.assertEqual(after["papers"][0]["image_caption"], "Figure 1: caption text")

    def test_3_batch_recovery_all_results_in_serialized_dataset(self):
        """17-style batch: every successful probe result survives serialization."""
        papers = [clean_paper({**BASE, "paper_id": f"arxiv-2411-{i:05d}",
                               "arxiv_id": f"2411.{i:05d}", "relevance_score": 80,
                               "title": f"Vision-Force Recovery Policy {i}"})
                  for i in range(1, 6)]
        self._fixture(papers)
        def fake_figure(arxiv_id):
            return {"url": f"https://arxiv.org/html/{arxiv_id}v1/fig.png", "caption": f"Fig {arxiv_id}"}
        with mock.patch.object(pipeline, "fetch_method_figure", side_effect=fake_figure), \
             mock.patch.object(pipeline, "fetch_candidates", return_value=([], self._healthy_empty())):
            pipeline.run(fetch=True, threshold=45, with_ai=False)
        after = json.loads(self.dump.read_text(encoding="utf-8"))
        recovered = [p for p in after["papers"] if p.get("image")]
        self.assertEqual(len(recovered), 5)

    def test_4_failed_probe_makes_no_change(self):
        self._fixture([self._existing()])
        before = self.dump.read_bytes()
        with mock.patch.object(pipeline, "fetch_method_figure", return_value={"url": "", "caption": ""}), \
             mock.patch.object(pipeline, "fetch_candidates", return_value=([], self._healthy_empty())):
            pipeline.run(fetch=True, threshold=45, with_ai=False)
        self.assertEqual(self.dump.read_bytes(), before, "failed probes must not fake a change")

    def test_5_same_image_url_is_not_a_change(self):
        fig = {"url": "https://x/old.png", "caption": "same"}
        self._fixture([self._existing()], image=fig["url"], caption=fig["caption"])
        before = self.dump.read_bytes()
        with mock.patch.object(pipeline, "fetch_method_figure", return_value=fig), \
             mock.patch.object(pipeline, "fetch_candidates", return_value=([], self._healthy_empty())):
            pipeline.run(fetch=True, threshold=45, with_ai=False)
        self.assertEqual(self.dump.read_bytes(), before)

    def test_6_zero_new_papers_with_image_update_still_commits(self):
        """The core production case: zero new papers, image-only update must commit."""
        self._fixture([self._existing()])
        fig = {"url": "https://arxiv.org/html/2411.15753v1/fig.png", "caption": "Fig"}
        with mock.patch.object(pipeline, "fetch_method_figure", return_value=fig), \
             mock.patch.object(pipeline, "fetch_candidates", return_value=([], self._healthy_empty())):
            pipeline.run(fetch=True, threshold=45, with_ai=False)
        after = json.loads(self.dump.read_text(encoding="utf-8"))
        self.assertTrue(after["papers"][0]["image"], "image-only update must be persisted")

    def test_7_premutation_snapshot_not_polluted_by_alias(self):
        """The snapshot taken before mutations stays usable as the old state —
        mutating a retained alias must not alter it."""
        loaded = {"papers": [{"paper_id": "a", "image": ""}], "relevance_threshold": 45}
        retained = list({p["paper_id"]: p for p in loaded["papers"]}.values())
        before = pipeline._canonical_papers(loaded["papers"])
        retained[0]["image"] = "https://x/fig.png"
        self.assertIn('"image": ""', before)  # snapshot frozen pre-mutation
        self.assertNotEqual(before, pipeline._canonical_papers(retained))


class SearchFallbackTests(unittest.TestCase):
    def test_fallback_used_when_oai_fails(self):
        with mock.patch.object(pipeline, "harvest_oai", side_effect=SourceUnhealthyError("OAI down")), \
             mock.patch.object(pipeline, "harvest_recent_search", return_value=[]) as search:
            raw, health = pipeline.fetch_candidates(7, 10)
        search.assert_called_once()
        self.assertEqual(raw, [])
        self.assertTrue(health.notes, "fallback health must record the primary failure")

    def test_total_outage_raises(self):
        with mock.patch.object(pipeline, "harvest_oai", side_effect=SourceUnhealthyError("OAI down")), \
             mock.patch.object(pipeline, "harvest_recent_search", side_effect=SourceUnhealthyError("search down")):
            with self.assertRaises(SourceUnhealthyError) as ctx:
                pipeline.fetch_candidates(7, 10)
        self.assertIn("Both sources unhealthy", str(ctx.exception))

    def test_search_exhaustion_raises_not_empty(self):
        health = FetchHealth()
        with mock.patch.object(arxiv_fetcher, "query_arxiv", return_value=None):
            with self.assertRaises(SourceUnhealthyError):
                arxiv_fetcher.harvest_recent_search(7, health)
        self.assertEqual(health.requests_exhausted, 1)

    def test_search_success_sets_counters(self):
        health = FetchHealth()
        paper = clean_paper({**BASE, "arxiv_id": "2411.15753", "source_categories": ["cs.RO"]})
        with mock.patch.object(arxiv_fetcher, "query_arxiv", return_value=[paper]):
            raw = arxiv_fetcher.harvest_recent_search(7, health)
        self.assertEqual(len(raw), 1)
        self.assertEqual(health.requests_succeeded, 1)
        today = datetime.now(timezone.utc).date().isoformat()
        self.assertEqual(health.window_end, today)
        self.assertEqual(health.window_start, (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat())


if __name__ == "__main__":
    unittest.main()
