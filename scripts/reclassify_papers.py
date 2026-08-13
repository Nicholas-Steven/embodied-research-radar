"""One-off migration: recompute research_branches for existing papers.

Does not re-download anything from arXiv. Manual overrides
(branch_override / manual_research_branches) are preserved.
"""

from __future__ import annotations

import json
from pathlib import Path

from radar.branches import load_branches, reclassify

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data/papers.json"


def main() -> int:
    if not DATA_PATH.exists():
        print(f"{DATA_PATH} not found; nothing to migrate")
        return 0
    payload = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    papers = payload.get("papers", [])
    branches = load_branches()
    changed = 0
    for paper in papers:
        before = list(paper.get("research_branches") or [])
        reclassify(paper, branches)
        after = list(paper.get("research_branches") or [])
        if before != after:
            changed += 1
    DATA_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"reclassified {len(papers)} papers, {changed} changed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
