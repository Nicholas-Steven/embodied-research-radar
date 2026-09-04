#!/usr/bin/env python3
"""Generate research_landscape.json from papers.json and topics.json.

Produces cross-paper statistics, evidence classification, pipeline mapping,
maturity assessment, research gaps, and research directions for the
"Vision-Force Fusion in Failure Understanding & Recovery" landscape page.

Requires only Python standard library.  LLM is NOT used — all analysis is
rule-based over structured fields (title, abstract, keywords, sensors, methods,
research_topics) with regex pattern matching.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PAPERS_PATH = ROOT / "data" / "papers.json"
TOPICS_PATH = ROOT / "config" / "topics.json"
OUTPUT_PATH = ROOT / "data" / "research_landscape.json"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _read_json(path: Path, fallback: Any = None) -> Any:
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def _text(paper: dict[str, Any]) -> str:
    """Concatenate key text fields for regex matching (same as scoring.py)."""
    parts = [
        paper.get("title", ""),
        paper.get("abstract", ""),
        paper.get("abstract_zh", ""),
        " ".join(paper.get("keywords", [])),
        " ".join(paper.get("methods", [])),
        " ".join(paper.get("tasks", [])),
    ]
    return " ".join(str(x) for x in parts).lower()


# ---------------------------------------------------------------------------
# Signal detectors
# ---------------------------------------------------------------------------

_VF_RE = re.compile(
    r"vision[-– ]?(?:force|torque)|force[-– ]?aware|force/torque|wrist force|"
    r"6[- ]axis|visuotactile|tactile.*visual|visual.*tactile|contact.rich|"
    r"force.sensing|contact.state|contact-aware", re.I
)
_FORCE_SENSOR_RE = re.compile(
    r"force.torque|6.axis|six.axis|wrench|f.t sensor|force.sensing|"
    r"tactile|visuotactile|contact.rich|contact-aware|high.frequency.*f", re.I
)
_CONTACT_RE = re.compile(
    r"contact.state|contact.rich|contact-aware|contact.detect|slip.detect|"
    r"alignment|insertion|peg.in.hole|assembly", re.I
)
_FAILURE_DETECT_RE = re.compile(
    r"failure.detect|anomaly.detect|success.predict|task.success|"
    r"progress.estim|execution.monitor|outcome.verif|state.verif|"
    r"runtime.monitor|error.detect", re.I
)
_FAILURE_DIAG_RE = re.compile(
    r"diagnos|root.cause|failure.mode|failure.type|failure.reason|"
    r"classif.*failure|failure.*classif|categoriz.*failure", re.I
)
_RECOVERY_RE = re.compile(
    r"recover|replan|retry|correct|re.execut|re.grasp|re.attempt|"
    r"error.recover|failure.recover|resilien", re.I
)
_CLOSED_LOOP_RE = re.compile(
    r"closed.loop|feedback.loop|reactive|adaptive.*control|online.*adjust|"
    r"re.verif|post.recover", re.I
)
_REVERIFY_RE = re.compile(
    r"re.verif|re.check|post.recover|after.recover|verify.*after|"
    r"success.*after.*recover|re.eval", re.I
)
_MULTIMODAL_REP_RE = re.compile(
    r"multimodal.*represent|cross.modal|modal.*fusion|feature.*fusion|"
    r"representation.learn|embedding.*multi", re.I
)
_OUTCOME_PRED_RE = re.compile(
    r"outcome.predict|success.predict|task.progress|progress.estim|"
    r"completion.*predict", re.I
)
_UNCERTAINTY_RE = re.compile(
    r"uncertainty|confidence.estim|calibrat|probabilis|bayes|evidential", re.I
)
_HITL_RE = re.compile(
    r"human.in.the.loop|human.intervention|selective.intervention|"
    r"human.escalation|uncertainty.*human.intervention|robot.*ask.*help|"
    r"human.assistance.request|hil.rl|hil.rl", re.I
)
_CROSS_TASK_RE = re.compile(
    r"cross.task|cross.object|cross.robot|generaliz|transfer|"
    r"domain.adapt|multi.task|few.shot", re.I
)
_BENCHMARK_RE = re.compile(
    r"benchmark|evaluation.*suite|unified.*eval|standard.*eval|"
    r"test.*bed|eval.*protocol", re.I
)


def has_vf_signal(paper: dict) -> bool:
    return bool(_VF_RE.search(_text(paper)))

def has_force_sensor(paper: dict) -> bool:
    sensors = " ".join(s.lower() for s in paper.get("sensors", []))
    return bool(_FORCE_SENSOR_RE.search(sensors) or _FORCE_SENSOR_RE.search(_text(paper)))

def has_failure_detect(paper: dict) -> bool:
    return bool(_FAILURE_DETECT_RE.search(_text(paper)))

def has_failure_diag(paper: dict) -> bool:
    return bool(_FAILURE_DIAG_RE.search(_text(paper)))

def has_recovery(paper: dict) -> bool:
    return bool(_RECOVERY_RE.search(_text(paper)))

def has_closed_loop(paper: dict) -> bool:
    return bool(_CLOSED_LOOP_RE.search(_text(paper)))

def has_reverify(paper: dict) -> bool:
    return bool(_REVERIFY_RE.search(_text(paper)))


# ---------------------------------------------------------------------------
# Evidence classification
# ---------------------------------------------------------------------------

def classify_evidence(paper: dict) -> str:
    """Return 'direct' / 'related' / 'background' / 'none'."""
    topics = set(paper.get("research_topics", []))
    text = _text(paper)

    has_vf_topic = "vision-force" in topics
    has_failure_topic = bool(topics & {"failure-understanding", "failure-recovery"})

    vf_signal = has_vf_signal(paper)
    force_sensor = has_force_sensor(paper)
    contact_signal = bool(_CONTACT_RE.search(text))
    failure_signal = bool(_FAILURE_DETECT_RE.search(text) or _RECOVERY_RE.search(text))

    # DIRECT: must have BOTH vf and failure topics/signals, plus force/tactile evidence.
    # A paper with VF topic but no failure topic can never be "direct".
    if has_failure_topic and (has_vf_topic or vf_signal) and (force_sensor or contact_signal):
        return "direct"

    # RELATED: failure topic + force/contact signals, but NOT vision-force topic
    if has_failure_topic and (force_sensor or contact_signal) and not has_vf_topic:
        return "related"

    # BACKGROUND: vision-force topic + failure-adjacent signals (but no failure topic)
    if has_vf_topic and failure_signal:
        return "background"

    return "none"


# ---------------------------------------------------------------------------
# Pipeline stage mapping
# ---------------------------------------------------------------------------

PIPELINE_STAGES = [
    {
        "id": "perception",
        "label": "Multimodal Perception",
        "label_zh": "多模态感知",
        "description": "视觉、力觉、触觉等传感器信号的获取与初步处理",
        "matchers": [
            re.compile(r"vision|visual|camera|rgb|depth|force.sensing|tactile|sensor.fusion|perception", re.I),
        ],
    },
    {
        "id": "representation",
        "label": "Multimodal Representation",
        "label_zh": "多模态表示",
        "description": "将多源传感器数据编码为可用于决策的特征表示",
        "matchers": [
            re.compile(r"multimodal.*represent|cross.modal|feature.*fusion|embedding|representation.learn|encode|latent", re.I),
        ],
    },
    {
        "id": "contact_state",
        "label": "Physical / Contact State",
        "label_zh": "物理/接触状态",
        "description": "估计接触发生时机、接触力分布、滑移和对齐状态",
        "matchers": [
            re.compile(r"contact.state|contact.detect|slip.detect|alignment|insertion|peg.in.hole|force.estim|wrench|contact.rich", re.I),
        ],
    },
    {
        "id": "outcome_verification",
        "label": "Outcome Verification",
        "label_zh": "结果验证",
        "description": "判断任务步骤是否成功完成",
        "matchers": [
            re.compile(r"success.predict|outcome.verif|task.success|progress.estim|completion|state.verif", re.I),
        ],
    },
    {
        "id": "failure_detection",
        "label": "Failure Detection",
        "label_zh": "失败检测",
        "description": "实时识别操作过程中的异常与失败",
        "matchers": [
            re.compile(r"failure.detect|anomaly.detect|error.detect|runtime.monitor|execution.monitor", re.I),
        ],
    },
    {
        "id": "failure_diagnosis",
        "label": "Failure Diagnosis",
        "label_zh": "失败诊断",
        "description": "分析失败原因、模式和类型",
        "matchers": [
            re.compile(r"diagnos|root.cause|failure.mode|failure.type|failure.reason|failure.classif", re.I),
        ],
    },
    {
        "id": "recovery_selection",
        "label": "Recovery Selection",
        "label_zh": "恢复策略选择",
        "description": "根据失败类型选择合适的恢复策略",
        "matchers": [
            re.compile(r"recovery.*select|policy.*select|strategy.*select|replan|retry.*select|recovery.policy", re.I),
        ],
    },
    {
        "id": "recovery_action",
        "label": "Recovery Action",
        "label_zh": "恢复动作",
        "description": "执行恢复动作，包括重试、纠偏和重规划",
        "matchers": [
            re.compile(r"recover|correct|re.execut|re.grasp|re.attempt|error.recover|resilien|replan|retry", re.I),
        ],
    },
    {
        "id": "reverification",
        "label": "Re-verification",
        "label_zh": "恢复后验证",
        "description": "恢复动作后验证任务是否真正成功",
        "matchers": [
            re.compile(r"re.verif|re.check|post.recover|after.recover|verify.*after|re.eval|closed.loop", re.I),
        ],
    },
]


def map_paper_to_stages(paper: dict) -> list[str]:
    text = _text(paper)
    stages = []
    for stage in PIPELINE_STAGES:
        for matcher in stage["matchers"]:
            if matcher.search(text):
                stages.append(stage["id"])
                break
    return stages


# ---------------------------------------------------------------------------
# Maturity assessment
# ---------------------------------------------------------------------------

MATURITY_LEVELS = ["Emerging", "Developing", "Moderate", "Relatively Mature"]

MATURITY_DIMENSIONS = [
    {
        "id": "vf_fusion",
        "label": "视觉力觉融合",
        "label_en": "Vision-Force Fusion",
        "vf_topic": True,
        "signals": [_VF_RE],
    },
    {
        "id": "contact_state",
        "label": "接触状态估计",
        "label_en": "Contact State Estimation",
        "vf_topic": True,
        "signals": [_CONTACT_RE],
    },
    {
        "id": "outcome_pred",
        "label": "任务成功预测",
        "label_en": "Task Success Prediction",
        "failure_topic": True,
        "signals": [_OUTCOME_PRED_RE],
    },
    {
        "id": "failure_detect",
        "label": "失败检测",
        "label_en": "Failure Detection",
        "failure_topic": True,
        "signals": [_FAILURE_DETECT_RE],
    },
    {
        "id": "failure_class",
        "label": "失败分类",
        "label_en": "Failure Classification",
        "failure_topic": True,
        "signals": [re.compile(r"failure.*class|classif.*failure|failure.*type|failure.*categor", re.I)],
    },
    {
        "id": "failure_diag",
        "label": "失败原因诊断",
        "label_en": "Failure Diagnosis",
        "failure_topic": True,
        "signals": [_FAILURE_DIAG_RE],
    },
    {
        "id": "recovery_select",
        "label": "恢复策略选择",
        "label_en": "Recovery Strategy Selection",
        "failure_topic": True,
        "signals": [re.compile(r"recovery.*select|policy.*select|strategy.*select|recovery.policy", re.I)],
    },
    {
        "id": "recovery_action",
        "label": "恢复动作生成",
        "label_en": "Recovery Action Generation",
        "failure_topic": True,
        "signals": [re.compile(r"recover|correct|re.execut|re.grasp|re.attempt|error.recover", re.I)],
    },
    {
        "id": "closed_loop",
        "label": "闭环恢复",
        "label_en": "Closed-loop Recovery",
        "signals": [re.compile(r"closed.loop.*recover|recover.*closed.loop|feedback.*recover|reactive.*recover", re.I)],
    },
    {
        "id": "reverify",
        "label": "恢复后重新验证",
        "label_en": "Post-Recovery Re-verification",
        "signals": [_REVERIFY_RE],
    },
    {
        "id": "uncertainty",
        "label": "不确定性估计",
        "label_en": "Uncertainty Estimation",
        "signals": [_UNCERTAINTY_RE],
    },
    {
        "id": "hitl",
        "label": "人在环升级",
        "label_en": "Human-in-the-Loop Escalation",
        "signals": [_HITL_RE],
    },
    {
        "id": "cross_task",
        "label": "真实机器人跨任务泛化",
        "label_en": "Cross-task Generalization (Real Robot)",
        "signals": [_CROSS_TASK_RE, re.compile(r"real.robot|real.world|hardware", re.I)],
    },
]


def assess_maturity(papers: list[dict], dimension: dict) -> dict:
    """Assess maturity for one dimension based on evidence volume and quality."""
    text = " ".join(d.lower() for d in [dimension.get("label", ""), dimension.get("label_en", "")])
    matching = []
    for p in papers:
        t = _text(p)
        topics = set(p.get("research_topics", []))
        # Topic pre-filter if specified
        if dimension.get("vf_topic") and "vision-force" not in topics:
            continue
        if dimension.get("failure_topic") and not (topics & {"failure-understanding", "failure-recovery"}):
            continue
        for sig in dimension["signals"]:
            if sig.search(t):
                matching.append(p["paper_id"])
                break

    count = len(matching)
    # Heuristic maturity mapping
    if count == 0:
        level = "Emerging"
    elif count <= 2:
        level = "Emerging"
    elif count <= 5:
        level = "Developing"
    elif count <= 12:
        level = "Moderate"
    else:
        level = "Relatively Mature"

    # Force down if no topic-specific papers
    if dimension.get("vf_topic") and count <= 1:
        level = "Emerging"

    return {
        "id": dimension["id"],
        "label": dimension["label"],
        "label_en": dimension["label_en"],
        "level": level,
        "paper_count": count,
        "paper_ids": matching[:10],  # cap for JSON size
    }


# ---------------------------------------------------------------------------
# Research Gap analysis
# ---------------------------------------------------------------------------

def _build_gap(
    gap_id: str,
    title: str,
    title_zh: str,
    question: str,
    current_progress: str,
    missing_piece: str,
    why_it_matters: str,
    supporting_ids: list[str],
    counter_ids: list[str],
    confidence: str,
    research_opportunity: str,
    claim_type: str = "evidence-based-inference",
    group: str = "evidence-supported",
    gap_status: str = "",
    what_has_been_addressed: str = "",
    what_remains_open: str = "",
    status_reason: str = "",
    claim_version: int = 1,
) -> dict[str, Any]:
    if not gap_status:
        gap_status = group
    return {
        "id": gap_id,
        "title": title,
        "title_zh": title_zh,
        "question": question,
        "claim_type": claim_type,
        "group": group,
        "gap_status": gap_status,
        "what_has_been_addressed": what_has_been_addressed,
        "what_remains_open": what_remains_open,
        "status_reason": status_reason,
        "current_progress": current_progress,
        "missing_piece": missing_piece,
        "why_it_matters": why_it_matters,
        "supporting_paper_ids": supporting_ids,
        "counter_paper_ids": counter_ids,
        "confidence": confidence,  # high / medium / low / insufficient
        "research_opportunity": research_opportunity,
        "claim_version": claim_version,
    }


def analyze_gaps(papers: list[dict]) -> list[dict[str, Any]]:
    """Analyze 12 candidate research gaps.  Only emit those with enough evidence."""
    gaps: list[dict[str, Any]] = []
    vf = [p for p in papers if "vision-force" in p.get("research_topics", [])]
    fu = [p for p in papers if "failure-understanding" in p.get("research_topics", [])]
    fr = [p for p in papers if "failure-recovery" in p.get("research_topics", [])]
    failure_all = fu + [p for p in fr if p not in fu]

    # ---- Gap 1: Physical State Aliasing ----
    g1_support = [p for p in papers if re.search(
        r"false.success|physical.state.*alias|state.alias|visual.*physical.*mismatch|"
        r"inconsisten.*success|percept.*gap|sensory.*gap", _text(p)
    )]
    g1_counter = [p for p in papers if re.search(
        r"physical.*verif|contact.*verif|state.*ground.truth|force.*validation", _text(p)
    )]
    gaps.append(_build_gap(
        "physical-state-aliasing",
        "Physical State Aliasing",
        "物理状态混淆",
        "视觉观测成功是否等同于物理交互成功？",
        "Radar 内部仅2篇直接相关论文；已有 ContactGuard 等工作在做物理状态验证，counter evidence 较强",
        "缺少视觉成功与物理成功之间的显式一致性验证机制",
        "如果视觉判断成功但物理状态实际不一致，机器人可能在错误状态上继续执行",
        [p["paper_id"] for p in g1_support[:8]],
        [p["paper_id"] for p in g1_counter[:5]],
        "low",
        "探索视觉-力觉联合状态一致性验证方法，建立 false-success 检测基线",
        "dataset-limited",
        "dataset-limited",
    ))

    # ---- Gap 2: Failure Detection vs Diagnosis ----
    g2_detect = [p for p in papers if has_failure_detect(p)]
    g2_diag = [p for p in papers if has_failure_diag(p)]
    gaps.append(_build_gap(
        "failure-detection-vs-diagnosis",
        "Failure Detection vs Diagnosis Gap",
        "失败检测与失败诊断的差距",
        "当前研究在失败检测和失败原因诊断之间是否存在能力落差？",
        f"Radar 中检测相关论文 {len(g2_detect)} 篇，诊断相关 {len(g2_diag)} 篇；但 counter 中已有 Diagnose Correct Learn 等工作在做诊断",
        "多数工作聚焦于检测失败是否发生，较少深入诊断失败的具体原因和模式",
        "没有准确的诊断，恢复策略选择缺乏依据",
        [p["paper_id"] for p in g2_detect[:5]],
        [p["paper_id"] for p in g2_diag[:5]],
        "low",
        "研究 failure mode taxonomy 与诊断模型，建立 detection→diagnosis pipeline",
        "dataset-limited",
        "dataset-limited",
    ))

    # ---- Gap 3: Detection without closed-loop Recovery ----
    g3_detect_only = [p for p in failure_all if has_failure_detect(p) and not has_recovery(p)]
    g3_with_recovery = [p for p in failure_all if has_failure_detect(p) and has_recovery(p)]
    if g3_detect_only or g3_with_recovery:
        gaps.append(_build_gap(
            "detection-without-recovery",
            "Detection without Closed-loop Recovery",
            "检测到失败但缺乏闭环恢复",
            "失败检测之后是否真正实现了闭环恢复？",
            f"检测到失败的论文中，{len(g3_detect_only)} 篇未涉及恢复，{len(g3_with_recovery)} 篇涉及恢复",
            "许多工作在检测到失败后未提供自动恢复机制",
            "检测而不恢复限制了系统的自主性和实用性",
            [p["paper_id"] for p in g3_detect_only[:5]],
            [p["paper_id"] for p in g3_with_recovery[:5]],
            "medium",
            "研究 failure detection → recovery action 的端到端闭环系统",
            "evidence-based-inference",
            "evidence-supported",
        ))

    # ---- Gap 4: Recovery without Re-verification ----
    g4_recover = [p for p in papers if has_recovery(p)]
    g4_reverify = [p for p in papers if has_reverify(p)]
    g4_no_reverify = [p for p in g4_recover if not has_reverify(p)]
    if g4_recover:
        gaps.append(_build_gap(
            "recovery-without-reverification",
            "Systematic Post-Recovery Re-verification",
            "恢复后重新验证机制的系统性仍待确认",
            "已有部分研究在恢复、重规划或闭环执行后进行任务完成检查，但这些机制是否形成了跨任务、可复用且显式建模的 Post-Recovery Re-verification 框架，仍需进一步验证",
            f"涉及恢复的论文 {len(g4_recover)} 篇，涉及恢复后验证的 {len(g4_reverify)} 篇；外部搜索发现26篇 counter evidence，说明已有工作在做恢复后验证",
            "多数恢复研究的验证机制嵌入在特定任务流程中，尚未形成独立、可复用的验证框架",
            "未经验证的恢复可能导致系统在未察觉的失败状态上继续执行",
            [p["paper_id"] for p in g4_no_reverify[:8]],
            [p["paper_id"] for p in g4_reverify[:5]],
            "medium",
            "研究 post-recovery verification 机制和闭环恢复评估协议",
            "evidence-based-inference",
            "partially-addressed",
            gap_status="partially-addressed",
            what_has_been_addressed="若干工作已在恢复动作后执行任务完成检测或闭环状态观察，包括自适应重规划后的终止条件判断和闭环执行监控",
            what_remains_open="这些方法是否能够形成跨任务、可复用、显式且具有不确定性感知的 Post-Recovery Re-verification 框架仍需验证",
            status_reason="外部搜索发现26篇论文已涉及恢复后验证机制，原始'恢复后缺少重新验证'表述过宽；问题缩窄为跨任务、显式且不确定性感知的恢复后验证",
        ))

    # ---- Gap 5: Temporal 6D F/T Evidence ----
    g5_ft_vf = [p for p in vf if re.search(
        r"temporal.*force|force.*temporal|force.*history|force.*sequence|"
        r"time.series.*force|force.*time|dynamic.*force", _text(p)
    )]
    g5_rgbd_ft = [p for p in papers if re.search(r"rgb.?d|depth", _text(p)) and re.search(r"6.axis|force.torque|wrench", _text(p))]
    gaps.append(_build_gap(
        "temporal-6d-ft-evidence",
        "Temporal 6D F/T for Failure State Verification",
        "时序六维力觉用于失败状态验证",
        "已有研究开始使用 RGB 与时序 F/T 进行联合建模；当前值得进一步研究的问题是：短时 6D F/T 历史是否能够作为独立物理证据，提高操作 Outcome Verification，并特别降低 False Success 风险",
        f"VF 论文中涉及时序力觉的 {len(g5_ft_vf)} 篇，RGB-D+F/T 联合 {len(g5_rgbd_ft)} 篇。ManipForce 已在做 RGB+时序 F/T 联合编码，但其是否被用于失败状态验证和 False Success 降低仍需验证",
        "重点从'有没有 Temporal F/T'转移到'Temporal F/T 是否真正改善失败状态验证和 False Success'",
        "时序力觉信号可能包含关键的接触状态变化信息，但当前缺乏将其与失败验证直接关联的研究",
        [p["paper_id"] for p in g5_ft_vf[:5]],
        [p["paper_id"] for p in g5_rgbd_ft[:5]],
        "low",
        "研究 sliding-window F/T history 与视觉的联合编码方法，尤其关注其在失败验证中的应用",
        "open-hypothesis",
        "partially-addressed",
        gap_status="partially-addressed",
        what_has_been_addressed="ManipForce 等工作已在做 RGB + 时序 F/T 联合编码，Frequency-Aware Transformer 能够处理异步多模态信号",
        what_remains_open="时序 F/T 是否被明确用于 physical state verification、outcome verification、failure-state verification 和 false-success reduction 仍需验证",
        status_reason="外部搜索发现 ManipForce 等工作已在做 RGB+时序 F/T 联合建模，原始'没人研究时序 F/T'不成立；问题缩窄为时序 F/T 是否真正改善失败状态验证",
        claim_version=2,
    ))

    # ---- Gap 6: Outcome Prediction vs Evidence Sufficiency ----
    g6_outcome = [p for p in papers if _OUTCOME_PRED_RE.search(_text(p))]
    g6_evidence_suff = [p for p in papers if re.search(
        r"evidence.*suffic|suffic.*evidence|confidence.*threshold|"
        r"decision.*bound|uncertainty.*threshold", _text(p)
    )]
    gaps.append(_build_gap(
        "outcome-vs-evidence-sufficiency",
        "Outcome Prediction vs Evidence Sufficiency",
        "结果预测与证据充分性",
        "任务结果预测是否考虑了当前观测证据的充分性？",
        f"结果预测论文 {len(g6_outcome)} 篇，显式讨论证据充分性的 {len(g6_evidence_suff)} 篇；Radar 未覆盖 evidence sufficiency 领域",
        "多数 outcome prediction 直接输出成功/失败概率，不区分'证据不足'和'任务确实失败'",
        "证据不充分时的误判风险可能高于任务本身的失败率",
        [p["paper_id"] for p in g6_outcome[:5]],
        [p["paper_id"] for p in g6_evidence_suff[:3]],
        "low",
        "研究 evidence-aware outcome prediction，将观测充分性纳入决策",
        "open-hypothesis",
        "dataset-limited",
    ))

    # ---- Gap 7: False Success Risk ----
    g7_support = [p for p in papers if re.search(
        r"false.success|false.positive.*success|incorrect.success|"
        r"premature.*success|success.*risk|misclassif.*success", _text(p)
    )]
    g7_counter = [p for p in papers if re.search(
        r"success.*verif|verif.*success|ground.truth.*success|robust.*success", _text(p)
    )]
    if g7_support or g7_counter:
        gaps.append(_build_gap(
            "false-success-risk",
            "False Success Risk Modeling",
            "虚假成功风险建模",
            "当前系统是否建模了将未完成任务误判为成功的风险？",
            f"涉及虚假成功风险的论文 {len(g7_support)} 篇，涉及成功验证的 {len(g7_counter)} 篇；Radar 未覆盖 false-success detection 领域",
            "多数系统假设感知判断即为真实状态，未建模 false-success 的代价",
            "虚假成功可能导致机器人在危险状态上继续执行",
            [p["paper_id"] for p in g7_support[:5]],
            [p["paper_id"] for p in g7_counter[:5]],
            "low",
            "研究 false-success risk estimation 和 risk-aware execution",
            "open-hypothesis",
            "dataset-limited",
        ))

    # ---- Gap 8: Failure Mode → Recovery Strategy ----
    g8_support = [p for p in papers if re.search(
        r"failure.mode.*recover|recover.*failure.mode|strategy.*select|"
        r"policy.*select|recovery.*hierarch|failure.*taxonomy", _text(p)
    )]
    g8_counter = [p for p in papers if re.search(
        r"single.*recovery|one.size|uniform.*recover|fixed.*policy", _text(p)
    )]
    gaps.append(_build_gap(
        "failure-to-recovery-hierarchy",
        "Failure Mode → Recovery Strategy Mapping",
        "失败模式到恢复策略的层级映射",
        "是否存在从失败模式到恢复策略的系统化映射？",
        f"涉及失败-恢复映射的论文 {len(g8_support)} 篇；VoLo 和 Continue or Replan? 在做初步映射",
        "多数恢复方法使用统一策略，缺乏根据失败类型选择不同恢复方案的机制",
        "不同的失败模式可能需要根本不同的恢复策略",
        [p["paper_id"] for p in g8_support[:5]],
        [p["paper_id"] for p in g8_counter[:5]],
        "medium",
        "研究 failure taxonomy → recovery policy 的层级决策框架",
        "evidence-based-inference",
        "evidence-supported",
    ))

    # ---- Gap 9: Selective Human Escalation ----
    g9_support = [p for p in papers if _HITL_RE.search(_text(p))]
    g9_uncertainty_hitl = [p for p in g9_support if _UNCERTAINTY_RE.search(_text(p))]
    gaps.append(_build_gap(
        "selective-human-escalation",
        "Uncertainty-driven Escalation in VF Failure Recovery",
        "视觉力觉失败恢复中的不确定性驱动人类升级",
        "在视觉力觉失败恢复场景中，机器人何时应自主恢复、何时应因证据不足而请求人类干预？",
        f"外部搜索发现21篇 HITL 相关工作，已有 Admittance-Based、VR-DAgger 等框架；但 uncertainty-calibrated escalation 在 VF failure recovery 中仍有空间",
        "现有 HITL 框架多使用固定触发条件，而非基于感知不确定性和证据充分性的自适应策略",
        "在视觉力觉失败恢复中，错误的自主恢复可能比请求人类干预代价更高",
        [p["paper_id"] for p in g9_support[:8]],
        [],
        "low",
        "研究在 VF 失败恢复场景中基于不确定性证据的 selective human escalation 策略",
        "open-hypothesis",
        "partially-addressed",
        gap_status="partially-addressed",
        what_has_been_addressed="外部搜索发现21篇论文已实现 HITL 框架，但多为通用场景而非 VF 失败恢复专用",
        what_remains_open="在视觉力觉失败恢复中，基于感知不确定性和证据充分性的选择性人类升级策略尚未被系统研究",
        status_reason="外部搜索发现大量通用 HITL 工作，但 VF 失败恢复中的 uncertainty-calibrated escalation 仍是窄化后的开放问题",
        claim_version=2,
    ))

    # ---- Gap 10: Learning from Corrections ----
    g10_support = [p for p in papers if re.search(
        r"human.correct|human.feedback|correction.*learn|learn.*correction|"
        r"demonstration.*correct|feedback.*improv", _text(p)
    ) and not re.search(r"force.feedback|tactile.feedback|visual.feedback|sensor.feedback|feedback.control", _text(p))]
    g10_counter = [p for p in papers if re.search(
        r"online.learn|continual.learn|adapt.*from|update.*from", _text(p)
    )]
    gaps.append(_build_gap(
        "learning-from-corrections",
        "Learning from Human Corrections for Failure Recovery",
        "从人类纠正中学习用于失败恢复",
        "人类纠正是否被系统性地用于改进后续失败恢复能力？",
        f"外部搜索发现26篇论文在做从人类干预/纠正中学习（GAINS、UniIntervene、FlowCorrect 等），这些实际是 counter evidence——该领域已有大量工作",
        "已有大量工作在做从人类纠正中学习，但将其专门用于 failure recovery 闭环的系统化方法仍少",
        "如果纠正信息不被系统性地用于改进失败恢复策略，机器人将反复犯相同错误",
        [],
        [p["paper_id"] for p in g10_support[:5]],
        "low",
        "研究 human correction → failure recovery policy improvement 的闭环机制",
        "open-hypothesis",
        "partially-addressed",
        gap_status="partially-addressed",
        what_has_been_addressed="外部搜索发现26篇论文在做从人类干预/纠正中学习（GAINS、UniIntervene、FlowCorrect、DexHiL 等），该领域已有大量工作",
        what_remains_open="将人类纠正专门用于 failure recovery 闭环（而非通用策略改进）的系统化方法仍少",
        status_reason="经审计发现全部26篇 supporting 实际为 counter（均在做从纠正中学习），原 open-hypotheses 状态不准确；降级为 partially-addressed",
        claim_version=2,
    ))

    # ---- Gap 11: Benchmark Gap ----
    g11_bench = [p for p in papers if _BENCHMARK_RE.search(_text(p))]
    g11_vf_bench = [p for p in g11_bench if "vision-force" in p.get("research_topics", [])]
    g11_failure_bench = [p for p in g11_bench if bool(set(p.get("research_topics", [])) & {"failure-understanding", "failure-recovery"})]
    gaps.append(_build_gap(
        "benchmark-gap",
        "Vision-Force Failure Recovery Benchmark",
        "视觉力觉失败恢复基准",
        "是否存在统一的视觉力觉失败恢复评估基准？",
        f"基准相关论文 {len(g11_bench)} 篇，VF 相关 {len(g11_vf_bench)} 篇，failure 相关 {len(g11_failure_bench)} 篇；'benchmark' 关键词匹配了大量非 VF 失败恢复基准",
        "现有基准多聚焦于静态操作成功率，缺乏针对失败恢复过程的标准化评估",
        "没有统一基准难以公平比较不同方法的恢复能力",
        [p["paper_id"] for p in g11_vf_bench[:5]],
        [p["paper_id"] for p in g11_failure_bench[:5]],
        "low",
        "设计统一的 Vision-Force Failure Recovery Benchmark",
        "dataset-limited",
        "dataset-limited",
    ))

    # ---- Gap 12: Cross-task Generalization ----
    g12_cross = [p for p in papers if _CROSS_TASK_RE.search(_text(p))]
    g12_vf_cross = [p for p in g12_cross if "vision-force" in p.get("research_topics", [])]
    g12_real = [p for p in g12_vf_cross if re.search(r"real.robot|real.world", _text(p))]
    gaps.append(_build_gap(
        "cross-task-generalization",
        "Cross-task, Cross-robot Generalization",
        "跨任务、跨机器人泛化",
        "视觉力觉方法在不同任务和机器人平台间的泛化能力如何？",
        f"涉及泛化的论文 {len(g12_cross)} 篇，VF 相关 {len(g12_vf_cross)} 篇，真实机器人 {len(g12_real)} 篇；'generaliz' 关键词过于宽泛，匹配了大量非 VF 跨任务论文",
        "多数方法在特定任务和平台上验证，跨场景泛化能力未充分评估",
        "缺乏泛化能力限制了方法的实用性和可迁移性",
        [p["paper_id"] for p in g12_vf_cross[:8]],
        [],
        "low",
        "研究 vision-force 方法的 domain transfer 和 cross-platform evaluation",
        "dataset-limited",
        "dataset-limited",
    ))

    # Filter: only emit gaps with at least some evidence or high relevance
    active = [g for g in gaps if g["confidence"] != "insufficient"]
    # Sort: evidence-supported > partially-addressed > open-hypothesis > dataset-limited
    status_order = {"evidence-supported": 0, "partially-addressed": 1, "open-hypotheses": 2, "dataset-limited": 3}
    active.sort(key=lambda g: (status_order.get(g.get("gap_status", g.get("group", "")), 9),))
    return active


# ---------------------------------------------------------------------------
# Research Directions
# ---------------------------------------------------------------------------

def generate_directions(papers: list[dict], gaps: list[dict]) -> list[dict[str, Any]]:
    """Generate research directions derived from identified gaps."""
    directions = []
    for gap in gaps:
        directions.append({
            "id": f"dir-{gap['id']}",
            "title": gap["title"],
            "title_zh": gap["title_zh"],
            "research_question": gap["question"],
            "why_worthwhile": gap["why_it_matters"],
            "current_state": gap["current_progress"],
            "missing": gap["missing_piece"],
            "potential_experiment": gap["research_opportunity"],
            "difficulty": "medium",  # default; manual refinement possible
            "evidence_strength": gap["confidence"],
            "type": "research opportunity / hypothesis",
            "derived_from_gap": gap["id"],
        })
    return directions


# ---------------------------------------------------------------------------
# Statistics
# ---------------------------------------------------------------------------

def compute_statistics(papers: list[dict]) -> dict[str, Any]:
    total = len(papers)
    vf = [p for p in papers if "vision-force" in p.get("research_topics", [])]
    fu = [p for p in papers if "failure-understanding" in p.get("research_topics", [])]
    fr = [p for p in papers if "failure-recovery" in p.get("research_topics", [])]

    vf_fu = [p for p in vf if "failure-understanding" in p.get("research_topics", [])]
    vf_fr = [p for p in vf if "failure-recovery" in p.get("research_topics", [])]
    vf_fu_fr = [p for p in vf if "failure-understanding" in p.get("research_topics", []) and "failure-recovery" in p.get("research_topics", [])]

    # Evidence tier counts (all papers)
    direct = [p for p in papers if classify_evidence(p) == "direct"]
    related = [p for p in papers if classify_evidence(p) == "related"]
    background = [p for p in papers if classify_evidence(p) == "background"]

    return {
        "total_papers": total,
        "analysis_sample_size": total,
        "topic_counts": {
            "vision-force": len(vf),
            "failure-understanding": len(fu),
            "failure-recovery": len(fr),
        },
        "cross_topic_counts": {
            "vision-force_and_failure-understanding": len(vf_fu),
            "vision-force_and_failure-recovery": len(vf_fr),
            "vision-force_and_failure-understanding_and_failure-recovery": len(vf_fu_fr),
        },
        "evidence_tiers": {
            "direct": len(direct),
            "related": len(related),
            "background": len(background),
        },
    }


# ---------------------------------------------------------------------------
# Evidence index (for frontend lookup)
# ---------------------------------------------------------------------------

def build_evidence_index(papers: list[dict]) -> dict[str, dict[str, Any]]:
    """Map paper_id → evidence classification + stage mapping."""
    index = {}
    for p in papers:
        pid = p.get("paper_id", "")
        if not pid:
            continue
        index[pid] = {
            "evidence_tier": classify_evidence(p),
            "pipeline_stages": map_paper_to_stages(p),
            "topics": p.get("research_topics", []),
            "relevance_score": p.get("relevance_score", 0),
        }
    return index


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def build() -> dict[str, Any]:
    papers_data = _read_json(PAPERS_PATH, {"papers": []})
    papers = papers_data.get("papers", []) if isinstance(papers_data, dict) else papers_data

    statistics = compute_statistics(papers)

    # Pipeline: map papers to stages
    pipeline = []
    for stage_def in PIPELINE_STAGES:
        stage_papers = []
        for p in papers:
            stages = map_paper_to_stages(p)
            if stage_def["id"] in stages:
                stage_papers.append(p["paper_id"])
        pipeline.append({
            "id": stage_def["id"],
            "label": stage_def["label"],
            "label_zh": stage_def["label_zh"],
            "description": stage_def["description"],
            "paper_count": len(stage_papers),
            "paper_ids": stage_papers[:20],
        })

    # Maturity
    maturity = [assess_maturity(papers, dim) for dim in MATURITY_DIMENSIONS]

    # Gaps
    gaps = analyze_gaps(papers)

    # Directions
    directions = generate_directions(papers, gaps)

    # Evidence index
    evidence_index = build_evidence_index(papers)

    # Merge external gap search results if available
    gap_search_path = ROOT / "data" / "gap_search_results.json"
    external_evidence = {}
    external_update_source = "none"
    external_searched_at = ""
    if gap_search_path.exists():
        try:
            search_data = json.loads(gap_search_path.read_text(encoding="utf-8"))
            external_update_source = search_data.get("update_source", "local")
            external_searched_at = search_data.get("generated_at", "")
            for gap_id, gap_result in search_data.get("gaps", {}).items():
                external_evidence[gap_id] = {
                    "total_retrieved": gap_result.get("total_retrieved", 0),
                    "unique_after_dedup": gap_result.get("unique_after_dedup", 0),
                    "supporting_count": gap_result.get("supporting_count", 0),
                    "counter_count": gap_result.get("counter_count", 0),
                    "sources": gap_result.get("sources", {}),
                    "searched_at": gap_result.get("searched_at", ""),
                }
        except (json.JSONDecodeError, OSError):
            pass

    # Track evidence claim versions and mark stale evidence
    # When a gap's claim_version > external_evidence_claim_version, the evidence is stale
    evidence_claim_versions = {}
    if gap_search_path.exists():
        try:
            search_data_raw = json.loads(gap_search_path.read_text(encoding="utf-8"))
            for gap_id, gap_result in search_data_raw.get("gaps", {}).items():
                evidence_claim_versions[gap_id] = gap_result.get("claim_version", 1)
        except (json.JSONDecodeError, OSError):
            pass

    # Mark stale evidence and adjust confidence
    if external_evidence:
        confidence_order = {"high": 3, "medium": 2, "low": 1, "insufficient": 0}
        for gap in gaps:
            ext = external_evidence.get(gap["id"])
            if not ext:
                continue
            gap_cv = gap.get("claim_version", 1)
            evidence_cv = evidence_claim_versions.get(gap["id"], 1)
            # Mark stale if claim was updated after evidence was collected
            if gap_cv > evidence_cv:
                ext["evidence_stale"] = True
                ext["stale_reason"] = f"Claim version {gap_cv} > evidence version {evidence_cv}; evidence needs refresh"
            else:
                ext["evidence_stale"] = False
            # Only adjust confidence from non-stale evidence
            if ext.get("evidence_stale"):
                continue
            sup = ext.get("supporting_count", 0)
            cnt = ext.get("counter_count", 0)
            current = confidence_order.get(gap["confidence"], 1)
            if cnt >= sup * 2 and cnt >= 5:
                if current >= 2:
                    gap["confidence"] = "low"

    landscape = {
        "schema_version": "1.0.0",
        "generated_at": date.today().isoformat(),
        "topic": "Vision-Force Fusion in Failure Understanding & Recovery",
        "topic_zh": "视觉力觉融合在机器人操作失败理解与恢复中的研究进展",
        "disclaimer": "当前分析基于 Embodied Research Radar 已收录论文及其标题、摘要、结构化字段和辅助分析，不等同于系统综述或 Meta-analysis。Research Gap 表示当前收录证据中尚未被充分覆盖的问题，不表示学术界绝对无人研究。",
        "disclaimer_zh": "当前分析基于 Embodied Research Radar 已收录论文及其标题、摘要、结构化字段和辅助分析，不等同于系统综述或 Meta-analysis。Research Gap 表示当前收录证据中尚未被充分覆盖的问题，不表示学术界绝对无人研究。",
        "statistics": statistics,
        "pipeline": pipeline,
        "maturity": maturity,
        "gaps": gaps,
        "directions": directions,
        "evidence_index": evidence_index,
        "external_evidence": external_evidence,
        "external_update_source": external_update_source,
        "external_searched_at": external_searched_at,
    }
    return landscape


def main() -> int:
    landscape = build()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(landscape, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"landscape generated: {OUTPUT_PATH}")
    print(f"  papers analysed: {landscape['statistics']['total_papers']}")
    print(f"  pipeline stages: {len(landscape['pipeline'])}")
    print(f"  maturity dimensions: {len(landscape['maturity'])}")
    print(f"  research gaps: {len(landscape['gaps'])}")
    print(f"  research directions: {len(landscape['directions'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
