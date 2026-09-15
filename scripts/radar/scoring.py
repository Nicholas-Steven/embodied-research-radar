from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .schema import clean_paper


ROOT = Path(__file__).resolve().parents[2]


# --- Candidate Eligibility Gate (2026-09-15 filter tuning) -------------------
# A paper must show robot/embodied semantics (Anchor A) AND
# manipulation/interaction semantics (Anchor B) before it competes for a
# relevance score. Category alone (cs.RO) is NOT relevance proof — the audit
# found off-topic cs.RO papers. A small set of Strong Phrases can satisfy
# eligibility by themselves. Precision over recall: keep this list short.

ANCHOR_A_PATTERNS = [
    r"\brobot(s|ic|ics)?\b", r"\bmanipulator\b", r"\bgripper\b", r"\bdexterous\b",
    r"\bembodied\b", r"\bvision-language-action\b", r"\bVLA\b", r"\bhumanoid\b",
    r"\bend[- ]effector\b", r"\btactile sensor\b", r"\brobot arm\b",
]

ANCHOR_B_PATTERNS = [
    r"\bmanipulat(e|es|ed|ion|ing|ions)\b", r"\bgrasp(s|ing|ed)?\b", r"\btactile\b",
    r"\bhaptic\b", r"\bforce[- ]torque\b", r"\bforce/torque\b", r"\bcontact[- ]rich\b",
    r"\binsertion\b", r"\bassembly\b", r"\bfailure recovery\b", r"\breplanning\b",
    r"\bpeg[- ]in[- ]hole\b", r"\bin[- ]hand\b", r"\breach(ing)?\b",
    r"\bpick(ing|-and-place)?\b", r"\bpour(ing)?\b", r"\bcable\b.*\bmanipulat|\bdeformable\b",
]

STRONG_PHRASES = [
    r"robot(?:ic)? manipulation", r"dexterous manipulation", r"tactile manipulation",
    r"vision-language-action", r"contact-rich manipulation", r"force-controlled manipulation",
    r"force-aware manipulation", r"robotic grasping", r"vision-based manipulation",
    r"manipulation policy", r"dexterous hands?",
]

# Tier A categories (robotics/control): broad eligibility is acceptable.
TIER_A_CATEGORIES = {"cs.RO", "eess.SY", "cs.SY"}
# Tier B (ML/vision/language): require BOTH anchors, and the A-anchor must be
# robot-specific (a bare "robot mention" in a pure vision paper is not enough).
TIER_B_CATEGORIES = {"cs.AI", "cs.LG", "cs.CV", "cs.CL"}


def paper_categories(paper: dict[str, Any]) -> set[str]:
    cats: set[str] = set()
    for key in ("source_categories", "keywords"):
        for c in paper.get(key) or []:
            c = str(c).strip()
            if re.match(r"^[a-z-]+(\.[A-Z]{2,4})?$", c) and "." in c:
                cats.add(c)
    return cats


def is_radar_eligible(paper: dict[str, Any]) -> tuple[bool, str]:
    """Eligibility gate evaluated BEFORE scoring. Returns (eligible, reason)."""
    text = _text(paper)
    cats = paper_categories(paper)
    strong = next((pat for pat in STRONG_PHRASES if re.search(pat, text)), None)
    if strong:
        return True, f"strong phrase /{strong}/"
    tier_a = bool(cats & TIER_A_CATEGORIES)
    if not cats or tier_a:
        # Robotics-tier categories still need both anchors, but one good
        # anchor pair is enough; unknown-category records take the same path.
        has_a = any(re.search(p, text) for p in ANCHOR_A_PATTERNS)
        has_b = any(re.search(p, text) for p in ANCHOR_B_PATTERNS)
        if has_a and has_b:
            return True, "tier A: robot anchor + manipulation anchor"
        return False, "tier A missing anchor: " + ("no robot/embodied anchor" if not has_a else "no manipulation/interaction anchor")
    if cats & TIER_B_CATEGORIES:
        # Tier B: demand a robot anchor AND a manipulation anchor AND at
        # least one strong-ish compound (robot+manipulation word proximity
        # is approximated by requiring the manipulation anchor in text and
        # a robot anchor that is more specific than a lone "robot").
        specific_a = any(re.search(p, text) for p in [
            r"\bmanipulator\b", r"\bgripper\b", r"\bdexterous\b", r"\bembodied\b",
            r"\bvision-language-action\b", r"\bVLA\b", r"\bhumanoid\b", r"\brobot arm\b",
            r"\brobot(?:s|ic|ics)?\b",
        ])
        has_b = any(re.search(p, text) for p in ANCHOR_B_PATTERNS)
        robot_context = re.search(r"\brobot(?:s|ic|ics)?\b", text) and has_b
        if specific_a and has_b and robot_context:
            return True, "tier B: explicit robot-manipulation context"
        return False, "tier B insufficient robot-manipulation evidence"
    return False, f"categories outside radar scope: {sorted(cats)[:4]}"


def load_json(relative: str) -> dict[str, Any]:
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def _text(paper: dict[str, Any]) -> str:
    fields = [paper.get("title", ""), paper.get("abstract", ""), " ".join(paper.get("keywords", [])), " ".join(paper.get("methods", [])), " ".join(paper.get("tasks", []))]
    return " ".join(str(x) for x in fields).lower()


