from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .schema import clean_paper


ROOT = Path(__file__).resolve().parents[2]


def load_json(relative: str) -> dict[str, Any]:
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def _text(paper: dict[str, Any]) -> str:
    fields = [paper.get("title", ""), paper.get("abstract", ""), " ".join(paper.get("keywords", [])), " ".join(paper.get("methods", [])), " ".join(paper.get("tasks", []))]
    return " ".join(str(x) for x in fields).lower()


def score_paper(paper: dict[str, Any], scoring: dict[str, Any] | None = None) -> tuple[int, str]:
    paper = clean_paper(paper)
    config = scoring or load_json("config/scoring.json")
    text = _text(paper)
    weights = config["weights"]
    terms = {
        "vision_force": (r"vision[-– ]?(?:force|torque)|force[-– ]?aware|force/torque|wrist force|6[- ]axis", weights["vision_force"]),
        "manipulation": (r"manipulat|robotic|robot arm|grasp|insertion|assembly|peg[- ]in[- ]hole", weights["manipulation"]),
        "state_understanding": (r"contact|state estimation|success prediction|progress|monitor|slip|alignment", weights["state_understanding"]),
        "failure_recovery": (r"failure|recover|replan|retry|corrective|residual", weights["failure_recovery"]),
        "method_signal": (r"transformer|diffusion|flow matching|cross[- ]attention|imitation|reinforcement learning|policy", weights["method_signal"]),
        "direct_reproduction": (r"real[- ]world|real robot|open[- ]source|github|code|dataset|benchmark", weights["direct_reproduction"]),
    }
    score = 0
    reasons: list[str] = []
    for label, (pattern, points) in terms.items():
        if re.search(pattern, text):
            score += points
            reasons.append({
                "vision_force": "明确涉及视觉–力/力矩或接触反馈",
                "manipulation": "研究对象是机器人操作或接触任务",
                "state_understanding": "包含接触、滑移、状态或成功判断信号",
                "failure_recovery": "涉及失败、恢复、重规划或纠偏",
                "method_signal": "方法包含可迁移的策略学习或多模态建模",
                "direct_reproduction": "具有真实机器人、公开代码或可复现资源线索",
            }[label])
    for pattern, points, reason in [
        (r"6[- ]axis|six[- ]axis|wrench|force/torque", config["bonuses"]["six_axis_ft"], "包含六维力/力矩或wrench信号"),
        (r"rgb[- ]?d|depth|realsense", config["bonuses"]["rgbd"], "包含RGB-D/深度视觉"),
        (r"real[- ]world|real robot|hardware", config["bonuses"]["real_robot"], "有真实机器人实验线索"),
        (r"github|open[- ]source|code released", config["bonuses"]["open_code"], "有公开代码或资源线索"),
        (r"contact[- ]rich|contact-aware|insertion|assembly|peg[- ]in[- ]hole", config["bonuses"]["contact_rich"], "直接面向接触丰富任务"),
    ]:
        if re.search(pattern, text):
            score += points
            reasons.append(reason)
    exclude_terms = load_json("config/queries.json").get("exclude_terms", [])
    excluded = [term for term in exclude_terms if term in text]
    if excluded:
        score -= config["penalty"]
        reasons.append("出现非机器人操作语境词：" + ", ".join(excluded))
    score = max(0, min(100, score))
    return score, "；".join(dict.fromkeys(reasons)) or "当前仅有有限主题信号，建议人工复核。"


def infer_topics(paper: dict[str, Any], topics: dict[str, Any] | None = None) -> list[str]:
    paper = clean_paper(paper)
    config = topics or load_json("config/topics.json")
    text = _text(paper)
    matched: list[str] = []
    for topic in config["topics"]:
        if topic["id"] == "core-papers":
            continue
        if any(keyword.lower() in text for keyword in topic.get("keywords", [])):
            matched.append(topic["id"])
    return matched or ["vla-manipulation"] if re.search(r"robot|manipulat|policy", text) else ["core-papers"]


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
