"""Per-provider health + last-known-good evidence preservation tests.

Contract (2026-09-29, after the silent-[] audit):

- A provider request failure (429, timeout, 5xx, network error, parse error)
  raises ProviderError inside the provider function and must NEVER be
  reported as a genuine zero result.
- Four provider states: success_with_results / success_zero_results /
  failed / not_run.
- When a provider FAILS for a gap, its previous successful evidence is
  preserved (stale_lkg freshness), NOT overwritten with an empty list.
  Only a genuinely successful search — including a true zero — may
  replace previous evidence.
- A round where ALL providers fail raises (workflow-level failure signal);
  partial provider success completes as degraded coverage.

All network calls are mocked; no real provider request is made.
"""

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from scripts.radar import gap_search as gs


def _paper(provider: str, pid: str, title: str = "Force-aware manipulation") -> dict:
    tag = gs.PROVIDER_SOURCE_TAG[provider]
    return {
        "paper_id": f"{provider}-{pid}",
        "title": title,
        "abstract": "real robot force aware manipulation on contact rich tasks",
        "published_date": "2026-09-01",
        "year": 2026,
        "doi": "",
        "arxiv_id": "",
        "source": tag,
        "sources": [tag],
        "url": "",
    }


def _support_paper(provider: str, pid: str) -> dict:
    """A paper whose title/abstract genuinely classifies as SUPPORT for
    learning-from-corrections (matches the gap's human-correction regex).
    Titles embed the pid so 14 papers stay 14 distinct entries after dedupe."""
    p = _paper(provider, pid, title=f"Human correction {pid} for robot failure recovery")
    p["abstract"] = "robot learns from human corrective demonstration after manipulation failure"
    return p


