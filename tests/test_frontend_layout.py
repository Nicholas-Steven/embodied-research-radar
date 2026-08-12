import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class FrontendLayoutTests(unittest.TestCase):
    def test_spotlight_heading_and_list_share_left_column(self):
        html = (ROOT / "web/index.html").read_text(encoding="utf-8")
        self.assertIn('<div class="spotlight-column">', html)
        self.assertIn('<div class="spotlight-list" id="spotlight-list"></div>', html)
        self.assertLess(html.index('<div class="spotlight-column">'), html.index('<aside class="insight-card">'))


if __name__ == "__main__":
    unittest.main()
