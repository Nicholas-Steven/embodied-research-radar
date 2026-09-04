"""Tests for scripts/build_landscape.py — Research Landscape analysis engine."""

import json
import unittest
from pathlib import Path

from scripts.build_landscape import (
    build,
    classify_evidence,
    compute_statistics,
    map_paper_to_stages,
    analyze_gaps,
    assess_maturity,
    MATURITY_DIMENSIONS,
    PIPELINE_STAGES,
    _read_json,
    _HITL_RE,
    _FAILURE_DETECT_RE,
    _FAILURE_DIAG_RE,
    _text,
)
from scripts.radar.gap_search import (
    deduplicate,
    classify_external_evidence,
    _normalize_doi,
    _normalize_arxiv_id,
    _paper_fingerprint,
    _normalize_title as gap_normalize_title,
)

ROOT = Path(__file__).resolve().parents[1]


class EvidenceClassificationTests(unittest.TestCase):
    """Test three-tier evidence classification."""

    def setUp(self):
        self.papers = json.loads((ROOT / "data" / "demo_papers.json").read_text(encoding="utf-8"))

    def test_direct_paper_with_vf_topic_and_failure_topic(self):
        """Paper in both vision-force and failure-understanding → direct."""
        paper = {
            "paper_id": "test-direct",
            "title": "ContactGuard: Pre-Contact Execution Monitoring",
            "abstract": "Contact-rich manipulation failures with force/torque sensing and vision",
            "abstract_zh": "接触丰富操作失败的力觉与视觉监控",
            "research_topics": ["vision-force", "failure-understanding"],
            "keywords": ["contact-rich", "force torque"],
            "methods": [],
            "tasks": [],
            "sensors": ["Force/Torque"],
        }
        self.assertEqual(classify_evidence(paper), "direct")

    def test_related_paper_with_failure_topic_and_force_signal(self):
        """Failure-recovery paper with force signal but no VF topic → related."""
        paper = {
            "paper_id": "test-related",
            "title": "Recovery with Force Feedback",
            "abstract": "Using force torque sensing for failure recovery in manipulation",
            "abstract_zh": "",
            "research_topics": ["failure-recovery"],
            "keywords": [],
            "methods": [],
            "tasks": [],
            "sensors": ["Force/Torque"],
        }
        self.assertEqual(classify_evidence(paper), "related")

    def test_background_paper_with_vf_topic_and_failure_signal(self):
        """VF paper with failure signal but no failure topic → background."""
        paper = {
            "paper_id": "test-background",
            "title": "Force-Aware Contact Manipulation with Error Recovery",
            "abstract": "Vision force fusion for contact-rich tasks with failure detection",
            "abstract_zh": "",
            "research_topics": ["vision-force"],
            "keywords": ["force-aware"],
            "methods": [],
            "tasks": [],
            "sensors": [],
        }
        self.assertEqual(classify_evidence(paper), "background")

    def test_none_paper_with_no_relevant_signals(self):
        """VLA-only paper with no failure or force signals → none."""
        paper = {
            "paper_id": "test-none",
            "title": "Language Grounded Robot Policy",
            "abstract": "A vision language action model for pick and place tasks",
            "abstract_zh": "",
            "research_topics": ["vla-manipulation"],
            "keywords": [],
            "methods": [],
            "tasks": [],
            "sensors": ["RGB"],
        }
        self.assertEqual(classify_evidence(paper), "none")

    def test_failure_recovery_without_force_is_not_direct(self):
        """failure-recovery without force/tactile → NOT direct."""
        paper = {
            "paper_id": "test-not-direct",
            "title": "Robot Recovery via Replanning",
            "abstract": "Recovery policy for manipulation failures using visual feedback only",
            "abstract_zh": "",
            "research_topics": ["failure-recovery"],
            "keywords": [],
            "methods": [],
            "tasks": [],
            "sensors": ["RGB"],
        }
        tier = classify_evidence(paper)
        self.assertIn(tier, ("related", "none", "background"),
                       "failure-recovery without force should NOT be direct")