class GapSearchTestBase(unittest.TestCase):
    """Isolate every test from the real cache file and network."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        cache_path = Path(self.tmp.name) / "gap_search_results.json"
        patcher = mock.patch.object(gs, "CACHE_PATH", cache_path)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.cache_path = cache_path
        # kill real sleeps
        sleep_patcher = mock.patch.object(gs.time, "sleep", lambda s: None)
        sleep_patcher.start()
        self.addCleanup(sleep_patcher.stop)

    def seed_cache(self, gaps: dict):
        self.cache_path.write_text(
            json.dumps({"generated_at": "2026-09-21", "gaps": gaps}, ensure_ascii=False),
            encoding="utf-8",
        )


def _ok_searcher(provider: str, count: int):
    def _search(query, limit=20):
        return [_paper(provider, f"{provider}-{i}") for i in range(count)]

    return _search


def _fail_searcher(reason: str):
    def _search(query, limit=20):
        raise gs.ProviderError(reason)

    return _search


class ProviderStateTests(unittest.TestCase):
    def test_state_success_with_results(self):
        self.assertEqual(gs._provider_state(2, 2, 5), (gs.STATUS_SUCCESS_RESULTS, False))

    def test_state_success_zero_results(self):
        self.assertEqual(gs._provider_state(2, 2, 0), (gs.STATUS_SUCCESS_ZERO, False))

    def test_state_failed_when_all_queries_fail(self):
        self.assertEqual(gs._provider_state(3, 0, 0), (gs.STATUS_FAILED, False))

    def test_state_not_run(self):
        self.assertEqual(gs._provider_state(0, 0, 0), (gs.STATUS_NOT_RUN, False))

    def test_state_partial_success_is_degraded(self):
        status, degraded = gs._provider_state(3, 1, 4)
        self.assertEqual(status, gs.STATUS_SUCCESS_RESULTS)
        self.assertTrue(degraded)


class ProviderErrorTests(unittest.TestCase):
    """Provider functions must raise ProviderError — never silently return []."""

    def test_openalex_http_429_raises(self):
        import urllib.error
        err = urllib.error.HTTPError("url", 429, "Too Many Requests", None, None)
        with mock.patch.object(gs.urllib.request, "urlopen", side_effect=err):
            with self.assertRaises(gs.ProviderError) as ctx:
                gs.search_openalex("test query")
        self.assertEqual(ctx.exception.reason, "http_429")

    def test_semantic_scholar_timeout_raises(self):
        with mock.patch.object(gs.urllib.request, "urlopen", side_effect=TimeoutError()):
            with self.assertRaises(gs.ProviderError) as ctx:
                gs.search_semantic_scholar("test query")
        self.assertTrue(ctx.exception.reason.startswith("network_"))

    def test_semantic_scholar_5xx_raises(self):
        import urllib.error
        err = urllib.error.HTTPError("url", 503, "Service Unavailable", None, None)
        with mock.patch.object(gs.urllib.request, "urlopen", side_effect=err):
            with self.assertRaises(gs.ProviderError) as ctx:
                gs.search_semantic_scholar("q")
        self.assertEqual(ctx.exception.reason, "http_503")

    def test_openalex_json_parse_error_raises(self):
        resp = mock.MagicMock()
        resp.read.return_value = b"not json"
        resp.__enter__.return_value = resp
        with mock.patch.object(gs.urllib.request, "urlopen", return_value=resp):
            with self.assertRaises(gs.ProviderError) as ctx:
                gs.search_openalex("q")
        self.assertEqual(ctx.exception.reason, "json_parse_error")

    def test_arxiv_parse_error_raises(self):
        resp = mock.MagicMock()
        resp.read.return_value = b"this is not xml"
        resp.__enter__.return_value = resp
        with mock.patch.object(gs.urllib.request, "urlopen", return_value=resp):
            with self.assertRaises(gs.ProviderError) as ctx:
                gs.search_arxiv("q")
        self.assertEqual(ctx.exception.reason, "xml_parse_error")

    def test_arxiv_network_error_raises(self):
        import urllib.error
        with mock.patch.object(gs.urllib.request, "urlopen",
                               side_effect=urllib.error.URLError("conn refused")):
            with self.assertRaises(gs.ProviderError):
                gs.search_arxiv("q")


class SearchGapHealthTests(GapSearchTestBase):
    GAP = "learning-from-corrections"

    def _run(self, openalex=None, s2=None, arxiv=None):
        searchers = {
            "openalex": openalex or _ok_searcher("openalex", 2),
            "semantic_scholar": s2 or _ok_searcher("semantic_scholar", 2),
            "arxiv": arxiv or _ok_searcher("arxiv", 2),
        }
        with mock.patch.dict(gs._SEARCHERS, searchers):
            return gs.search_gap(self.GAP, force_refresh=True)

    def test_1_success_zero_results_updates_to_true_zero(self):
        """SUCCESS_ZERO_RESULTS is a genuine zero and MAY overwrite old evidence."""
        self.seed_cache({self.GAP: {
            "gap_id": self.GAP, "searched_at": "2026-09-21",
            "supporting": [], "counter": [], "neutral": [],
            "provider_last_success": {},
        }})
        result = self._run(
            openalex=_ok_searcher("openalex", 0),
            s2=_ok_searcher("semantic_scholar", 0),
            arxiv=_ok_searcher("arxiv", 0),
        )
        self.assertEqual(result["provider_status"]["openalex"], gs.STATUS_SUCCESS_ZERO)
        self.assertEqual(result["supporting_count"], 0)
        self.assertEqual(result["coverage_status"], "fresh")
        self.assertEqual(result["preserved_lkg_count"], 0)
        for p in gs.PROVIDERS:
            self.assertEqual(result["provider_health"][p]["freshness"], gs.FRESH)

    def test_2_single_provider_429_preserves_old_results(self):
        """S2 fails with 429 → its old evidence is kept, not overwritten by []."""
        old_supporting = [_support_paper("semantic_scholar", f"old{i}") for i in range(14)]
        self.seed_cache({self.GAP: {
            "gap_id": self.GAP, "searched_at": "2026-09-21",
            "supporting": old_supporting, "counter": [], "neutral": [],
            "provider_last_success": {"semantic_scholar": "2026-09-21"},
        }})
        result = self._run(s2=_fail_searcher("http_429"))
        self.assertEqual(result["provider_status"]["semantic_scholar"], gs.STATUS_FAILED)
        self.assertEqual(result["provider_health"]["semantic_scholar"]["error"], "http_429")
        # 14 old S2 supporting papers preserved + fresh OA/AX papers classified support
        self.assertGreaterEqual(result["supporting_count"], 14)
        s2_health = result["provider_health"]["semantic_scholar"]
        self.assertEqual(s2_health["freshness"], gs.STALE_LKG)
        self.assertEqual(s2_health["last_success_at"], "2026-09-21")
        self.assertEqual(result["coverage_status"], "degraded")
        self.assertEqual(result["fresh_providers"], 2)

    def test_3_timeout_preserves_old_results(self):
        old = [_paper("arxiv", "old1"), _paper("arxiv", "old2")]
        for p in old:
            p["evidence_type"] = "support"
        self.seed_cache({self.GAP: {
            "gap_id": self.GAP, "searched_at": "2026-09-21",
            "supporting": old, "counter": [], "neutral": [],
        }})
        result = self._run(arxiv=_fail_searcher("network_timeout"))
        ax = result["provider_health"]["arxiv"]
        self.assertEqual(ax["status"], gs.STATUS_FAILED)
        self.assertEqual(ax["freshness"], gs.STALE_LKG)
        self.assertEqual(result["provider_status"]["arxiv"], gs.STATUS_FAILED)

    def test_4_parse_failure_preserves_old_results(self):
        old = [_paper("openalex", "old1")]
        for p in old:
            p["evidence_type"] = "support"
        self.seed_cache({self.GAP: {
            "gap_id": self.GAP, "searched_at": "2026-09-21",
            "supporting": old, "counter": [], "neutral": [],
        }})
        result = self._run(openalex=_fail_searcher("json_parse_error"))
        oa = result["provider_health"]["openalex"]
        self.assertEqual(oa["status"], gs.STATUS_FAILED)
        self.assertEqual(oa["error"], "json_parse_error")
        self.assertEqual(oa["freshness"], gs.STALE_LKG)

    def test_5_two_of_three_success_is_degraded_but_completes(self):
        result = self._run(s2=_fail_searcher("http_429"))
        self.assertEqual(result["coverage_status"], "degraded")
        self.assertEqual(result["fresh_providers"], 2)
        # no previous cache → nothing to preserve; the failure is still recorded
        self.assertEqual(result["provider_status"]["semantic_scholar"], gs.STATUS_FAILED)
        self.assertEqual(result["provider_health"]["semantic_scholar"]["freshness"], gs.NOT_RUN_FRESHNESS)

    def test_6_all_providers_fail_raises(self):
        """0/3 providers → hard failure, never a fabricated zero round."""
        with self.assertRaises(gs.ProviderError) as ctx:
            self._run(
                openalex=_fail_searcher("http_429"),
                s2=_fail_searcher("http_429"),
                arxiv=_fail_searcher("http_429"),
            )
        self.assertEqual(ctx.exception.reason, "all_providers_failed")

    def test_7_failed_provider_cannot_zero_out_14_supporting(self):
        """The exact learning-from-corrections regression: S2 14 supporting,
        S2 fails this round → must NOT become 0."""
        old_supporting = [_support_paper("semantic_scholar", f"lkg{i}") for i in range(14)]
        self.seed_cache({self.GAP: {
            "gap_id": self.GAP, "searched_at": "2026-09-21",
            "supporting": old_supporting, "counter": [], "neutral": [],
        }})
        # S2 fails; other providers return genuinely zero results
        result = self._run(
            openalex=_ok_searcher("openalex", 0),
            s2=_fail_searcher("http_429"),
            arxiv=_ok_searcher("arxiv", 0),
        )
        self.assertEqual(result["supporting_count"], 14)
        self.assertEqual(result["preserved_lkg_count"], 14)
        self.assertEqual(result["coverage_status"], "degraded")

    def test_8_last_success_at_tracked_correctly(self):
        self.seed_cache({self.GAP: {
            "gap_id": self.GAP, "searched_at": "2026-09-21",
            "supporting": [], "counter": [], "neutral": [],
            "provider_last_success": {"arxiv": "2026-09-14"},
        }})
        result = self._run(s2=_fail_searcher("http_429"))
        today = result["searched_at"]
        pls = result["provider_last_success"]
        self.assertEqual(pls["openalex"], today)        # fresh this round
        self.assertEqual(pls["arxiv"], today)           # fresh this round overwrites old date
        self.assertNotIn("semantic_scholar", pls)       # never succeeded, no history

    def test_8b_last_success_kept_when_provider_fails(self):
        """A FAILED provider keeps its historical last_success_at."""
        old_supporting = [_support_paper("semantic_scholar", "x")]
        self.seed_cache({self.GAP: {
            "gap_id": self.GAP, "searched_at": "2026-09-21",
            "supporting": old_supporting, "counter": [], "neutral": [],
            "provider_last_success": {"semantic_scholar": "2026-09-21"},
        }})
        result = self._run(s2=_fail_searcher("http_429"))
        self.assertEqual(result["provider_last_success"]["semantic_scholar"], "2026-09-21")

    def test_9_stale_markers_correct(self):
        old_supporting = [_support_paper("semantic_scholar", "x")]
        self.seed_cache({self.GAP: {
            "gap_id": self.GAP, "searched_at": "2026-09-21",
            "supporting": old_supporting, "counter": [], "neutral": [],
        }})
        result = self._run(s2=_fail_searcher("http_429"))
        ph = result["provider_health"]
        self.assertEqual(ph["openalex"]["freshness"], gs.FRESH)
        self.assertEqual(ph["semantic_scholar"]["freshness"], gs.STALE_LKG)
        self.assertEqual(ph["semantic_scholar"]["status"], gs.STATUS_FAILED)
        self.assertEqual(ph["arxiv"]["freshness"], gs.FRESH)

    def test_10_provider_recovery_replaces_old_lkg(self):
        """After a failed round, a recovered provider replaces LKG with fresh results."""
        old = [_support_paper("semantic_scholar", "stale-old")]
        self.seed_cache({self.GAP: {
            "gap_id": self.GAP, "searched_at": "2026-09-21",
            "supporting": old, "counter": [], "neutral": [],
        }})
        # each of the 7 queries returns 3 fresh S2 papers → 21 raw
        fresh = [_support_paper("semantic_scholar", f"new{i}") for i in range(3)]
        result = self._run(s2=lambda q, limit=20: [dict(p) for p in fresh])
        s2 = result["provider_health"]["semantic_scholar"]
        self.assertEqual(s2["freshness"], gs.FRESH)
        self.assertEqual(s2["preserved_from"], "")
        self.assertEqual(s2["result_count"], 21)  # 3 per query × 7 queries
        self.assertEqual(result["preserved_lkg_count"], 0)
        # old stale paper must be gone (deduped set contains only fresh IDs)
        titles = [p["paper_id"] for p in result["supporting"] + result["neutral"] + result["counter"]]
        self.assertNotIn("semantic_scholar-stale-old", titles)

    def test_no_previous_cache_and_provider_fails_is_not_fake_zero(self):
        """No cache + provider fails → nothing fabricated, gap still completes
        with the other providers' fresh results."""
        result = self._run(s2=_fail_searcher("http_503"))
        s2 = result["provider_health"]["semantic_scholar"]
        self.assertEqual(s2["freshness"], gs.NOT_RUN_FRESHNESS if False else s2["freshness"])
        self.assertEqual(s2["result_count"], 0)
        self.assertEqual(result["coverage_status"], "degraded")


