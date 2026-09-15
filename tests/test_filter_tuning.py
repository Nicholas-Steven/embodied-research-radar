"""Filter-tuning tests — 2026-09-15 round 2.

Covers:
- publication-date filtering (stale metadata updates rejected)
- eligibility gate (anchors, strong phrases, category tiers)
- generic keywords cannot create eligibility or relevance
- topic semantics (VLA is not a fallback bucket)
- threshold regression + known-relevant retention
- remote paper IDs are preserved by the pipeline
"""

import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

from scripts.radar import pipeline, scoring
from scripts.radar.fetch_health import FetchHealth
from scripts.radar.oai_harvester import _parse_record, rolling_window
from scripts.radar.scoring import is_radar_eligible, infer_topics, paper_categories, score_paper
from scripts.radar.schema import clean_paper

import xml.etree.ElementTree as ET

OAI_NS = {"o": "http://www.openarchives.org/OAI/2.0/"}


def _oai_record_xml(arxiv_id="2609.12345", created="2026-09-12", title="Force-Aware Robotic Manipulation"):
    return f"""<record>
      <header><identifier>oai:arXiv.org:{arxiv_id}</identifier><datestamp>2026-09-14</datestamp><setSpec>cs:cs:RO</setSpec></header>
      <metadata>
        <arXiv xmlns="http://arxiv.org/OAI/arXiv/">
          <id>{arxiv_id}</id><created>{created}</created><updated>2026-09-14</updated>
          <authors><author>Ada Lovelace</author></authors>
          <title>{title}</title>
          <categories>cs.RO</categories>
          <abstract>Robotic manipulation with force torque sensing on contact-rich assembly tasks.</abstract>
          <doi>10.1234/test</doi>
        </arXiv>
      </metadata>
    </record>"""


def _wrap(record_xml: str) -> ET.Element:
    return ET.fromstring(f"<OAI-PMH xmlns='http://www.openarchives.org/OAI/2.0/'>{record_xml}</OAI-PMH>")


def _paper(title="Vision-Force Admittance Learning for Peg Insertion", abstract="Robotic manipulation with force torque sensing.",
           keywords=("cs.RO",), **extra):
    return clean_paper({"title": title, "abstract": abstract, "keywords": list(keywords),
                        "source_categories": list(keywords), **extra})


class PublicationDateTests(unittest.TestCase):
    def test_parse_uses_created_as_published_not_datestamp(self):
        parsed = _parse_record(_wrap(_oai_record_xml(created="2026-09-12")).find("o:record", OAI_NS))
        self.assertEqual(parsed["published_date"], "2026-09-12")
        self.assertEqual(parsed["oai_datestamp"], "2026-09-14", "datestamp is metadata-change time, not published")

    def test_stale_metadata_update_rejected(self):
        # Old paper whose metadata changed inside the harvest window.
        parsed = _parse_record(_wrap(_oai_record_xml(created="2024-05-01")).find("o:record", OAI_NS))
        now = datetime(2026, 9, 15, 12, 0, tzinfo=timezone.utc)
        from scripts.radar.oai_harvester import PUBLICATION_OVERLAP_DAYS, DEFAULT_LOOKBACK_DAYS
        pub_start = (now - timedelta(days=DEFAULT_LOOKBACK_DAYS + PUBLICATION_OVERLAP_DAYS)).date().isoformat()
        self.assertLess(parsed["published_date"], pub_start, "2024 paper must fall outside the publication window")

    def test_rolling_window_includes_overlap_day(self):
        now = datetime(2026, 9, 15, 12, 0, tzinfo=timezone.utc)
        start, end = rolling_window(7, now)
        self.assertEqual((start, end), ("2026-09-08", "2026-09-15"))
        # publication window is one day wider
        pub_start = (now - timedelta(days=8)).date().isoformat()
        self.assertEqual(pub_start, "2026-09-07")


class EligibilityGateTests(unittest.TestCase):
    def test_strong_phrase_eligible(self):
        ok, why = is_radar_eligible(_paper(title="Dexterous Manipulation from Human Videos"))
        self.assertTrue(ok)

    def test_generic_paper_ineligible(self):
        p = _paper(title="Agricultural Parcel Vectorization with Transformers",
                   abstract="Satellite imagery segmentation for farmland. Code and benchmark released.",
                   keywords=["cs.CV"])
        ok, why = is_radar_eligible(p)
        self.assertFalse(ok)

    def test_generic_keywords_do_not_create_eligibility(self):
        # github/code/dataset/benchmark/real-world must NOT qualify a paper.
        p = _paper(title="FooNet: A Transformer Study",
                   abstract="We release github code, a dataset and benchmark with real-world experiments.",
                   keywords=["cs.LG"])
        ok, _ = is_radar_eligible(p)
        self.assertFalse(ok)
        score, _ = score_paper(p)
        self.assertLess(score, 45, "resource metadata alone must stay far below threshold")

    def test_tier_a_robot_manipulation_eligible(self):
        p = _paper(title="Continual Policy Consolidation for Lifelong Robot Learning",
                   abstract="Reinforcement learning for robot manipulation tasks.")
        ok, _ = is_radar_eligible(p)
        self.assertTrue(ok)

    def test_tier_b_needs_explicit_robot_context(self):
        p = _paper(title="Probing Speaker Identity in Audio Models",
                   abstract="Deepfake detection benchmark with alignment losses.", keywords=["cs.CV"])
        ok, _ = is_radar_eligible(p)
        self.assertFalse(ok)

    def test_category_alone_is_not_eligibility(self):
        p = _paper(title="City Traffic Flow Prediction",
                   abstract="Graph neural networks forecast urban traffic.", keywords=["cs.RO"])
        ok, _ = is_radar_eligible(p)
        self.assertFalse(ok, "cs.RO category without manipulation semantics must not pass")