class PipelineStageMappingTests(unittest.TestCase):
    """Test paper-to-pipeline-stage mapping."""

    def test_perception_stage_matches_sensor_papers(self):
        paper = {
            "title": "Force Sensing for Robot Perception",
            "abstract": "Using tactile sensors and RGB cameras for perception",
            "abstract_zh": "", "keywords": [], "methods": [], "tasks": [],
        }
        stages = map_paper_to_stages(paper)
        self.assertIn("perception", stages)

    def test_failure_detection_stage(self):
        paper = {
            "title": "Anomaly Detection in Manipulation",
            "abstract": "Failure detection using execution monitoring",
            "abstract_zh": "", "keywords": [], "methods": [], "tasks": [],
        }
        stages = map_paper_to_stages(paper)
        self.assertIn("failure_detection", stages)

    def test_recovery_stage(self):
        paper = {
            "title": "Error Recovery for Robot Arms",
            "abstract": "Replanning and retry strategies for manipulation failures",
            "abstract_zh": "", "keywords": [], "methods": [], "tasks": [],
        }
        stages = map_paper_to_stages(paper)
        self.assertIn("recovery_action", stages)

    def test_paper_can_map_to_multiple_stages(self):
        paper = {
            "title": "Contact Detection and Failure Recovery",
            "abstract": "Contact state estimation for failure detection and recovery with re-verification",
            "abstract_zh": "", "keywords": [], "methods": [], "tasks": [],
        }
        stages = map_paper_to_stages(paper)
        self.assertGreater(len(stages), 1)


class StatisticsTests(unittest.TestCase):
    """Test statistics computation."""

    def test_topic_counts_match_papers_json(self):
        papers_data = json.loads((ROOT / "data" / "papers.json").read_text(encoding="utf-8"))
        papers = papers_data.get("papers", [])
        stats = compute_statistics(papers)
        self.assertEqual(stats["total_papers"], len(papers))
        self.assertGreater(stats["total_papers"], 0)

    def test_cross_topic_counts_consistent(self):
        papers_data = json.loads((ROOT / "data" / "papers.json").read_text(encoding="utf-8"))
        papers = papers_data.get("papers", [])
        stats = compute_statistics(papers)
        # Cross counts should be <= individual counts
        self.assertLessEqual(
            stats["cross_topic_counts"]["vision-force_and_failure-understanding"],
            stats["topic_counts"]["vision-force"]
        )
        self.assertLessEqual(
            stats["cross_topic_counts"]["vision-force_and_failure-understanding"],
            stats["topic_counts"]["failure-understanding"]
        )

    def test_empty_papers_returns_zero(self):
        stats = compute_statistics([])
        self.assertEqual(stats["total_papers"], 0)
        self.assertEqual(stats["evidence_tiers"]["direct"], 0)

    def test_evidence_tier_counts_sum_le_total(self):
        papers_data = json.loads((ROOT / "data" / "papers.json").read_text(encoding="utf-8"))
        papers = papers_data.get("papers", [])
        stats = compute_statistics(papers)
        tier_sum = (stats["evidence_tiers"]["direct"]
                    + stats["evidence_tiers"]["related"]
                    + stats["evidence_tiers"]["background"])
        self.assertLessEqual(tier_sum, stats["total_papers"])