class ProviderHealthSummaryTests(GapSearchTestBase):
    def test_summary_counts_degraded_and_preserved(self):
        old_supporting = [_paper("semantic_scholar", f"lkg{i}") for i in range(14)]
        for p in old_supporting:
            p["evidence_type"] = "support"
        self.seed_cache({"learning-from-corrections": {
            "gap_id": "learning-from-corrections", "searched_at": "2026-09-21",
            "supporting": old_supporting, "counter": [], "neutral": [],
        }})
        searchers = {
            "openalex": _ok_searcher("openalex", 1),
            "semantic_scholar": _fail_searcher("http_429"),
            "arxiv": _ok_searcher("arxiv", 1),
        }
        with mock.patch.dict(gs._SEARCHERS, searchers):
            results = gs.search_all_gaps(force_refresh=True)
        text = gs.provider_health_summary(results)
        # S2 fails on every gap this round → provider-level state is "failed"
        self.assertIn("degraded: 12", text)
        self.assertIn("semantic_scholar: failed", text)
        self.assertIn("openalex: healthy", text)
        # learning-from-corrections had 14 LKG S2 papers preserved
        self.assertIn("Preserved last-known-good provider results: 14", text)


class AllProvidersFailNoWriteTests(GapSearchTestBase):
    def test_search_all_gaps_all_fail_preserves_cache(self):
        """If every provider fails for every gap, the previous cache file
        must remain byte-identical."""
        old = {"generated_at": "2026-09-21", "gaps": {
            "learning-from-corrections": {"gap_id": "learning-from-corrections",
                                          "supporting": [], "counter": [], "neutral": []}}}
        self.seed_cache(old)
        before = self.cache_path.read_bytes()
        searchers = {p: _fail_searcher("http_429") for p in gs.PROVIDERS}
        with mock.patch.dict(gs._SEARCHERS, searchers):
            with self.assertRaises(gs.ProviderError):
                gs.search_all_gaps(force_refresh=True)
        self.assertEqual(self.cache_path.read_bytes(), before)