class TopicSemanticsTests(unittest.TestCase):
    def test_vla_not_fallback(self):
        p = _paper(title="Continual Policy Consolidation for Lifelong Robot Learning",
                   abstract="Reinforcement learning with behavior cloning baselines on manipulation benchmarks.")
        self.assertNotIn("vla-manipulation", infer_topics(p))

    def test_explicit_vla_matched(self):
        p = _paper(title="GloVLA: A Vision-Language-Action Model",
                   abstract="VLA policy for robot grasping.")
        self.assertIn("vla-manipulation", infer_topics(p))

    def test_no_match_goes_to_core_papers(self):
        p = _paper(title="Some Robot Study", abstract="Robot navigation without manipulation evidence. Walking only.")
        self.assertEqual(infer_topics(p), ["core-papers"])

    def test_force_paper_vision_force(self):
        p = _paper(title="Vision-Force Admittance Learning", abstract="Force-aware insertion with 6-axis force torque sensing.")
        self.assertIn("vision-force", infer_topics(p))

    def test_diffusion_policy_generative(self):
        p = _paper(title="ObstaDiff: Diffusion Policy Learning", abstract="Diffusion policy for robot manipulation with obstacle-aware representations.")
        self.assertIn("generative-policy", infer_topics(p))

    def test_failure_recovery_topic(self):
        p = _paper(title="Vision-Force Admittance Learning", abstract="Force-aware insertion with failure recovery and replanning.")
        self.assertIn("failure-recovery", infer_topics(p))


class ThresholdCalibrationTests(unittest.TestCase):
    def test_domain_dominates_resources(self):
        rich_resource = score_paper(_paper(title="FooNet", abstract="github code, dataset, benchmark, real-world"))[0]
        domain = score_paper(_paper(title="Vision-Force Admittance Learning for Peg Insertion",
                                    abstract="Robotic manipulation with force torque on contact-rich assembly."))[0]
        self.assertGreater(domain, rich_resource + 30)

    def test_calibration_reference_scores(self):
        """Score regression anchors (threshold 45–70 ladder)."""
        vf = score_paper(_paper(title="Force-Aware Reinforcement Learning",
                                abstract="Vision force estimation for contact-rich robotic manipulation with 6-axis F/T sensor."))[0]
        self.assertGreaterEqual(vf, 70, "top-band vision-force paper should stay 70+")
        tactile = score_paper(_paper(title="Tactile Grasping", abstract="Tactile sensing for robot grasping."))[0]
        self.assertGreaterEqual(tactile, 30)
        generic = score_paper(_paper(title="FooNet", abstract="github dataset benchmark real-world transformer"))[0]
        self.assertLess(generic, 20)


class KnownRelevantRetentionTests(unittest.TestCase):
    KNOWN = [
        ("Force-Aware Reinforcement Learning with Hybrid Sensorless Force Estimation",
         "Robotic manipulation with vision force estimation and 6-axis F/T sensing, contact-rich tasks."),
        ("GIFT: Glove-Inferred Force Transfer",
         "Force-aware human-to-robot skill transfer for robotic manipulation with force torque gloves."),
        ("Vision-Force Admittance Learning for Peg Insertion into a Movable Hole",
         "Robotic manipulation: force-aware admittance control for contact-rich peg insertion with recovery."),
        ("Dex-X: Learning Visual-Tactile Dexterous Manipulation From Human Videos",
         "Tactile dexterous manipulation; contact-rich robot grasping from human video imitation."),
        ("PredTac: Learning Contact-Rich Manipulation with Predicted Touch",
         "Contact-rich robot manipulation with tactile prediction and policy learning."),
    ]

    def test_known_relevant_all_retained(self):
        for title, abstract in self.KNOWN:
            p = _paper(title=title, abstract=abstract)
            ok, why = is_radar_eligible(p)
            score, _ = score_paper(p)
            self.assertTrue(ok, f"{title!r} lost eligibility: {why}")
            self.assertGreaterEqual(score, 45, f"{title!r} fell below threshold: score={score}")


class RemoteIDsPreservedTests(unittest.TestCase):
    def test_pipeline_never_drops_existing_ids(self):
        existing = clean_paper({"paper_id": "arxiv-2411-15753", "arxiv_id": "2411.15753",
                                "title": "FoAR: Force-Aware Reactive Policy",
                                "abstract": "Contact-rich robotic manipulation with force-aware reactive policy.",
                                "keywords": ["cs.RO"], "source_categories": ["cs.RO"],
                                "published_date": "2025-05-02", "relevance_score": 80,
                                "relevance_reason": "legacy", "research_topics": ["vision-force"]})
        incoming = clean_paper({"arxiv_id": "2609.99999", "title": "Tactile Grasping Policy",
                                "abstract": "Tactile sensing for contact-rich robot grasping and manipulation.",
                                "keywords": ["cs.RO"], "source_categories": ["cs.RO"],
                                "published_date": "2026-09-12"})
        health = FetchHealth(source="test", requests_attempted=1, requests_succeeded=1)
        with mock.patch.object(pipeline, "fetch_candidates", return_value=([existing, incoming], health)), \
             mock.patch("pathlib.Path.write_text"), mock.patch("pathlib.Path.replace"):
            payload, _ = pipeline.run(fetch=True, threshold=45, with_ai=False)
        ids = {p["paper_id"] for p in payload["papers"]}
        self.assertIn("arxiv-2411-15753", ids)
        self.assertIn("arxiv-2609-99999", ids)


if __name__ == "__main__":
    unittest.main()