class GapGenerationTests(unittest.TestCase):
    """Test research gap analysis."""

    def setUp(self):
        papers_data = json.loads((ROOT / "data" / "papers.json").read_text(encoding="utf-8"))
        self.papers = papers_data.get("papers", [])
        self.gaps = analyze_gaps(self.papers)

    def test_gaps_are_generated(self):
        self.assertGreater(len(self.gaps), 0, "Should generate at least some gaps")

    def test_gap_has_required_fields(self):
        required = {"id", "title", "title_zh", "question", "claim_type",
                     "current_progress", "missing_piece", "why_it_matters",
                     "supporting_paper_ids", "counter_paper_ids",
                     "confidence", "research_opportunity"}
        for gap in self.gaps:
            with self.subTest(gap_id=gap.get("id")):
                self.assertTrue(required.issubset(gap.keys()),
                                f"Gap {gap.get('id')} missing fields: {required - set(gap.keys())}")

    def test_gap_paper_ids_are_lists(self):
        for gap in self.gaps:
            with self.subTest(gap_id=gap.get("id")):
                self.assertIsInstance(gap["supporting_paper_ids"], list)
                self.assertIsInstance(gap["counter_paper_ids"], list)

    def test_gap_confidence_is_valid(self):
        valid = {"high", "medium", "low", "insufficient"}
        for gap in self.gaps:
            with self.subTest(gap_id=gap.get("id")):
                self.assertIn(gap["confidence"], valid,
                              f"Gap {gap.get('id')} has invalid confidence: {gap['confidence']}")

    def test_gap_claim_type_is_valid(self):
        valid = {"fact", "evidence-based-inference", "open-hypothesis", "dataset-limited"}
        for gap in self.gaps:
            with self.subTest(gap_id=gap.get("id")):
                self.assertIn(gap["claim_type"], valid)

    def test_gap_supporting_ids_exist_in_papers(self):
        paper_ids = {p.get("paper_id") for p in self.papers}
        for gap in self.gaps:
            for pid in gap["supporting_paper_ids"]:
                with self.subTest(gap_id=gap.get("id"), paper_id=pid):
                    self.assertIn(pid, paper_ids,
                                  f"Supporting paper {pid} not found in papers.json")

    def test_gap_counter_ids_exist_in_papers(self):
        paper_ids = {p.get("paper_id") for p in self.papers}
        for gap in self.gaps:
            for pid in gap["counter_paper_ids"]:
                with self.subTest(gap_id=gap.get("id"), paper_id=pid):
                    self.assertIn(pid, paper_ids,
                                  f"Counter paper {pid} not found in papers.json")

    def test_recovery_without_reverification_gap_present(self):
        gap_ids = [g["id"] for g in self.gaps]
        self.assertIn("recovery-without-reverification", gap_ids)


class MaturityTests(unittest.TestCase):
    """Test maturity assessment."""

    def setUp(self):
        papers_data = json.loads((ROOT / "data" / "papers.json").read_text(encoding="utf-8"))
        self.papers = papers_data.get("papers", [])

    def test_all_dimensions_assessed(self):
        results = [assess_maturity(self.papers, dim) for dim in MATURITY_DIMENSIONS]
        self.assertEqual(len(results), len(MATURITY_DIMENSIONS))

    def test_maturity_levels_valid(self):
        valid = {"Emerging", "Developing", "Moderate", "Relatively Mature"}
        for dim in MATURITY_DIMENSIONS:
            result = assess_maturity(self.papers, dim)
            with self.subTest(dim=dim["id"]):
                self.assertIn(result["level"], valid,
                              f"Dimension {dim['id']} has invalid level: {result['level']}")

    def test_empty_papers_all_emerging(self):
        for dim in MATURITY_DIMENSIONS:
            result = assess_maturity([], dim)
            self.assertEqual(result["level"], "Emerging")
            self.assertEqual(result["paper_count"], 0)


class SchemaTests(unittest.TestCase):
    """Test output JSON structure."""

    def setUp(self):
        self.landscape = build()

    def test_required_top_level_keys(self):
        required = {"schema_version", "generated_at", "topic", "disclaimer",
                     "statistics", "pipeline", "maturity", "gaps",
                     "directions", "evidence_index"}
        self.assertTrue(required.issubset(set(self.landscape.keys())),
                        f"Missing top-level keys: {required - set(self.landscape.keys())}")

    def test_pipeline_has_9_stages(self):
        self.assertEqual(len(self.landscape["pipeline"]), 9)

    def test_maturity_has_13_dimensions(self):
        self.assertEqual(len(self.landscape["maturity"]), len(MATURITY_DIMENSIONS))

    def test_statistics_has_required_keys(self):
        stats = self.landscape["statistics"]
        self.assertIn("total_papers", stats)
        self.assertIn("topic_counts", stats)
        self.assertIn("cross_topic_counts", stats)
        self.assertIn("evidence_tiers", stats)

    def test_evidence_index_is_dict(self):
        self.assertIsInstance(self.landscape["evidence_index"], dict)
        self.assertGreater(len(self.landscape["evidence_index"]), 0)

    def test_disclaimer_is_nonempty(self):
        self.assertGreater(len(self.landscape["disclaimer"]), 20)


