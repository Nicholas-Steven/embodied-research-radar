import json
import unittest
from pathlib import Path

from scripts.radar.schema import clean_paper, normalize_arxiv_id, normalize_title, validate_collection
from scripts.radar.scoring import score_paper


ROOT = Path(__file__).resolve().parents[1]


class SchemaTests(unittest.TestCase):
    def test_normalize_arxiv_versions(self):
        self.assertEqual(normalize_arxiv_id("https://arxiv.org/abs/2411.15753v2"), "2411.15753")
        self.assertEqual(normalize_arxiv_id("arXiv:2303.04137"), "2303.04137")

    def test_normalize_title(self):
        self.assertEqual(normalize_title("FoAR: Force-Aware  Policy!"), "foar force aware policy")

    def test_demo_collection_is_valid(self):
        papers = json.loads((ROOT / "data/demo_papers.json").read_text(encoding="utf-8"))
        cleaned = [clean_paper(item) for item in papers]
        self.assertEqual(validate_collection(cleaned), [])

    def test_force_paper_scores_above_generic_background(self):
        papers = json.loads((ROOT / "data/demo_papers.json").read_text(encoding="utf-8"))
        force = next(p for p in papers if p["arxiv_id"] == "2411.15753")
        background = next(p for p in papers if p["arxiv_id"] == "2212.06817")
        self.assertGreater(score_paper(force)[0], score_paper(background)[0])


if __name__ == "__main__":
    unittest.main()