class DegradedProviderTests(GapSearchTestBase):
    """Degraded semantics: a provider with SOME failed queries has only a
    partial view → fresh partial ∪ provider LKG. Full success → replace."""

    GAP = "learning-from-corrections"

    def _seed_14(self, **extra):
        old_supporting = [_support_paper("semantic_scholar", f"old{i}") for i in range(14)]
        gap = {"gap_id": self.GAP, "searched_at": "2026-09-21",
               "supporting": old_supporting, "counter": [], "neutral": []}
        gap.update(extra)
        self.seed_cache({self.GAP: gap})

    @staticmethod
    def _partial_then_ok(fail_first: int, per_query: int):
        """Searcher whose first `fail_first` calls fail, rest return distinct papers."""
        calls = {"n": 0}

        def _search(query, limit=20):
            calls["n"] += 1
            if calls["n"] <= fail_first:
                raise gs.ProviderError("http_429")
            return [_support_paper("semantic_scholar", f"new{calls['n']}-{i}") for i in range(per_query)]

        return _search

    def _run_s2(self, s2_searcher):
        searchers = {
            "openalex": _ok_searcher("openalex", 0),
            "semantic_scholar": s2_searcher,
            "arxiv": _ok_searcher("arxiv", 0),
        }
        with mock.patch.dict(gs._SEARCHERS, searchers):
            return gs.search_gap(self.GAP, force_refresh=True)

    def _s2_ids(self, result):
        return [p["paper_id"] for p in result["supporting"] + result["counter"] + result["neutral"]]

    def test_1_degraded_partial_results_cannot_shrink_below_lkg(self):
        """old=14, some queries fail, successful ones return 5 each →
        final supporting must NOT drop to the fresh-only count."""
        self._seed_14()
        result = self._run_s2(self._partial_then_ok(fail_first=3, per_query=5))
        ph = result["provider_health"]["semantic_scholar"]
        self.assertEqual(ph["status"], gs.STATUS_SUCCESS_RESULTS)
        self.assertTrue(ph["degraded"])
        self.assertEqual(ph["freshness"], gs.MIXED)
        self.assertEqual(result["preserved_lkg_count"], 14)
        self.assertGreaterEqual(result["supporting_count"], 14)

    def test_2_degraded_unions_new_with_lkg_and_dedupes(self):
        """Degraded round: fresh partial results add 2 genuinely new papers
        per successful query → final = LKG ∪ new, correctly deduped."""
        self._seed_14()
        calls = {"n": 0}

        def _search(query, limit=20):
            calls["n"] += 1
            if calls["n"] == 1:            # one failed query → degraded
                raise gs.ProviderError("http_429")
            return [_support_paper("semantic_scholar", "extra0"),
                    _support_paper("semantic_scholar", "extra1")]

        result = self._run_s2(_search)
        ph = result["provider_health"]["semantic_scholar"]
        self.assertTrue(ph["degraded"])
        self.assertEqual(ph["freshness"], gs.MIXED)
        # deduped unique set = 14 old + 2 distinct new
        self.assertEqual(result["unique_after_dedup"], 16)
        ids = self._s2_ids(result)
        old_count = sum(1 for i in ids if i.startswith("semantic_scholar-old"))
        extra_count = sum(1 for i in ids if i.startswith("semantic_scholar-extra"))
        self.assertEqual(old_count, 14)
        self.assertEqual(extra_count, 2)

    def test_3_next_full_success_replaces_lkg_no_permanent_accumulation(self):
        """Next round FULL success returns only 6 papers → replace; the old
        14 must NOT persist forever."""
        self._seed_14(provider_last_full_success={})
        result = self._run_s2(self._partial_then_ok(fail_first=0, per_query=6))
        ph = result["provider_health"]["semantic_scholar"]
        self.assertFalse(ph["degraded"])
        self.assertEqual(ph["freshness"], gs.FRESH)
        self.assertEqual(result["preserved_lkg_count"], 0)
        ids = self._s2_ids(result)
        self.assertNotIn("semantic_scholar-old0", ids)
        # 6 per query × 7 queries, all distinct (supporting_count counts the
        # full deduped set; the displayed list is capped at 20 per bucket)
        self.assertEqual(result["supporting_count"], 42)

    def test_4_degraded_with_zero_from_successful_queries_keeps_lkg(self):
        """Degraded: successful queries return a true zero, failed queries
        unknown → provider-level LKG must survive."""
        self._seed_14()
        result = self._run_s2(self._partial_then_ok(fail_first=2, per_query=0))
        ph = result["provider_health"]["semantic_scholar"]
        self.assertEqual(ph["status"], gs.STATUS_SUCCESS_ZERO)
        self.assertTrue(ph["degraded"])
        self.assertEqual(ph["freshness"], gs.MIXED)
        self.assertEqual(result["preserved_lkg_count"], 14)
        self.assertGreaterEqual(result["supporting_count"], 14)

    def test_5_full_success_zero_results_clears_provider_evidence(self):
        """Full success + genuine zero → the old provider evidence IS cleared
        (the only sanctioned way stale evidence gets removed)."""
        self._seed_14()
        result = self._run_s2(_ok_searcher("semantic_scholar", 0))
        ph = result["provider_health"]["semantic_scholar"]
        self.assertEqual(ph["status"], gs.STATUS_SUCCESS_ZERO)
        self.assertFalse(ph["degraded"])
        self.assertEqual(ph["freshness"], gs.FRESH)
        self.assertEqual(result["preserved_lkg_count"], 0)
        ids = self._s2_ids(result)
        self.assertNotIn("s2-old0", ids)
        self.assertEqual(result["supporting_count"], 0)

    def test_6_last_full_success_at_not_advanced_on_degraded(self):
        """A degraded round must NOT move last_full_success_at forward."""
        self._seed_14(provider_last_full_success={"semantic_scholar": "2026-09-14"})
        result = self._run_s2(self._partial_then_ok(fail_first=3, per_query=5))
        ph = result["provider_health"]["semantic_scholar"]
        self.assertEqual(ph["freshness"], gs.MIXED)
        self.assertEqual(ph["last_full_success_at"], "2026-09-14")
        self.assertEqual(result["provider_last_full_success"]["semantic_scholar"], "2026-09-14")

    def test_7_last_full_success_at_updated_on_full_success(self):
        """Full success advances last_full_success_at to today."""
        self._seed_14(provider_last_full_success={"semantic_scholar": "2026-09-14"})
        result = self._run_s2(self._partial_then_ok(fail_first=0, per_query=6))
        ph = result["provider_health"]["semantic_scholar"]
        self.assertEqual(ph["freshness"], gs.FRESH)
        self.assertEqual(ph["last_full_success_at"], result["searched_at"])
        self.assertEqual(result["provider_last_full_success"]["semantic_scholar"], result["searched_at"])


if __name__ == "__main__":
    unittest.main()