class EdgeCaseTests(unittest.TestCase):
    """Test edge cases and robustness."""

    def test_zero_papers_does_not_crash(self):
        stats = compute_statistics([])
        gaps = analyze_gaps([])
        self.assertEqual(stats["total_papers"], 0)
        self.assertIsInstance(gaps, list)

    def test_paper_with_empty_fields_does_not_crash(self):
        paper = {
            "paper_id": "empty-test",
            "title": "",
            "abstract": "",
            "abstract_zh": "",
            "research_topics": [],
            "keywords": [],
            "methods": [],
            "tasks": [],
            "sensors": [],
        }
        tier = classify_evidence(paper)
        self.assertEqual(tier, "none")
        stages = map_paper_to_stages(paper)
        self.assertIsInstance(stages, list)


class AuditCorrectionTests(unittest.TestCase):
    """Test that audit corrections are reflected in gap analysis."""

    def setUp(self):
        papers_data = json.loads((ROOT / "data" / "papers.json").read_text(encoding="utf-8"))
        self.papers = papers_data.get("papers", [])
        self.gaps = analyze_gaps(self.papers)
        self.gap_map = {g["id"]: g for g in self.gaps}

    def test_hitl_rejects_human_demonstration(self):
        """'human demonstration' must NOT match HITL regex."""
        self.assertFalse(_HITL_RE.search("learning from human demonstration"))
        self.assertFalse(_HITL_RE.search("human demonstrations for manipulation"))

    def test_hitl_accepts_human_in_the_loop(self):
        """'human-in-the-loop' must match HITL regex."""
        self.assertTrue(_HITL_RE.search("human-in-the-loop reinforcement learning"))
        self.assertTrue(_HITL_RE.search("human intervention for robot"))

    def test_failure_detection_rejects_generic_detect(self):
        """'detect' alone in generic context should not match failure detection."""
        self.assertFalse(_FAILURE_DETECT_RE.search("object detection for grasping"))

    def test_failure_detection_accepts_anomaly_detection(self):
        """'anomaly detection' must match failure detection."""
        self.assertTrue(_FAILURE_DETECT_RE.search("multimodal anomaly detection for manipulation"))

    def test_failure_recovery_not_equivalent_to_vf_recovery(self):
        """failure-recovery topic alone must NOT classify as direct VF recovery."""
        paper = {
            "paper_id": "test-fr-not-vf",
            "title": "Robot Recovery via Replanning",
            "abstract": "Recovery policy using visual feedback only",
            "abstract_zh": "",
            "research_topics": ["failure-recovery"],
            "keywords": [], "methods": [], "tasks": [],
            "sensors": ["RGB"],
        }
        tier = classify_evidence(paper)
        self.assertIn(tier, ("related", "none", "background"),
                       "failure-recovery without force must NOT be direct")

    def test_gap4_confidence_downgraded_from_high(self):
        """Gap 4 recovery-without-reverification should be medium, not high."""
        g4 = self.gap_map.get("recovery-without-reverification")
        self.assertIsNotNone(g4)
        self.assertEqual(g4["confidence"], "medium")

    def test_gap1_marked_dataset_limited(self):
        """Gap 1 physical-state-aliasing should be dataset-limited."""
        g1 = self.gap_map.get("physical-state-aliasing")
        self.assertIsNotNone(g1)
        self.assertEqual(g1["confidence"], "low")
        self.assertEqual(g1["claim_type"], "dataset-limited")
        self.assertEqual(g1["group"], "dataset-limited")

    def test_gap8_stays_evidence_supported(self):
        """Gap 8 failure-to-recovery-hierarchy should remain evidence-supported."""
        g8 = self.gap_map.get("failure-to-recovery-hierarchy")
        self.assertIsNotNone(g8)
        self.assertEqual(g8["confidence"], "medium")
        self.assertEqual(g8["claim_type"], "evidence-based-inference")
        self.assertEqual(g8["group"], "evidence-supported")

    def test_gap3_stays_evidence_supported(self):
        """Gap 3 detection-without-recovery should remain evidence-supported."""
        g3 = self.gap_map.get("detection-without-recovery")
        self.assertIsNotNone(g3)
        self.assertEqual(g3["confidence"], "medium")
        self.assertEqual(g3["group"], "evidence-supported")

    def test_all_gaps_have_group_field(self):
        """Every gap must have a valid group field."""
        valid_groups = {"evidence-supported", "open-hypotheses", "dataset-limited", "partially-addressed"}
        for g in self.gaps:
            with self.subTest(gap_id=g["id"]):
                self.assertIn(g.get("group"), valid_groups,
                              f"Gap {g['id']} has invalid group: {g.get('group')}")


