"""Research Branch classification.

Level 1 research branches are the single source of truth for the left
sidebar navigation. Papers additionally carry fine-grained Level 2 tags
(research_topics / methods / tasks / sensors) which are never promoted to
new sidebar entries.

Classification priority:
    manual override (branch_override / manual_research_branches)
    > explicit research_topics that match a branch id
    > alias rule matching over tags / keywords / tasks / sensors
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]


def load_branches(path: Path | None = None) -> dict[str, dict[str, Any]]:
    """Return {branch_id: {"name_zh","name_en","aliases":[...]}} from config/topics.json."""
    path = path or ROOT / "config/topics.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    branches: dict[str, dict[str, Any]] = {}
    for topic in data.get("topics", []):
        if topic.get("id") == "core-papers":
            continue
        branches[topic["id"]] = {
            "name_zh": topic.get("label_zh", topic["id"]),
            "name_en": topic.get("label", topic["id"]),
            "aliases": [str(a).lower() for a in (topic.get("aliases") or []) if str(a).strip()],
        }
    return branches


def classify_research_branches(paper: dict[str, Any], branches: dict[str, dict[str, Any]]) -> list[str]:
    """Return the ordered list of Level 1 branch ids for a paper."""
    # 1. Manual override wins and is never overwritten by daily updates.
    manual = paper.get("branch_override") or paper.get("manual_research_branches")
    if manual:
        picked = [str(x).strip() for x in (manual if isinstance(manual, list) else [manual])]
        return [b for b in picked if b in branches]

    result: list[str] = []
    # 2. Explicit research_topics that already use branch ids.
    for topic in paper.get("research_topics") or []:
        if topic in branches and topic not in result:
            result.append(topic)

    # 3. Rule mapping: match branch aliases against the paper's tags/keywords.
    haystack = " ".join(
        str(x).lower()
        for x in [
            *(paper.get("research_topics") or []),
            *(paper.get("methods") or []),
            *(paper.get("keywords") or []),
            *(paper.get("tasks") or []),
            *(paper.get("sensors") or []),
            paper.get("title") or "",
        ]
    )
    for branch_id, conf in branches.items():
        if branch_id in result:
            continue
        if any(alias in haystack for alias in conf["aliases"]):
            result.append(branch_id)
    return result


def reclassify(paper: dict[str, Any], branches: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Recompute research_branches on a paper in place, preserving manual override."""
    computed = classify_research_branches(paper, branches)
    if computed:
        paper["research_branches"] = computed
    return paper
