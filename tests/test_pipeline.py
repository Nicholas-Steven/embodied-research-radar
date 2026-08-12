import json
import tempfile
import unittest
from pathlib import Path

from scripts.radar.pipeline import deduplicate, select_relevant
from scripts.radar.schema import clean_paper


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.base = json.loads(Path("data/demo_papers.json").read_text(encoding="utf-8"))[0]

    def test_deduplicate_arxiv_and_title(self):
        duplicate = dict(self.base)
        duplicate["arxiv_id"] = "2411.15753v2"
        duplicate["paper_id"] = "different-id"
        result = deduplicate([self.base, duplicate])
        self.assertEqual(len(result), 1)

    def test_select_relevant(self):
        papers = [clean_paper({**self.base, "paper_id": "a", "relevance_score": 20}), clean_paper({**self.base, "paper_id": "b", "arxiv_id": "2411.15754", "relevance_score": 70})]
        self.assertEqual([p["paper_id"] for p in select_relevant(papers, 50)], ["b"])


if __name__ == "__main__":
    unittest.main()