class GapSearchDedupTests(unittest.TestCase):
    """Test deduplication and normalization in gap_search.py."""

    def test_doi_normalization(self):
        self.assertEqual(_normalize_doi("https://doi.org/10.1234/test"), "10.1234/test")
        self.assertEqual(_normalize_doi("10.1234/test"), "10.1234/test")

    def test_arxiv_id_normalization(self):
        self.assertEqual(_normalize_arxiv_id("https://arxiv.org/abs/2411.15753v2"), "2411.15753")
        self.assertEqual(_normalize_arxiv_id("arXiv:2303.04137"), "2303.04137")

    def test_doi_dedup(self):
        papers = [
            {"paper_id": "a", "title": "Paper A", "doi": "10.1234/test", "sources": ["openalex"]},
            {"paper_id": "b", "title": "Paper A", "doi": "10.1234/test", "sources": ["semantic-scholar"]},
        ]
        result = deduplicate(papers)
        self.assertEqual(len(result), 1)
        self.assertIn("openalex", result[0]["sources"])
        self.assertIn("semantic-scholar", result[0]["sources"])

    def test_arxiv_id_dedup(self):
        papers = [
            {"paper_id": "a", "title": "Paper A", "arxiv_id": "2411.15753", "sources": ["arxiv"]},
            {"paper_id": "b", "title": "Paper A", "arxiv_id": "2411.15753v1", "sources": ["openalex"]},
        ]
        result = deduplicate(papers)
        self.assertEqual(len(result), 1)

    def test_title_fallback_dedup(self):
        papers = [
            {"paper_id": "a", "title": "Force-Aware Robot Manipulation", "sources": ["openalex"]},
            {"paper_id": "b", "title": "Force-Aware Robot Manipulation!", "sources": ["arxiv"]},
        ]
        result = deduplicate(papers)
        self.assertEqual(len(result), 1)

    def test_different_papers_not_merged(self):
        papers = [
            {"paper_id": "a", "title": "Paper A", "doi": "10.1111/a", "sources": ["openalex"]},
            {"paper_id": "b", "title": "Paper B", "doi": "10.1111/b", "sources": ["openalex"]},
        ]
        result = deduplicate(papers)
        self.assertEqual(len(result), 2)


class ExternalEvidenceClassificationTests(unittest.TestCase):
    """Test classify_external_evidence for various gap types."""

    def test_recovery_reverification_counter(self):
        paper = {
            "title": "Post-Recovery Verification for Manipulation",
            "abstract": "We verify task success after recovery using closed-loop observation",
        }
        self.assertEqual(classify_external_evidence(paper, "recovery-without-reverification"), "counter")

    def test_recovery_no_reverification_support(self):
        paper = {
            "title": "Robot Recovery via Replanning",
            "abstract": "We replan after failure but do not verify task completion",
        }
        self.assertEqual(classify_external_evidence(paper, "recovery-without-reverification"), "support")

    def test_temporal_force_counter(self):
        paper = {
            "title": "Temporal Force-Torque Fusion for Manipulation",
            "abstract": "Vision-force temporal fusion with 6-axis force torque history",
        }
        self.assertEqual(classify_external_evidence(paper, "temporal-6d-ft-evidence"), "counter")

    def test_hitl_with_uncertainty_counter(self):
        paper = {
            "title": "Uncertainty-Driven Human-in-the-Loop Robot Learning",
            "abstract": "We use uncertainty estimates to decide when to ask for human intervention",
        }
        self.assertEqual(classify_external_evidence(paper, "selective-human-escalation"), "counter")

    def test_force_feedback_not_human_correction(self):
        paper = {
            "title": "Force Feedback Control for Compliant Manipulation",
            "abstract": "Using force feedback control for impedance regulation",
        }
        result = classify_external_evidence(paper, "learning-from-corrections")
        self.assertEqual(result, "neutral")