def score_paper(paper: dict[str, Any], scoring: dict[str, Any] | None = None) -> tuple[int, str]:
    """Four-layer score. Domain layers decide membership; resource metadata
    (code/dataset/real-robot) can only top up a paper that already shows
    domain relevance — it can NEVER create eligibility or compensate for a
    missing manipulation/robot signal (2026-09 audit finding)."""
    paper = clean_paper(paper)
    config = scoring or load_json("config/scoring.json")
    text = _text(paper)
    reasons: list[str] = []

    score = 0
    # vision-force / tactile signal
    if re.search(r"vision[-– ]?(?:force|torque)|force[-– ]?aware|force/torque|wrist force|6[- ]axis|force sensing", text):
        score += config["weights"]["vision_force"]
        reasons.append("明确涉及视觉–力/力矩或力觉传感")
    elif re.search(r"\btactile\b|\bhaptic\b", text):
        score += config["weights"]["vision_force"] // 2
        reasons.append("涉及触觉/力觉感知")
    # manipulation task signal
    if re.search(r"manipulat(e|es|ed|ion|ing|ions)|grasp(s|ing|ed)?|insertion|assembly|peg[- ]in[- ]hole|in[- ]hand|dexterous", text):
        score += config["weights"]["manipulation"]
        reasons.append("研究对象是机器人操作或接触任务")
    # state understanding
    if re.search(r"contact|state estimation|success prediction|slip|alignment|execution monitoring|progress estimation", text):
        score += config["weights"]["state_understanding"]
        reasons.append("包含接触、滑移、状态或成功判断信号")
    # failure & recovery
    if re.search(r"failure|recover|replan|retry|corrective|residual", text):
        score += config["weights"]["failure_recovery"]
        reasons.append("涉及失败、恢复、重规划或纠偏")

    # Layer 2 — Method Relevance (bonus only; cannot establish relevance alone)
    if re.search(r"reinforcement learning|imitation learning|behavior cloning|policy learning", text):
        score += config["method"]["learning_methods"]
        reasons.append("策略学习方法（RL/模仿/BC）")
    if re.search(r"diffusion policy|flow matching|action chunking|generative (?:robot )?policy", text):
        score += config["method"]["generative_policy"]
        reasons.append("生成式策略方法")

    # Layer 3 — Research Theme bonus
    for pattern, key, reason in [
        (r"6[- ]axis|six[- ]axis|wrench|force/torque", "six_axis_ft", "包含六维力/力矩或wrench信号"),
        (r"rgb[- ]?d|depth|realsense", "rgbd", "包含RGB-D/深度视觉"),
        (r"contact[- ]rich|contact-aware", "contact_rich", "直接面向接触丰富任务"),
    ]:
        if re.search(pattern, text):
            score += config["theme_bonus"][key]
            reasons.append(reason)

    # Layer 4 — Resource/Quality metadata (small cap; never decisive)
    if re.search(r"real[- ]world|real robot|hardware", text):
        score += config["resource_metadata"]["real_robot"]
        reasons.append("有真实机器人实验线索")
    if re.search(r"github|open[- ]source|code (?:is |be(?:en|ing) )?released", text):
        score += config["resource_metadata"]["open_code"]
        reasons.append("有公开代码线索")
    if re.search(r"\bdataset\b|\bbenchmark\b", text):
        score += config["resource_metadata"]["dataset_benchmark"]
        reasons.append("提供数据集或基准")

    exclude_terms = load_json("config/queries.json").get("exclude_terms", [])
    excluded = [term for term in exclude_terms if term in text]
    if excluded:
        score -= config["penalty"]
        reasons.append("出现非机器人操作语境词：" + ", ".join(excluded))
    score = max(0, min(100, score))
    return score, "；".join(dict.fromkeys(reasons)) or "当前仅有有限主题信号，建议人工复核。"


def infer_topics(paper: dict[str, Any], topics: dict[str, Any] | None = None) -> list[str]:
    """Topic assignment by explicit semantic evidence only.

    No fallback bucket: a paper without evidence for a specific topic gets
    ["core-papers"] (the neutral list membership). vla-manipulation in
    particular requires actual VLA/vision-language-action semantics —
    generic RL/policy/benchmark words are NOT evidence (2026-09 audit:
    382/466 backfill papers were dumped into vla-manipulation by the old
    fallback).
    """
    paper = clean_paper(paper)
    config = topics or load_json("config/topics.json")
    text = _text(paper)
    matched: list[str] = []
    for topic in config["topics"]:
        if topic["id"] == "core-papers":
            continue
        if any(keyword.lower() in text for keyword in topic.get("keywords", [])):
            matched.append(topic["id"])
    # vla-manipulation needs explicit VLA-family evidence; the topic keyword
    # list alone is too loose ("imitation learning" matches generic papers).
    vla_evidence = re.search(r"vision-language-action|\bVLA\b|vision-language[- ]model|foundation model for robot|language-conditioned (?:action|policy)", text)
    if not vla_evidence and "vla-manipulation" in matched:
        matched.remove("vla-manipulation")
    return matched or ["core-papers"]


def enrich_score_and_topics(paper: dict[str, Any]) -> dict[str, Any]:
    result = clean_paper(paper)
    score, reason = score_paper(result)
    result["relevance_score"] = score
    result["relevance_reason"] = reason
    result["research_topics"] = result["research_topics"] or infer_topics(result)
    result["research_topics"] = list(dict.fromkeys(result["research_topics"]))
    result["core_candidate"] = result.get("core_candidate") or ("Yes" if score >= 80 else "Review" if score >= 60 else "No")
    result["potential_competition"] = bool(score >= 82 and any(x in result["research_topics"] for x in ("vision-force", "failure-understanding", "failure-recovery")))
    if result["potential_competition"] and not result.get("competition_reason"):
        result["competition_reason"] = "主题、传感器或闭环恢复机制与当前视觉–力觉研究规划存在明显交集；需要逐篇核对任务、平台和实验范围。"
    return result
