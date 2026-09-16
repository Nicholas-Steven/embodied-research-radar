"""Image enrichment tests — 2026-09-15.

Covers:
- OAI-ingested papers go through the same image enrichment
- image enrichment failure never drops a paper (optional enrichment)
- image-only backfill must not touch score/topic/published/paper_id
- existing images are not overwritten
"""

import json
import unittest
from unittest import mock

from scripts.radar import pipeline
from scripts.radar.fetch_health import FetchHealth
from scripts.radar.schema import clean_paper


def _paper(pid, arxiv_id, with_image=False, **extra):
    p = clean_paper({"arxiv_id": arxiv_id, "title": f"Tactile Grasping Policy {arxiv_id}",
                     "abstract": "Tactile sensing for contact-rich robot grasping and manipulation.",
                     "keywords": ["cs.RO"], "source_categories": ["cs.RO"],
                     "published_date": "2026-09-12",
                     "relevance_score": 70, "relevance_reason": "test",
                     "research_topics": ["core-papers"], **extra})
    if with_image:
        p["image"] = f"https://arxiv.org/html/{arxiv_id}v1/old.png"
    return p


class ImageEnrichmentTests(unittest.TestCase):
    def _run(self, existing, incoming, fetch_figure):
        """Drive pipeline.run with mocked fetch + figure extraction."""
        existing_c = [clean_paper(p) for p in existing]
        incoming_c = [clean_paper(p) for p in incoming]
        health = FetchHealth(source="test", requests_attempted=1, requests_succeeded=1,
                             oai_raw_records=len(incoming_c), records_after_dedupe=len(incoming_c),
                             relevant_records=len(incoming_c), new_records=len(incoming_c))
        with mock.patch.object(pipeline, "load_json", side_effect=lambda path, default=None: ({"papers": existing_c} if path == pipeline.DATA_PATH else default)), \
             mock.patch.object(pipeline, "fetch_candidates", return_value=(incoming_c, health)), \
             mock.patch.object(pipeline, "fetch_method_figure", side_effect=fetch_figure), \
             mock.patch("pathlib.Path.write_text"), mock.patch("pathlib.Path.replace"), \
             mock.patch.dict("os.environ", {"ARXIV_FIGURE_FETCH_LIMIT": "5"}):
            payload, _ = pipeline.run(fetch=True, threshold=45, with_ai=False)
        return payload

    def test_oai_paper_gets_image_enrichment(self):
        """A paper with no image entering via the (mocked) fetch path gets one."""
        payload = self._run([], [_paper("arxiv-2609-00001", "2609.00001")],
                           lambda aid: {"url": f"https://arxiv.org/html/{aid}v1/fig.png", "caption": "Method"})
        p = next(p for p in payload["papers"] if p["arxiv_id"] == "2609.00001")
        self.assertEqual(p["image"], "https://arxiv.org/html/2609.00001v1/fig.png")
        self.assertEqual(p["image_caption"], "Method")

    def test_figure_failure_keeps_paper(self):
        """Image extraction raising must NOT drop the paper (optional enrichment)."""
        def boom(aid):
            raise RuntimeError("network down")
        payload = self._run([], [_paper("arxiv-2609-00002", "2609.00002")], boom)
        p = next(p for p in payload["papers"] if p["arxiv_id"] == "2609.00002")
        self.assertFalse(p.get("image"), "failed enrichment leaves image empty")
        self.assertIn("arxiv-2609-00002", {q["paper_id"] for q in payload["papers"]})

    def test_no_figure_found_keeps_paper_empty_image(self):
        payload = self._run([], [_paper("arxiv-2609-00003", "2609.00003")], lambda aid: {})
        p = next(p for p in payload["papers"] if p["arxiv_id"] == "2609.00003")
        self.assertFalse(p.get("image"))

    def test_existing_image_not_overwritten(self):
        """Backfill probes only papers WITHOUT an image; existing images stay."""
        calls = []
        def spy(aid):
            calls.append(aid)
            return {"url": "https://arxiv.org/html/new.png", "caption": ""}
        payload = self._run([], [_paper("arxiv-2609-00004", "2609.00004", with_image=True)], spy)
        p = next(p for p in payload["papers"] if p["arxiv_id"] == "2609.00004")
        self.assertEqual(p["image"], "https://arxiv.org/html/2609.00004v1/old.png")
        self.assertNotIn("2609.00004", calls, "paper with an image must not be re-probed")

    def test_backfill_covers_older_papers_missing_images(self):
        """A paper already in the dataset but image-less gets probed too
        (the 2026-09-11..14 coverage hole)."""
        old = _paper("arxiv-2609-00005", "2609.00005")
        payload = self._run([old], [_paper("arxiv-2609-00006", "2609.00006")],
                            lambda aid: {"url": f"https://arxiv.org/html/{aid}v1/x.png", "caption": ""})
        imgs = {p["arxiv_id"]: p.get("image") for p in payload["papers"]}
        self.assertTrue(imgs["2609.00005"], "older image-less paper is backfilled")
        self.assertTrue(imgs["2609.00006"])

    def test_backfill_only_touches_image_fields(self):
        """Image backfill semantics: score/topic/published/paper_id untouched."""
        old = _paper("arxiv-2609-00007", "2609.00007")
        snapshot = {k: old[k] for k in ("paper_id", "relevance_score", "research_topics", "published_date")}
        payload = self._run([old], [], lambda aid: {"url": "https://arxiv.org/html/x.png", "caption": ""})
        p = next(q for q in payload["papers"] if q["arxiv_id"] == "2609.00007")
        for k, v in snapshot.items():
            self.assertEqual(p[k], v, f"backfill must not modify {k}")
        self.assertTrue(p["image"])


if __name__ == "__main__":
    unittest.main()