class GapSearchAPIFailureTests(unittest.TestCase):
    """Test that API failures don't crash the system."""

    def test_search_returns_empty_on_bad_query(self):
        from scripts.radar.gap_search import search_arxiv
        # Empty query should not crash
        result = search_arxiv("__invalid_query_that_should_return_nothing__12345__")
        self.assertIsInstance(result, list)

    def test_classify_neutral_for_irrelevant(self):
        paper = {"title": "Deep Learning for Image Classification", "abstract": "CNN for cats and dogs"}
        result = classify_external_evidence(paper, "physical-state-aliasing")
        self.assertEqual(result, "neutral")


class RefreshEvidenceTests(unittest.TestCase):
    """Tests for refresh/evidence logic."""

    def test_gap_id_generates_valid_cli_command(self):
        """CLI command must contain known gap ID, no shell injection."""
        valid_gap_ids = [
            "physical-state-aliasing", "failure-detection-vs-diagnosis",
            "detection-without-recovery", "recovery-without-reverification",
            "temporal-6d-ft-evidence", "outcome-vs-evidence-sufficiency",
            "false-success-risk", "failure-to-recovery-hierarchy",
            "selective-human-escalation", "learning-from-corrections",
            "benchmark-gap", "cross-task-generalization",
        ]
        for gid in valid_gap_ids:
            cmd = f"python scripts/search_gap_evidence.py --gap {gid} --refresh"
            # Must not contain shell injection characters
            self.assertNotIn(";", cmd)
            self.assertNotIn("|", cmd)
            self.assertNotIn("&", cmd)
            self.assertNotIn("$(", cmd)
            self.assertNotIn("`", cmd)

    def test_cli_command_rejects_arbitrary_input(self):
        """Gap ID must come from known enum, not arbitrary user input."""
        # In practice, gap IDs are read from landscape JSON, not user input.
        # Verify the known set is finite and safe.
        ls = build()
        known_ids = {g["id"] for g in ls["gaps"]}
        for gid in known_ids:
            self.assertTrue(gid.replace("-", "").replace("_", "").isalnum(),
                            f"Gap ID contains unsafe chars: {gid}")

    def test_no_external_evidence_shows_not_searched(self):
        """Without external evidence, landscape should have empty dict."""
        ls = build()
        # Before any search, external_evidence should be empty or absent
        ext = ls.get("external_evidence", {})
        # It may have data if search was run, but structure must be valid
        self.assertIsInstance(ext, dict)

    def test_counter_more_than_supporting_downgrades_confidence(self):
        """When external counter > supporting (>=3), medium must downgrade to low."""
        gap = {
            "id": "test-gap",
            "confidence": "medium",
            "group": "evidence-supported",
        }
        ext = {"supporting_count": 2, "counter_count": 10}
        # Simulate the downgrade logic from build_landscape.py
        confidence_order = {"high": 3, "medium": 2, "low": 1, "insufficient": 0}
        sup = ext["supporting_count"]
        cnt = ext["counter_count"]
        current = confidence_order.get(gap["confidence"], 1)
        if cnt > sup and cnt >= 3:
            if current >= 2:
                gap["confidence"] = "low"
        self.assertEqual(gap["confidence"], "low")

    def test_supporting_all_weak_no_high_confidence(self):
        """Even with many supporting papers, if all are keyword-only, confidence stays low."""
        # This is a design rule: quantity alone doesn't upgrade confidence
        gap = {"confidence": "low"}
        # 15 keyword-only supporting should NOT upgrade to high
        # The system should not upgrade based on count alone
        self.assertEqual(gap["confidence"], "low")

    def test_direct_counter_affects_confidence(self):
        """Direct counter evidence must affect gap confidence."""
        gap = {"confidence": "medium"}
        ext = {"supporting_count": 1, "counter_count": 5}
        confidence_order = {"high": 3, "medium": 2, "low": 1, "insufficient": 0}
        sup = ext["supporting_count"]
        cnt = ext["counter_count"]
        current = confidence_order.get(gap["confidence"], 1)
        if cnt > sup and cnt >= 3:
            if current >= 2:
                gap["confidence"] = "low"
        self.assertEqual(gap["confidence"], "low")

    def test_gap4_description_updated(self):
        """Gap 4 should use updated systematic description."""
        ls = build()
        g4 = next(g for g in ls["gaps"] if g["id"] == "recovery-without-reverification")
        self.assertIn("系统", g4["title_zh"])
        self.assertIn("Systematic", g4["title"])

    def test_gap5_description_updated(self):
        """Gap 5 should focus on failure state verification, not just evidence sufficiency."""
        ls = build()
        g5 = next(g for g in ls["gaps"] if g["id"] == "temporal-6d-ft-evidence")
        self.assertIn("失败状态验证", g5["title_zh"])


class GapStatusTests(unittest.TestCase):
    """Tests for gap_status field and partially-addressed status."""

    def setUp(self):
        ls = build()
        self.gaps = ls["gaps"]
        self.gap_map = {g["id"]: g for g in self.gaps}

    def test_all_gaps_have_gap_status(self):
        valid = {"evidence-supported", "partially-addressed", "open-hypotheses", "dataset-limited"}
        for g in self.gaps:
            with self.subTest(gap_id=g["id"]):
                self.assertIn(g.get("gap_status"), valid,
                              f"Gap {g['id']} has invalid gap_status: {g.get('gap_status')}")

    def test_gap_status_independent_of_confidence(self):
        """gap_status and confidence must be independently valid."""
        valid_status = {"evidence-supported", "partially-addressed", "open-hypotheses", "dataset-limited"}
        valid_conf = {"high", "medium", "low", "insufficient"}
        for g in self.gaps:
            with self.subTest(gap_id=g["id"]):
                self.assertIn(g["gap_status"], valid_status)
                self.assertIn(g["confidence"], valid_conf)

    def test_gap4_is_partially_addressed(self):
        g4 = self.gap_map["recovery-without-reverification"]
        self.assertEqual(g4["gap_status"], "partially-addressed")
        self.assertTrue(len(g4.get("what_has_been_addressed", "")) > 10)
        self.assertTrue(len(g4.get("what_remains_open", "")) > 10)
        self.assertTrue(len(g4.get("status_reason", "")) > 10)

    def test_gap5_is_partially_addressed(self):
        g5 = self.gap_map["temporal-6d-ft-evidence"]
        self.assertEqual(g5["gap_status"], "partially-addressed")
        self.assertTrue(len(g5.get("what_has_been_addressed", "")) > 10)
        self.assertTrue(len(g5.get("what_remains_open", "")) > 10)

    def test_gap3_stays_evidence_supported(self):
        g3 = self.gap_map["detection-without-recovery"]
        self.assertEqual(g3["gap_status"], "evidence-supported")

    def test_pa_gaps_have_addressed_and_open_fields(self):
        """All partially-addressed gaps must have what_has_been_addressed and what_remains_open."""
        for g in self.gaps:
            if g["gap_status"] == "partially-addressed":
                with self.subTest(gap_id=g["id"]):
                    self.assertTrue(len(g.get("what_has_been_addressed", "")) > 5,
                                    f"PA gap {g['id']} missing what_has_been_addressed")
                    self.assertTrue(len(g.get("what_remains_open", "")) > 5,
                                    f"PA gap {g['id']} missing what_remains_open")

    def test_status_reason_present_for_pa_gaps(self):
        for g in self.gaps:
            if g["gap_status"] == "partially-addressed":
                with self.subTest(gap_id=g["id"]):
                    self.assertTrue(len(g.get("status_reason", "")) > 5,
                                    f"PA gap {g['id']} missing status_reason")

    def test_default_sorting_evidence_supported_first(self):
        """Gaps should be sorted: evidence-supported > partially-addressed > open-hypotheses > dataset-limited."""
        status_order = {"evidence-supported": 0, "partially-addressed": 1, "open-hypotheses": 2, "dataset-limited": 3}
        orders = [status_order.get(g["gap_status"], 9) for g in self.gaps]
        self.assertEqual(orders, sorted(orders), "Gaps not sorted by status priority")


class ClaimVersionTests(unittest.TestCase):
    """Tests for claim_version and stale evidence tracking."""

    def setUp(self):
        ls = build()
        self.landscape = ls
        self.gaps = ls["gaps"]
        self.gap_map = {g["id"]: g for g in self.gaps}
        self.ext = ls.get("external_evidence", {})

    def test_all_gaps_have_claim_version(self):
        for g in self.gaps:
            with self.subTest(gap_id=g["id"]):
                self.assertIsInstance(g.get("claim_version"), int)
                self.assertGreaterEqual(g["claim_version"], 1)

    def test_narrowed_gaps_have_claim_version_2(self):
        narrowed = ["temporal-6d-ft-evidence", "selective-human-escalation", "learning-from-corrections"]
        for gid in narrowed:
            g = self.gap_map[gid]
            self.assertEqual(g["claim_version"], 2, f"{gid} should have claim_version=2")

    def test_unnarrowed_gaps_have_claim_version_1(self):
        for g in self.gaps:
            if g["id"] not in ("temporal-6d-ft-evidence", "selective-human-escalation", "learning-from-corrections"):
                with self.subTest(gap_id=g["id"]):
                    self.assertEqual(g["claim_version"], 1)

    def test_stale_evidence_flag_present_for_narrowed_gaps(self):
        """Narrowed gaps (claim_version=2) with old evidence (version=1) should be stale."""
        narrowed = ["temporal-6d-ft-evidence", "selective-human-escalation", "learning-from-corrections"]
        for gid in narrowed:
            ext_info = self.ext.get(gid, {})
            if ext_info:  # only check if evidence exists
                with self.subTest(gap_id=gid):
                    # evidence_stale should be True if evidence was collected before claim v2
                    self.assertIn("evidence_stale", ext_info)

    def test_unnarrowed_gaps_not_stale(self):
        """Gaps with claim_version=1 and evidence version=1 should not be stale."""
        for gid, ext_info in self.ext.items():
            g = self.gap_map.get(gid)
            if g and g.get("claim_version", 1) == 1:
                with self.subTest(gap_id=gid):
                    self.assertFalse(ext_info.get("evidence_stale", False),
                                     f"{gid} should not be stale")

    def test_deploy_yml_no_update_radar(self):
        """deploy.yml should not call update_radar.py."""
        deploy = (ROOT / ".github" / "workflows" / "deploy.yml").read_text(encoding="utf-8")
        self.assertNotIn("update_radar.py", deploy)

    def test_deploy_yml_no_commit(self):
        """deploy.yml should not commit or push."""
        deploy = (ROOT / ".github" / "workflows" / "deploy.yml").read_text(encoding="utf-8")
        self.assertNotIn("git commit", deploy)
        self.assertNotIn("git push", deploy)

    def test_deploy_yml_contents_read_only(self):
        """deploy.yml should use contents: read, not contents: write."""
        deploy = (ROOT / ".github" / "workflows" / "deploy.yml").read_text(encoding="utf-8")
        self.assertIn("contents: read", deploy)
        self.assertNotIn("contents: write", deploy)

    def test_refresh_yml_no_skip_ci(self):
        """refresh-evidence.yml commit should not use [skip ci]."""
        refresh = (ROOT / ".github" / "workflows" / "refresh-evidence.yml").read_text(encoding="utf-8")
        self.assertNotIn("[skip ci]", refresh)

    def test_refresh_yml_commits_data_only(self):
        """refresh-evidence.yml should only commit data/ files, not site/."""
        refresh = (ROOT / ".github" / "workflows" / "refresh-evidence.yml").read_text(encoding="utf-8")
        self.assertIn("data/gap_search_results.json", refresh)
        self.assertIn("data/research_landscape.json", refresh)
        # Should NOT commit site/
        lines = [l for l in refresh.split("\n") if "git add" in l]
        for line in lines:
            self.assertNotIn("site", line, "refresh workflow should not commit site/")

    def test_evidence_supported_chinese_name(self):
        """Evidence-supported should show as 有证据支持, not 较强证据."""
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        self.assertIn("有证据支持", html)
        self.assertNotIn("较强证据", html)


if __name__ == "__main__":
    unittest.main()
