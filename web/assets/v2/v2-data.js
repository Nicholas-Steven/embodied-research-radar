// V2 Research Workspace — static configuration data (P1)
// All research-profile content is data, not code: switching research topics
// only requires editing this file (spec §77, §81).

// ---------------------------------------------------------------------------
// Research Profile — current research thesis configuration (DEMO default)
// ---------------------------------------------------------------------------
export const researchProfile = {
  id: "default-visual-force",
  title: "Visual-Force Active Failure Diagnosis for Contact-Rich Manipulation",
  titleZh: "面向接触丰富机器人操作的视觉力觉主动失败诊断与风险感知恢复",
  sensors: ["RGB / RGB-D", "Wrist 6D F/T (Fx, Fy, Fz, Mx, My, Mz)"],
  hypotheses: ["Success", "Misalignment", "Jam", "Slip", "Contact Loss", "Unknown"],
  primaryQuestion: "Risk-limited active failure diagnosis",
  primaryQuestionZh: "风险受限的主动失败诊断",
  // Evidence Sufficiency is NOT a standalone theory (spec §5):
  // it is represented as a decision gate in the thesis graph.
  evidenceGateNote:
    "Evidence Sufficiency is treated as an operational decision variable rather than an independently novel theoretical concept.",
  // §10 证据充分性中文说明（显示用；内部概念不变）
  evidenceGateNoteZh:
    "本项目不将证据充分性视为独立的新理论概念。它用于描述当前多模态证据是否足以支持后续决策，并应通过可诊断性、后验分离度、信息价值、风险或停止准则等已有理论进行计算和解释。",
  evidenceGateRole: "诊断决策变量",
  // 显示用中文文案（内部 sensors/hypotheses 键不变；§五 中文化收尾）
  sensorsDisplay: ["RGB / RGB-D + 腕部 6D F/T"],
  hypothesesDisplay: ["成功", "错位", "卡滞", "滑移", "接触丢失", "未知失败"],
  futureExtensionsDisplay: ["开放集失败", "世界模型", "指尖触觉", "VLA"],
  vlaStatus: "可选 / 后续融合",
  worldModelStatus: "后续扩展",
};

// ---------------------------------------------------------------------------
// Research Nodes — the thesis pipeline graph (spec §7, §47)
// role enum: core-question | core-algorithm | supporting | baseline | safety | future
// status enum: not-started | reading | reproducing | designing | experimenting | validated | rejected
// ---------------------------------------------------------------------------
export const researchNodes = [
  {
    id: "visual-temporal",
    title: "Visual Temporal Representation",
    titleZh: "视觉时序表征",
    role: "supporting",
    scientificQuestion: "Which frozen vision representations carry temporal cues useful for contact-state inference?",
    inputs: ["RGB / RGB-D frames"],
    outputs: ["Visual temporal features"],
    candidateMethods: ["ViT", "DINO", "DINOv2", "CLIP intermediate features", "lightweight temporal transformer"],
    status: "reading",
    confidence: 40,
    gaps: ["temporal visual evidence under contact events"],
  },
  {
    id: "force-temporal",
    title: "Force Temporal Representation",
    titleZh: "力觉时序表征",
    role: "supporting",
    scientificQuestion: "Does temporal 6D F/T history carry non-redundant evidence beyond the instantaneous wrench?",
    inputs: ["6D F/T: Fx, Fy, Fz, Mx, My, Mz"],
    outputs: ["Force temporal features"],
    candidateMethods: ["TCN", "GRU", "Temporal Transformer", "SSM"],
    status: "designing",
    confidence: 55,
    gaps: ["temporal-6d-ft-evidence"],
  },
  {
    id: "contact-phase",
    title: "Contact / Phase Estimation",
    titleZh: "接触 / 任务阶段估计",
    role: "supporting",
    scientificQuestion: "Which manipulation phase is the system currently in, and did contact occur as expected?",
    inputs: ["Visual temporal features", "Force temporal features"],
    outputs: ["Contact state", "Phase label"],
    candidateMethods: ["Contact classifiers", "Phase HMM/SSM", "Learned segmentation"],
    status: "not-started",
    confidence: 20,
  },
  {
    id: "multimodal-fusion",
    title: "Multimodal Fusion",
    titleZh: "视觉力觉多模态融合",
    role: "supporting",
    scientificQuestion: "How should asynchronous visual and F/T streams be fused under contact-phase conditioning?",
    inputs: ["Visual temporal features", "Force temporal features", "Contact/phase estimate"],
    outputs: ["Fused multimodal representation"],
    candidateMethods: ["Contact-conditioned asymmetric cross-attention", "Gated fusion", "Slow-fast fusion"],
    status: "not-started",
    confidence: 20,
  },
  {
    id: "failure-belief",
    title: "Multimodal Failure Belief",
    titleZh: "失败假设信念",
    role: "core-question",
    roleLabel: "Core Interface",
    scientificQuestion: "Given visual and continuous F/T history, which failure hypotheses are supported?",
    inputs: ["Visual features", "Force features", "Contact/phase estimate"],
    outputs: ["Belief over: Success, Misalignment, Jam, Slip, Contact Loss, Unknown"],
    candidateMethods: ["Bayesian fusion", "Learned belief head", "Ensemble + calibration"],
    status: "reading",
    confidence: 35,
    gaps: ["failure-hypothesis-disambiguation"],
  },
  {
    id: "diagnosability",
    title: "Action-conditioned Diagnosability",
    titleZh: "动作条件化失败可辨识性",
    role: "core-question",
    scientificQuestion: "Which failure hypotheses are indistinguishable under passive observation, and which actions make them separable?",
    inputs: ["Failure belief", "Candidate probe actions", "Hypothesis models"],
    outputs: ["Diagnosability estimate", "Distinguishing observations"],
    candidateMethods: ["Optimal Experiment Design", "VOI analysis", "Fault isolability analysis"],
    status: "designing",
    confidence: 45,
    gaps: ["risk-limited-active-diagnosis"],
    note: "Evidence Sufficiency is treated as the operational decision gate here, not a novel theory.",
  },
  {
    id: "safe-active-diagnosis",
    title: "Safe Active Diagnosis",
    titleZh: "风险受限主动诊断",
    role: "core-algorithm",
    scientificQuestion: "How should the robot select diagnostic actions that maximize information under force/torque safety limits?",
    inputs: ["Diagnosability estimate", "Safety limits"],
    outputs: ["Probe action plan"],
    candidateMethods: ["Belief-space MPC", "Dual control (approx.)", "Constrained OED"],
    status: "not-started",
    confidence: 15,
  },
  {
    id: "probe-abstain",
    title: "Probe / Abstain Decision",
    titleZh: "主动探测 / 暂缓决策",
    role: "core-question",
    roleLabel: "Core Decision Module",
    scientificQuestion: "When is further probing worth its cost, and when should the system abstain or escalate?",
    inputs: ["NetVOI estimates", "Risk bounds"],
    outputs: ["Probe | Wait | Continue | Retreat | Abstain | Stop | Human Escalation"],
    candidateMethods: ["NetVOI thresholding", "Sequential hypothesis testing"],
    status: "designing",
    confidence: 40,
  },
  {
    id: "belief-update",
    title: "Belief Update",
    titleZh: "信念更新",
    role: "core-algorithm",
    scientificQuestion: "How should posterior beliefs be updated after each probe observation?",
    inputs: ["Probe observations", "Hypothesis response models"],
    outputs: ["Updated failure belief"],
    candidateMethods: ["Bayesian update", "Particle filtering"],
    status: "not-started",
    confidence: 20,
  },
  {
    id: "risk-recovery",
    title: "Risk-aware Recovery",
    titleZh: "风险感知恢复",
    role: "core-question",
    roleLabel: "Core Closed-loop Contribution",
    scientificQuestion: "Does posterior-conditioned recovery reduce wrong recovery actions versus fixed strategies?",
    inputs: ["Updated failure belief"],
    outputs: ["Recovery action plan"],
    candidateMethods: ["Risk-sensitive MPC", "Class/belief-conditioned recovery policies"],
    status: "designing",
    confidence: 35,
    gaps: ["belief-conditioned-recovery"],
  },
  {
    id: "impedance",
    title: "Variable Impedance / Admittance",
    titleZh: "阻抗 / 导纳执行层",
    role: "baseline",
    roleLabel: "Execution Layer",
    scientificQuestion: "How should compliant execution parameters adapt during diagnosis and recovery?",
    inputs: ["Recovery plan", "Contact state"],
    outputs: ["Compliant motion commands"],
    candidateMethods: ["Impedance control", "Admittance control", "Hybrid force/position"],
    status: "not-started",
    confidence: 25,
  },
  {
    id: "safety-layer",
    title: "CBF / Passivity Safety Layer",
    titleZh: "CBF / 无源性安全层",
    role: "safety",
    scientificQuestion: "How are force and torque limits enforced as hard guarantees during probing?",
    inputs: ["Motion commands", "Force limits"],
    outputs: ["Safety-filtered commands"],
    candidateMethods: ["CBF safety filter", "Passivity / energy tank"],
    status: "not-started",
    confidence: 20,
  },
];

// Directed edges of the thesis graph (order = data flow)
export const researchEdges = [
  ["visual-temporal", "multimodal-fusion"],
  ["force-temporal", "multimodal-fusion"],
  ["contact-phase", "multimodal-fusion"],
  ["multimodal-fusion", "failure-belief"],
  ["failure-belief", "diagnosability"],
  ["diagnosability", "safe-active-diagnosis"],
  ["safe-active-diagnosis", "probe-abstain"],
  ["probe-abstain", "belief-update"],
  ["belief-update", "risk-recovery"],
  ["risk-recovery", "impedance"],
  ["impedance", "safety-layer"],
];

export const nodeRoleMeta = {
  "core-question": { label: "Core Research Question", color: "var(--accent-rose, #f43f5e)" },
  "core-algorithm": { label: "Core Algorithm", color: "var(--accent-cyan, #22d3ee)" },
  supporting: { label: "Supporting Method", color: "var(--accent-blue, #3b82f6)" },
  baseline: { label: "Baseline / Execution Layer", color: "var(--accent-violet, #8b5cf6)" },
  safety: { label: "Safety Layer", color: "var(--accent-amber, #f59e0b)" },
  future: { label: "后续扩展", color: "var(--text-muted, #64748b)" },
};

export const nodeStatusMeta = {
  "not-started": { label: "Not Started" },
  reading: { label: "Reading" },
  reproducing: { label: "Reproducing" },
  designing: { label: "Designing" },
  experimenting: { label: "Experimenting" },
  validated: { label: "Validated" },
  rejected: { label: "Rejected" },
};

// ---------------------------------------------------------------------------
// Collision configuration — weights centralized here ONLY (spec §9, §12)
// ---------------------------------------------------------------------------
export const collisionConfig = {
  weights: {
    sensorOverlap: 10,
    problemOverlap: 20,
    stateOverlap: 15,
    activeActionOverlap: 20,
    recoveryOverlap: 20,
    theoryOverlap: 15,
  },
  // Each dimension: keyword regex sources matched against title+abstract+topics+methods+sensors.
  dimensions: {
    sensorOverlap: {
      label: "Sensor Overlap",
      requireAll: [
        ["vision", /\bvision|rgb|camera|image|visual\b/i],
        ["force", /\bforce[\s-]?(torque|sensor)?|f\/t|\btactile\b|wrench|\bft\b/i],
      ],
    },
    problemOverlap: {
      label: "Problem Overlap",
      any: [/\bfailure (detection|diagnosis|classification|prediction)\b/i,
            /\bfault (detection|diagnosis)\b/i,
            /\b(anomaly|error) detection\b/i,
            /\bslip detection\b/i, /\bcontact (state|event) estimation\b/i,
            /\binsertion failure\b/i, /\bgrasp failure\b/i],
    },
    stateOverlap: {
      label: "State/Belief Overlap",
      any: [/\bbelief\b/i, /\buncertainty (estimation|quantification)\b/i,
            /\bbayesian (filtering|inference|update)\b/i, /\bstate estimation\b/i,
            /\bhypothesis (testing|classification)\b/i, /\bposterior\b/i],
    },
    activeActionOverlap: {
      label: "Active Action Overlap",
      any: [/\bactive (tactile|sensing|exploration|touch|perception|diagnosis|probing)\b/i,
            /\bprobe(-| )?(based|guided|action)\b/i, /\b exploratory (motion|action)\b/i,
            /\binformation[- ]gain\b/i, /\bnext[- ]best (action|view)\b/i,
            /\boptimal experiment design\b/i],
    },
    recoveryOverlap: {
      label: "Recovery Overlap",
      any: [/\brecovery\b/i, /\bretry\b/i, /\bre[- ]?grasp(ing)?\b/i,
            /\bself[- ]?correct(ion|ing)\b/i, /\bfault[- ]?tolerant\b/i,
            /\bresume(ment)? after\b/i],
    },
    theoryOverlap: {
      label: "Theory Overlap",
      any: [/\bdiagnosability\b/i, /\bfault isolability\b/i, /\bdual control\b/i,
            /\bPOMDP\b/i, /\bbelief[- ]space (planning|MPC)\b/i,
            /\bvalue of information\b/i, /\bsequential (hypothesis )?test(ing)?\b/i,
            /\bselective prediction\b/i, /\babstention\b/i, /\breject option\b/i],
    },
  },
  riskLevels: [
    { max: 30, label: "Low", key: "low" },
    { max: 50, label: "Moderate", key: "moderate" },
    { max: 70, label: "High", key: "high" },
    { max: 85, label: "Very High", key: "very-high" },
    { max: 100, label: "Critical", key: "critical" },
  ],
  impactLevels: ["No impact", "Requires wording change", "Requires stronger baseline", "Weakens innovation", "Invalidates current claim"],
  verificationLevels: ["Metadata only", "Abstract verified", "Full paper checked", "Supplement checked"],
};

// Default critical monitoring topics (spec §12) — used as search/alert grouping only
export const criticalCollisionTopics = [
  "Visual-force failure detection",
  "Multimodal failure diagnosis",
  "Failure recovery",
  "Active tactile exploration",
  "Active fault diagnosis",
  "Dual control",
  "Belief-space planning",
  "POMDP",
  "Probe-guided recovery",
  "Risk-aware recovery",
  "Contact information flow",
  "World model contact manipulation",
  "Force-aware policy",
];

// ---------------------------------------------------------------------------
// Concept Dictionary (spec §17) — shared vocabulary for Novelty Red Team.
// canonicalReferences use author+year form only (NO invented DOI/venue);
// treat them as pointers to verify, not citations.
// ---------------------------------------------------------------------------
export const researchConcepts = [
  { id: "evidence-sufficiency", name: "Evidence Sufficiency", aliases: ["证据充分性"], definition: "Whether accumulated observations are sufficient to support a diagnostic decision.", category: "decision-theory", canonicalReferences: [], relatedConcepts: ["selective-prediction", "diagnosability", "sequential-hypothesis-testing", "value-of-information"], notes: "In this project: operational decision variable, NOT an independently novel theory." },
  { id: "prediction-confidence", name: "Prediction Confidence", aliases: ["预测置信度", "confidence estimation"], definition: "A model's self-reported certainty about a prediction.", category: "uncertainty", canonicalReferences: ["Kendall & Gal (2017), Bayesian deep learning uncertainties (verify)"], relatedConcepts: ["epistemic-uncertainty", "calibration"], notes: "" },
  { id: "epistemic-uncertainty", name: "Epistemic Uncertainty", aliases: ["认知不确定性", "model uncertainty", "aleatoric vs epistemic"], definition: "Uncertainty due to limited knowledge/data, reducible by more data.", category: "uncertainty", canonicalReferences: ["Der Kiureghian & Ditlevsen (2009) (verify)"], relatedConcepts: ["prediction-confidence", "calibration"], notes: "" },
  { id: "calibration", name: "Calibration", aliases: ["置信度校准", "ECE"], definition: "Agreement between predicted confidence and empirical accuracy (e.g., measured by ECE).", category: "uncertainty", canonicalReferences: ["Guo et al. (2017), On Calibration of Modern Neural Networks (verify)"], relatedConcepts: ["prediction-confidence", "selective-prediction"], notes: "" },
  { id: "selective-prediction", name: "Selective Prediction", aliases: ["选择性预测"], definition: "Predict only when the model decides it is safe to answer; otherwise abstain.", category: "decision-theory", canonicalReferences: ["El-Yaniv & Wiener (2010) (verify)", "Chow (1970) reject option (verify)"], relatedConcepts: ["reject-option", "abstention", "evidence-sufficiency"], notes: "" },
  { id: "reject-option", name: "Reject Option", aliases: ["拒识", "classification with reject"], definition: "Classic classifier setting with an explicit reject class trading error vs. reject rate.", category: "decision-theory", canonicalReferences: ["Chow (1970) (verify)"], relatedConcepts: ["selective-prediction", "abstention", "bayes-risk"], notes: "" },
  { id: "abstention", name: "Abstention", aliases: ["暂缓判断", "deferral"], definition: "Declining to act/decide, optionally deferring to a fallback or human.", category: "decision-theory", canonicalReferences: [], relatedConcepts: ["selective-prediction", "reject-option"], notes: "" },
  { id: "bayes-risk", name: "Bayes Risk", aliases: ["贝叶斯风险"], definition: "Expected loss of a decision rule under the posterior; optimal rule minimizes it.", category: "decision-theory", canonicalReferences: ["Berger (1985), Statistical Decision Theory (verify)"], relatedConcepts: ["value-of-information", "sequential-hypothesis-testing"], notes: "" },
  { id: "value-of-information", name: "Value of Information", aliases: ["VOI", "信息价值", "net VOI"], definition: "Expected improvement in decision quality from an observation, minus its cost.", category: "decision-theory", canonicalReferences: ["Howard (1966), Information value theory (verify)"], relatedConcepts: ["information-gain", "optimal-experiment-design", "evidence-sufficiency"], notes: "NetVOI in the Failure Lab is a heuristic estimate of this." },
  { id: "diagnosability", name: "Diagnosability", aliases: ["可诊断性"], definition: "Structural/analytic property of whether faults can be distinguished from available observations.", category: "fdi-theory", canonicalReferences: ["Gertler (1998), Fault Detection and Diagnosis in Engineering Systems (verify)"], relatedConcepts: ["fault-isolability", "observability", "active-fault-diagnosis"], notes: "" },
  { id: "fault-isolability", name: "Fault Isolability", aliases: ["故障隔离性"], definition: "Ability to determine WHICH fault occurred, not merely that one occurred.", category: "fdi-theory", canonicalReferences: ["Gertler (1998) (verify)"], relatedConcepts: ["diagnosability"], notes: "" },
  { id: "observability", name: "Observability", aliases: ["可观测性"], definition: "Whether system state can be inferred from outputs over time.", category: "control-theory", canonicalReferences: ["standard control theory (Kalman) (verify)"], relatedConcepts: ["diagnosability"], notes: "" },
  { id: "information-gain", name: "Information Gain", aliases: ["信息增益", "mutual information", "EIG"], definition: "Expected reduction in entropy (of the belief) from an observation.", category: "information-theory", canonicalReferences: ["Cover & Thomas (verify)"], relatedConcepts: ["value-of-information", "optimal-experiment-design"], notes: "" },
  { id: "active-fault-diagnosis", name: "Active Fault Diagnosis", aliases: ["主动故障诊断", "auxiliary signal design", "input design for diagnosis"], definition: "Designing excitation/input signals specifically to make faults distinguishable.", category: "fdi-theory", canonicalReferences: ["Campbell & Nikoukhah (2004), Auxiliary Signal Design for Failure Detection (verify)", "Scott et al. (2013), active fault diagnosis survey (verify)"], relatedConcepts: ["diagnosability", "optimal-experiment-design", "dual-control"], notes: "Closest theory parent of Safe Active Diagnosis." },
  { id: "active-tactile", name: "Active Tactile Exploration", aliases: ["主动触觉探索", "active touch", "active perception"], definition: "Robot deliberately moves to gather tactile/contact information.", category: "robotics", canonicalReferences: ["verify against recent active-tactile literature"], relatedConcepts: ["active-fault-diagnosis", "information-gain"], notes: "Closest robotics parent of Safe Active Diagnosis." },
  { id: "dual-control", name: "Dual Control", aliases: ["对偶控制"], definition: "Control that simultaneously acts on the system and reduces its own uncertainty.", category: "control-theory", canonicalReferences: ["Feldbaum (1960-61) (verify)"], relatedConcepts: ["active-fault-diagnosis", "belief-space-planning"], notes: "" },
  { id: "pomdp", name: "POMDP", aliases: ["部分可观测马尔可夫决策过程"], definition: "Decision framework over belief states under partial observability.", category: "decision-theory", canonicalReferences: ["Kaelbling, Littman & Cassandra (1998) (verify)"], relatedConcepts: ["belief-space-planning", "dual-control"], notes: "" },
  { id: "belief-space-planning", name: "Belief-space Planning", aliases: ["信念空间规划"], definition: "Planning in the space of probability distributions over states.", category: "decision-theory", canonicalReferences: ["Kurniawati et al. (2008), SARSOP (verify)", "Platt et al. (2010) (verify)"], relatedConcepts: ["pomdp", "dual-control"], notes: "" },
  { id: "optimal-experiment-design", name: "Optimal Experiment Design", aliases: ["最优实验设计", "OED"], definition: "Choosing experiments to maximize expected information (e.g., D-optimality, EIG).", category: "statistics", canonicalReferences: ["Lindley (1956) (verify)"], relatedConcepts: ["information-gain", "value-of-information"], notes: "" },
  { id: "sequential-hypothesis-testing", name: "Sequential Hypothesis Testing", aliases: ["序贯假设检验", "SPRT"], definition: "Testing hypotheses with sequentially collected data, stopping when decision confidence is reached.", category: "statistics", canonicalReferences: ["Wald (1945), SPRT (verify)"], relatedConcepts: ["evidence-sufficiency", "bayes-risk"], notes: "" },
];

// ---------------------------------------------------------------------------
// Research Claims + Red Team evaluations (spec §73, §88, §89)
// DEMO dataset: hand-authored heuristic judgments for testing the system.
// Semantic relationship enum: essentially-equivalent | strong-overlap | partial-overlap | distinct | unclear
// Recommendation enum: keep | narrow | merge | rename | downgrade | remove
// ---------------------------------------------------------------------------
export const researchClaims = [
  {
    id: "claim-temporal-ft",
    title: "Temporal F/T provides non-redundant evidence beyond vision.",
    titleZh: "连续 F/T 历史能够提供视觉之外的非冗余物理证据。",
    description: "连续 6D F/T 历史携带视觉观测无法替代的失败证据。",
    category: "scientific-question",
    atomicClaims: ["6D F/T temporal history", "non-redundancy vs vision", "failure evidence"],
    closestConcepts: [],
    noveltyScore: 3, collisionRisk: 2,
    evidenceStrength: "medium",
    recommendation: "keep",
    redTeam: {
      closestRoboticsWork: "Vision-force fusion for contact state estimation（多篇，需逐篇比对是否使用时序 F/T 而非瞬时值）",
      existingTheory: "Information theory: redundancy between channels is measurable via mutual information.",
      strongestCounterexample: "任何使用 F/T 时序窗口做接触状态分类的工作（大量存在）",
      whatCanBeClaimed: "针对特定 failure hypothesis 集合，量化 F/T 时序证据的不可替代性",
      suggestedRewrite: "研究在{具体任务}中，F/T 时序特征对哪些失败假设提供视觉不可替代的判别证据（并给出信息论量化）。",
    },
    lastReviewed: "2026-09-13",
  },
  {
    id: "claim-passive-ambiguity",
    title: "Some contact failure hypotheses are indistinguishable under passive observation.",
    titleZh: "部分接触失败假设无法仅通过被动观测可靠区分。",
    description: "部分失败假设在被动观测下不可分，是主动诊断的存在前提。",
    category: "scientific-question",
    atomicClaims: ["passive observability limits", "failure hypothesis ambiguity"],
    closestConcepts: ["diagnosability", "observability"],
    noveltyScore: 2, collisionRisk: 4,
    evidenceStrength: "medium",
    recommendation: "narrow",
    redTeam: {
      closestRoboticsWork: "Active tactile exploration 文献已明确承认被动感知的局限并以此作为主动性的动机",
      existingTheory: "Diagnosability / observability 理论（经典 FDI 与控制理论）",
      strongestCounterexample: "可诊断性分析本身即是该论断的形式化，属于已有理论",
      whatCanBeClaimed: "针对{具体任务+假设集合}给出实证的被动不可分证据",
      suggestedRewrite: "实证刻画{任务}中哪些失败假设对在被动观测下不可分（以 diagnosability 度量），作为主动诊断必要性的依据。",
    },
    lastReviewed: "2026-09-13",
  },
  {
    id: "claim-risk-limited-probing",
    title: "Risk-limited diagnostic probing improves failure hypothesis discrimination.",
    titleZh: "风险受限主动探测能够提高失败假设辨识能力。",
    description: "在安全约束下主动探测能提升失败假设的可分性。",
    category: "method",
    atomicClaims: ["active probing", "risk/safety limits", "discriminability improvement"],
    closestConcepts: ["active-fault-diagnosis", "active-tactile", "dual-control", "optimal-experiment-design", "value-of-information"],
    noveltyScore: 3, collisionRisk: 4,
    evidenceStrength: "medium",
    recommendation: "narrow",
    redTeam: {
      closestRoboticsWork: "Active tactile exploration（信息增益驱动）+ auxiliary signal design（理论）",
      existingTheory: "Active Fault Diagnosis / Optimal Experiment Design / Dual Control",
      strongestCounterexample: "Probe-guided recovery 类工作已将探测用于失败处理闭环",
      whatCanBeClaimed: "力/力矩安全约束下的探测动作选择（constrained probe selection）",
      suggestedRewrite: "研究力/力矩安全约束下的探测动作选择：在给定失败假设集合上最大化判别信息并保证峰值力受限。",
    },
    lastReviewed: "2026-09-13",
  },
  {
    id: "claim-belief-recovery",
    title: "Posterior-conditioned recovery reduces wrong recovery actions.",
    titleZh: "基于失败后验的恢复能够降低错误恢复率。",
    description: "基于后验信念的条件化恢复策略减少错误恢复动作。",
    category: "method",
    atomicClaims: ["failure belief posterior", "conditioned recovery policy", "wrong recovery rate"],
    closestConcepts: ["bayes-risk", "belief-space-planning"],
    noveltyScore: 3, collisionRisk: 3,
    evidenceStrength: "medium",
    recommendation: "keep",
    redTeam: {
      closestRoboticsWork: "Failure-type-conditioned recovery strategies（存在，需比对条件化程度）",
      existingTheory: "Bayes risk 最优决策：按后验选择期望损失最小的恢复动作是经典结论",
      strongestCounterexample: "任何按失败类别切换恢复策略的工作",
      whatCanBeClaimed: "在误恢复代价不对称的任务中，belief-conditioned 相对 fixed/class-conditioned 的收益量化",
      suggestedRewrite: "研究在误恢复代价不对称场景下，failure-belief 条件化恢复相对固定策略的误恢复率降低及其机制。",
    },
    lastReviewed: "2026-09-13",
  },
  {
    id: "claim-vf-mpc-novelty",
    title: "Visual-force + MPC itself is NOT a sufficient novelty claim.",
    titleZh: "视觉力觉 + MPC 本身不足以构成核心创新。",
    description: "组合已知组件不构成创新；此 claim 用于自我约束表述。",
    category: "system",
    atomicClaims: ["visual-force fusion", "MPC"],
    closestConcepts: [],
    noveltyScore: 1, collisionRisk: 5,
    evidenceStrength: "high",
    recommendation: "downgrade",
    redTeam: {
      closestRoboticsWork: "大量视觉-力觉 + MPC/优化控制的工作",
      existingTheory: "组合式系统集成不属于科学新颖性论证",
      strongestCounterexample: "该 claim 的否定即本条存在的理由",
      whatCanBeClaimed: "仅作为系统集成表述，不作为创新点",
      suggestedRewrite: "不作为 novelty claim 使用；系统层面表述为 integration contribution。",
    },
    lastReviewed: "2026-09-13",
  },
];

// Evidence Sufficiency dedicated red-team demo (spec §89) — must show the
// system CAN reject a claimed novelty.
export const evidenceSufficiencyRedTeam = {
  claim: "证据充分性作为独立理论创新（Evidence Sufficiency）",
  verdict: {
    noveltyScore: 1, collisionRisk: 5, evidenceStrength: "high",
    recommendation: "rename",
    recommendationAlt: "narrow",
  },
  overlaps: [
    { conceptId: "selective-prediction", relationship: "strong-overlap" },
    { conceptId: "diagnosability", relationship: "strong-overlap" },
    { conceptId: "sequential-hypothesis-testing", relationship: "strong-overlap" },
    { conceptId: "value-of-information", relationship: "strong-overlap" },
    { conceptId: "prediction-confidence", relationship: "partial-overlap" },
    { conceptId: "epistemic-uncertainty", relationship: "partial-overlap" },
    { conceptId: "reject-option", relationship: "partial-overlap" },
    { conceptId: "fault-isolability", relationship: "partial-overlap" },
  ],
  existingTheory: "Selective prediction / reject option（Chow 1970 起）、diagnosability 与 fault isolability（FDI 理论）、SPRT（Wald）、VOI（Howard 1966）共同覆盖了“证据是否足够支持决策”这一表述。",
  closestRoboticsWork: "Active FDI 与 tactile exploration 文献中普遍以 stopping/decision 规则处理证据积累。",
  strongestCounterexample: "Sequential Probability Ratio Test：即“证据积累到阈值即决策”的经典形式化。",
  whatCanBeClaimed: "动作条件化的接触失败假设可辨识性及其在主动诊断决策中的作用",
  suggestedRewrite: "研究动作条件化的接触失败假设可辨识性（action-conditioned failure hypothesis diagnosability）及其在主动诊断决策中的角色；Evidence Sufficiency 仅作为操作变量使用。",
};

// Hostile reviewer prompt template (spec §55) — template only, no LLM wired in V2
export const aiRedTeamPrompt = `You are a hostile research reviewer.
Your goal is not to prove the research idea is novel.
Find prior concepts and papers that may invalidate the novelty claim.
For each claim:
1. decompose the claim;
2. identify canonical theoretical equivalents;
3. identify closest robotics work;
4. identify strongest counterexample;
5. determine remaining defensible difference;
6. return KEEP / NARROW / RENAME / REMOVE.
Never conclude "no prior work exists" only because search returned no result.`;

// ---------------------------------------------------------------------------
// Failure Hypothesis Lab (spec §18–§26) — default DEMO dataset.
// All user edits persist to localStorage (radar-v2-lab-*); defaults here are
// editable seeds, not hardcoded UI logic (spec §81).
// ---------------------------------------------------------------------------
export const labTasks = [
  {
    id: "peg-in-hole",
    name: "Peg-in-hole",
    nameZh: "插孔装配",
    description: "圆形轴孔插入，接触丰富，错位/卡滞高发。",
    robot: "6 自由度机械臂 + 腕部 6D F/T 传感器",
    sensors: ["RGB-D", "腕部 6D F/T"],
    // 阶段显示名（内部 phase 键不变）
    phases: ["approach", "contact", "insertion", "final"],
    phasesDisplay: ["接近", "接触", "插入", "完成"],
    failureHypotheses: ["success", "misalignment", "jam", "contact-loss", "unknown"],
    probeActions: ["micro-retreat", "small-advance", "lateral-probe", "micro-rotation"],
  },
];

// Hypothesis schema (spec §20). prior 0..1; severity/recoverability 0..1.
export const labHypotheses = [
  { id: "success", name: "Success", prior: 0.3, visualEvidence: ["插入深度增加"], forceEvidence: ["Fz 稳定"], temporalPattern: "Fz 平稳，力矩趋近零", expectedPhase: "完成阶段", severity: 0.0, recoverability: 1.0, notes: "" },
  { id: "misalignment", name: "Misalignment", prior: 0.25, visualEvidence: ["视觉上可能存在歧义"], forceEvidence: ["横向力矩增大"], temporalPattern: "Mx/My 持续同向偏移", expectedPhase: "接触阶段", severity: 0.4, recoverability: 0.8, notes: "" },
  { id: "jam", name: "Jam", prior: 0.2, visualEvidence: ["视觉外观与成功状态相似"], forceEvidence: ["轴向力持续偏高"], temporalPattern: "Fz 持续升高但位移不变", expectedPhase: "插入阶段", severity: 0.7, recoverability: 0.5, notes: "" },
  { id: "slip", name: "Slip", prior: 0.1, visualEvidence: ["物体位姿发生漂移"], forceEvidence: ["切向力振荡"], temporalPattern: "Ft/Fz 比值周期性跌落", expectedPhase: "接触阶段", severity: 0.5, recoverability: 0.7, notes: "" },
  { id: "contact-loss", name: "Contact Loss", prior: 0.1, visualEvidence: ["视觉变化较小"], forceEvidence: ["六维力/力矩回落至基线"], temporalPattern: "全轴力趋零", expectedPhase: "接触阶段", severity: 0.1, recoverability: 0.9, notes: "" },
  { id: "unknown", name: "Unknown", prior: 0.05, visualEvidence: [], forceEvidence: [], temporalPattern: "不符合以上任一模式", expectedPhase: "", severity: 0.5, recoverability: 0.3, notes: "开放集入口，不作结论性判断" },
];

// Probe action schema (spec §22). Numeric fields heuristic 0..1 unless unit given.
export const labProbes = [
  { id: "micro-retreat", name: "Micro Retreat", description: "沿插入轴微量回退，区分 jam（力不降）与 misalignment（力下降/侧移）", maxDisplacement: "1–3 mm", maxVelocity: null, maxForce: "10 N", maxTorque: null, expectedInformationGain: 0.6, riskScore: 0.15, timeCost: 0.1, reversible: true, applicableHypotheses: ["jam", "misalignment", "success"] },
  { id: "small-advance", name: "Small Advance", description: "小幅继续插入，确认是否真的卡死", maxDisplacement: "2 mm", maxVelocity: null, maxForce: "20 N", maxTorque: null, expectedInformationGain: 0.35, riskScore: 0.7, timeCost: 0.1, reversible: false, applicableHypotheses: ["jam", "success"] },
  { id: "lateral-probe", name: "Lateral Probe", description: "横向微动，激发 misalignment 特征的侧向力矩", maxDisplacement: "1 mm", maxVelocity: null, maxForce: "8 N", maxTorque: "1 Nm", expectedInformationGain: 0.8, riskScore: 0.25, timeCost: 0.15, reversible: true, applicableHypotheses: ["misalignment", "jam", "contact-loss"] },
  { id: "micro-rotation", name: "Micro Rotation", description: "绕轴微旋转，区分卡阻与对准误差", maxDisplacement: null, maxVelocity: null, maxForce: null, maxTorque: "0.5 Nm", expectedInformationGain: 0.5, riskScore: 0.3, timeCost: 0.2, reversible: true, applicableHypotheses: ["misalignment", "jam"] },
  { id: "re-contact", name: "Re-contact", description: "脱离后重新接触，确认 contact-loss", maxDisplacement: "5 mm", maxVelocity: null, maxForce: "10 N", maxTorque: null, expectedInformationGain: 0.55, riskScore: 0.2, timeCost: 0.3, reversible: true, applicableHypotheses: ["contact-loss", "slip"] },
  { id: "small-lift", name: "Small Lift", description: "小幅上提再落下，验证吸附/卡死状态", maxDisplacement: "3 mm", maxVelocity: null, maxForce: "10 N", maxTorque: null, expectedInformationGain: 0.4, riskScore: 0.2, timeCost: 0.25, reversible: true, applicableHypotheses: ["jam", "contact-loss"] },
];

// Hypothesis-pair discriminability ratings (hand-authored heuristics, spec §23).
// key = `${hA}-vs-${hB}` (ids sorted alphabetically); value = {probeId: 0..1}
export const labDiscriminability = {
  "jam-vs-misalignment": { "micro-retreat": 0.6, "lateral-probe": 0.9, "small-advance": 0.2, "micro-rotation": 0.7, "re-contact": 0.3, "small-lift": 0.4 },
  "jam-vs-success": { "micro-retreat": 0.7, "lateral-probe": 0.4, "small-advance": 0.8, "micro-rotation": 0.5, "re-contact": 0.3, "small-lift": 0.6 },
  "contact-loss-vs-jam": { "micro-retreat": 0.5, "lateral-probe": 0.6, "small-advance": 0.3, "micro-rotation": 0.2, "re-contact": 0.85, "small-lift": 0.75 },
  "misalignment-vs-success": { "micro-retreat": 0.4, "lateral-probe": 0.8, "small-advance": 0.5, "micro-rotation": 0.6, "re-contact": 0.2, "small-lift": 0.3 },
};

// Probe decision options + NetVOI weights (spec §24–§26). Heuristic 0..1 scales.
export const probeDecisionOptions = ["Probe", "Wait", "Continue", "Retreat", "Abstain", "Stop", "Human Escalation"];
export const netVoiConfig = {
  // NetVOI = decisionRiskReduction*decisionWeight - forceRisk*wF - damageRisk*wD - timeCost*wT - progressCost*wP
  decisionWeight: 1.0, forceWeight: 0.8, damageWeight: 1.0, timeWeight: 0.3, progressWeight: 0.4,
  recommendThreshold: 0.25, // NetVOI above → Probe Recommended
  scaleNote: "All values are heuristic estimates on a 0–1 scale, not calibrated probabilities.",
};

// Default NetVOI estimates per probe (spec §25) — heuristic, labeled as such.
export const labNetVoi = [
  { actionId: "micro-retreat", expectedInformationGain: 0.6, decisionRiskReduction: 0.55, forceRisk: 0.1, damageRisk: 0.1, timeCost: 0.1, progressCost: 0.05 },
  { actionId: "lateral-probe", expectedInformationGain: 0.8, decisionRiskReduction: 0.7, forceRisk: 0.2, damageRisk: 0.15, timeCost: 0.15, progressCost: 0.1 },
  { actionId: "small-advance", expectedInformationGain: 0.35, decisionRiskReduction: 0.3, forceRisk: 0.6, damageRisk: 0.7, timeCost: 0.1, progressCost: 0.15 },
  { actionId: "micro-rotation", expectedInformationGain: 0.5, decisionRiskReduction: 0.45, forceRisk: 0.25, damageRisk: 0.2, timeCost: 0.2, progressCost: 0.05 },
  { actionId: "re-contact", expectedInformationGain: 0.55, decisionRiskReduction: 0.5, forceRisk: 0.15, damageRisk: 0.1, timeCost: 0.3, progressCost: 0.2 },
  { actionId: "small-lift", expectedInformationGain: 0.4, decisionRiskReduction: 0.35, forceRisk: 0.15, damageRisk: 0.1, timeCost: 0.25, progressCost: 0.25 },
];

// ---------------------------------------------------------------------------
// Experiment Matrix Builder (spec §27–§30) — baseline & metric templates
// ---------------------------------------------------------------------------
export const experimentBaselines = [
  { id: "vision-only", name: "Vision Only", group: "ablation" },
  { id: "ft-only", name: "F/T Only", group: "ablation" },
  { id: "vf-fusion", name: "Vision + F/T", group: "ablation" },
  { id: "vf-no-history", name: "Vision + F/T without History", group: "ablation" },
  { id: "passive-detector", name: "Passive Detector", group: "passive-vs-active" },
  { id: "conf-threshold", name: "Confidence Threshold", group: "uncertainty" },
  { id: "abstain", name: "Abstain", group: "uncertainty" },
  { id: "random-probe", name: "Random Probe", group: "active" },
  { id: "eig-only-probe", name: "EIG-only Probe", group: "active" },
  { id: "risk-blind-probe", name: "Risk-blind Probe", group: "active" },
  { id: "fixed-recovery", name: "Fixed Recovery", group: "recovery" },
  { id: "class-conditioned-recovery", name: "Class-conditioned Recovery", group: "recovery" },
  { id: "belief-conditioned-recovery", name: "Belief-conditioned Recovery", group: "recovery" },
  { id: "proposed", name: "Proposed Method", group: "proposed" },
];

export const experimentMetrics = {
  Perception: ["Accuracy", "F1", "AUROC", "AUPRC", "Dangerous False Success", "Failure Detection Delay"],
  Uncertainty: ["ECE", "Brier Score", "NLL", "Coverage", "Selective Risk"],
  Diagnosis: ["Hypothesis Separation", "Entropy Reduction", "Mis-isolation Rate", "Diagnosis Time", "Probe Count"],
  Recovery: ["Recovery Success Rate", "Wrong Recovery Rate", "Task Completion Rate", "Fallback Rate", "Human Escalation Rate"],
  Safety: ["Peak Force", "Peak Torque", "Safety Violations", "Collision Count", "Secondary Damage Rate"],
  Efficiency: ["Task Time", "Probe Time", "Planning Latency", "Inference Latency"],
};

// Default suggested experiment matrix (spec §30 / 验收修复指令 §二.3) — seeds, editable in UI.
// baseline/variable/mainMetric/purpose 为用户可见显示文案（中文为主，F/T、EIG 等缩写保留）；
// claimId / applicableBaselines 为内部关联 key，保持英文不变（引用 experimentBaselines[].id）。
export const defaultExperiments = [
  { id: "E1", baseline: "仅视觉 / 仅力觉 / 视觉 + 力觉", variable: "模态", mainMetric: "危险假成功率 / F1", claimId: "claim-temporal-ft", purpose: "验证视觉 + 力觉是否优于视觉单模态", tag: "多模态价值", applicableBaselines: ["vision-only", "ft-only", "vf-fusion"] },
  { id: "E2", baseline: "无时序历史 / 有时序历史", variable: "F/T 历史", mainMetric: "F1 / 失败检测延迟", claimId: "claim-temporal-ft", purpose: "验证连续 F/T 历史是否优于瞬时 F/T", tag: "时序证据", applicableBaselines: ["vf-no-history", "vf-fusion"] },
  { id: "E3", baseline: "被动检测器 / 随机探测", variable: "主动探测", mainMetric: "后验熵下降量 / 错误隔离率", claimId: "claim-risk-limited-probing", purpose: "验证主动诊断是否优于被动观测", tag: "主动诊断", applicableBaselines: ["passive-detector", "random-probe", "conf-threshold", "abstain", "proposed"] },
  { id: "E4", baseline: "仅信息增益探测 / 不考虑风险的主动探测", variable: "风险项", mainMetric: "峰值接触力 / 安全约束违反次数", claimId: "claim-risk-limited-probing", purpose: "验证风险感知主动探测是否优于仅信息增益探测和不考虑风险的主动探测", tag: "安全探测", applicableBaselines: ["eig-only-probe", "risk-blind-probe", "proposed"] },
  { id: "E5", baseline: "固定恢复 / 基于失败类别的恢复", variable: "恢复策略输入", mainMetric: "错误恢复率 / 恢复成功率", claimId: "claim-belief-recovery", purpose: "验证基于失败后验的恢复是否优于固定恢复和基于失败类别的恢复", tag: "后验价值", applicableBaselines: ["fixed-recovery", "class-conditioned-recovery", "belief-conditioned-recovery"] },
];

// ---------------------------------------------------------------------------
// Research Decision Log (spec §39–§41) — default examples
// ---------------------------------------------------------------------------
export const defaultDecisions = [
  {
    id: "dec-evidence-sufficiency",
    date: "2026-09-13",
    decision: "证据充分性不再作为独立理论创新",
    reason: "与主动故障诊断（Active FDI）、选择性预测（Selective Prediction）、可诊断性（Diagnosability）、序贯假设检验（Sequential Hypothesis Testing）及信息价值（VOI）等已有理论存在明显重合。",
    evidence: ["红队审查评估：高度重合 ×4（选择性预测 / 可诊断性 / 序贯假设检验 / 信息价值）"],
    papers: [],
    previousState: "候选核心创新",
    newState: "操作性诊断决策变量",
    confidence: 85,
    status: "Accepted",
    keep: "动作条件化失败可辨识性",
  },
  {
    id: "dec-mppi-not-core",
    date: "2026-09-13",
    decision: "MPPI 不作为论文核心创新",
    reason: "MPPI 属于非线性、非凸控制优化的求解框架，不能直接解决失败信念、可辨识性和主动诊断问题",
    evidence: ["方法角色图谱：MPPI = 恢复优化类采样式求解器"],
    papers: [],
    previousState: "候选核心贡献",
    newState: "备选优化求解器",
    confidence: 90,
    status: "Accepted",
    useAs: "非光滑接触场景下的备选优化求解器",
  },
];

// ---------------------------------------------------------------------------
// Fusion Architecture Explorer (spec §31–§34) — descriptive comparison only;
// no runnable code is generated. Ratings are heuristic 0–10.
// ---------------------------------------------------------------------------
export const fusionArchitectures = [
  { id: "early", name: "Early Fusion", description: "输入级拼接（image feature + F/T concat），实现最简单，模态特异性建模弱。", visionRate: "30–60 Hz", forceRate: "100 Hz–1 kHz", usesHistory: false, contactAware: false, supportsAsync: false, supportsUncertainty: false, predictive: false, complexity: 2, realTimeSuitability: 9, representativePapers: [] },
  { id: "late", name: "Late Fusion", description: "各模态独立预测后融合决策，模态失败鲁棒，但无法建模跨模态时序交互。", visionRate: "30–60 Hz", forceRate: "100 Hz–1 kHz", usesHistory: false, contactAware: false, supportsAsync: true, supportsUncertainty: true, predictive: false, complexity: 3, realTimeSuitability: 8, representativePapers: [] },
  { id: "feature", name: "Feature Fusion", description: "中层特征级拼接/相加，兼顾表达与效率。", visionRate: "30–60 Hz", forceRate: "100 Hz–1 kHz", usesHistory: true, contactAware: false, supportsAsync: false, supportsUncertainty: false, predictive: false, complexity: 4, realTimeSuitability: 7, representativePapers: [] },
  { id: "gated", name: "Gated Fusion", description: "门控网络按模态可靠性加权，可部分处理模态退化。", visionRate: "30–60 Hz", forceRate: "100 Hz–1 kHz", usesHistory: true, contactAware: false, supportsAsync: false, supportsUncertainty: true, predictive: false, complexity: 5, realTimeSuitability: 7, representativePapers: [] },
  { id: "cross-attn", name: "Cross-Attention", description: "模态间交叉注意力，表达力强，计算代价较高。", visionRate: "30–60 Hz", forceRate: "100 Hz–1 kHz", usesHistory: true, contactAware: false, supportsAsync: true, supportsUncertainty: true, predictive: false, complexity: 7, realTimeSuitability: 5, representativePapers: [] },
  { id: "phase-conditioned", name: "Phase-conditioned Fusion", description: "按接触阶段（approach/contact/insertion）切换或条件化融合策略。", visionRate: "30–60 Hz", forceRate: "100 Hz–1 kHz", usesHistory: true, contactAware: true, supportsAsync: true, supportsUncertainty: true, predictive: false, complexity: 6, realTimeSuitability: 6, representativePapers: [] },
  { id: "slow-fast", name: "Slow-Fast Fusion", description: "视觉慢通路 + 力觉快通路异步融合，匹配两侧采样率差异。", visionRate: "30 Hz (slow)", forceRate: "1 kHz (fast)", usesHistory: true, contactAware: true, supportsAsync: true, supportsUncertainty: true, predictive: false, complexity: 6, realTimeSuitability: 7, representativePapers: [] },
  { id: "temporal-memory", name: "Temporal Memory", description: "显式时序记忆（RNN/SSM/transformer state）承载 F/T 历史。", visionRate: "30–60 Hz", forceRate: "100 Hz–1 kHz", usesHistory: true, contactAware: true, supportsAsync: true, supportsUncertainty: true, predictive: true, complexity: 6, realTimeSuitability: 6, representativePapers: [] },
  { id: "world-model", name: "World Model", description: "动作条件化的未来预测模型，支持多步推理；硕士阶段标记为后续扩展。", visionRate: "30–60 Hz", forceRate: "100 Hz–1 kHz", usesHistory: true, contactAware: true, supportsAsync: true, supportsUncertainty: true, predictive: true, complexity: 9, realTimeSuitability: 3, representativePapers: [], status: "后续扩展" },
];

// Recommended architecture for the current thesis (spec §33–§34) — display only.
export const recommendedArchitecture = {
  label: "当前推荐方案",
  // §十 管线中文主显示（内部 config key 不变）
  pipelineDisplay: [
    "视觉时序编码器（冻结 ViT / DINO 系列）",
    "+ F/T 时序编码器（TCN / 轻量级时序 Transformer）",
    "→ 接触 / 阶段门控",
    "→ 非对称交叉注意力",
    "→ 失败假设信念头",
    "→ 动作条件短时响应预测",
  ],
  pipeline: [
    "Visual Temporal Encoder (Frozen ViT/DINO-family)",
    "+ F/T Temporal Encoder (TCN / lightweight temporal Transformer)",
    "→ Contact / Phase Gate",
    "→ Asymmetric Cross-Attention",
    "→ Failure Belief Head",
  ],
  config: {
    visionEncoder: "Frozen ViT/DINO-family",
    forceEncoder: "TCN or lightweight temporal Transformer",
    fusion: "Contact-conditioned asymmetric cross-attention",
    stateHead: "Failure hypothesis belief",
    uncertainty: "Ensemble/Bayesian + calibration",
    predictiveHead: "Action-conditioned short-horizon response model",
  },
  // 配置卡显示名与值（§十）
  configDisplay: {
    visionEncoder: { label: "视觉编码器", value: "冻结 ViT / DINO 系列" },
    forceEncoder: { label: "力觉编码器", value: "TCN 或轻量级时序 Transformer" },
    fusion: { label: "融合方式", value: "接触条件化非对称交叉注意力" },
    stateHead: { label: "状态输出头", value: "失败假设后验信念" },
    uncertainty: { label: "不确定性建模", value: "集成 / 贝叶斯不确定性 + 校准" },
    predictiveHead: { label: "预测头", value: "动作条件短时响应预测模型" },
  },
  note: "当前推荐路线不是简单地将视觉特征与 F/T 数值拼接，而是针对视觉与力觉异步、采样频率不同、有效阶段不同的特点，采用双流时序编码和接触条件化融合。仅用于展示推荐路线，不生成可运行代码。",
};

// ---------------------------------------------------------------------------
// Method Role Map (spec §35–§36) — categorized by ROLE, not by SOTA ranking.
// "doesNotSolve" is the core anti-"热门算法=创新" field.
// ---------------------------------------------------------------------------
export const methodRoles = [
  { role: "State / Belief Estimation", methods: [
    { name: "Bayesian Filter", solves: "递归状态/信念估计", doesNotSolve: "主动选择观测动作；模型失配时的鲁棒性" },
    { name: "IMM", solves: "多模型切换下的状态估计", doesNotSolve: "失败假设级诊断决策；探测动作选择" },
    { name: "Particle Filter", solves: "非线性/非高斯信念估计", doesNotSolve: "可诊断性保证；信息增益优化" },
    { name: "TCN", solves: "F/T 时序特征提取", doesNotSolve: "信念校准；主动诊断决策" },
    { name: "Transformer", solves: "长程时序依赖建模", doesNotSolve: "失败信念的因果保证；安全约束" },
    { name: "SSM", solves: "长序列高效时序建模", doesNotSolve: "可辨识性分析；风险控制" },
  ]},
  { role: "Active Diagnosis", methods: [
    { name: "EIG", solves: "期望信息增益最大化", doesNotSolve: "力/损伤风险约束；时间成本" },
    { name: "VOI", solves: "信息收益减去代价的决策", doesNotSolve: "概率估计本身的可靠性" },
    { name: "Optimal Experiment Design", solves: "实验/激励信号设计", doesNotSolve: "闭环恢复；实时安全" },
    { name: "Dual Control", solves: "控制与不确定性降低的联合优化", doesNotSolve: "大规模问题可解性；工程部署" },
    { name: "Belief-space MPC", solves: "信念空间滚动优化", doesNotSolve: "信念模型正确性；失败假设完备性" },
    { name: "POMDP", solves: "部分可观测序贯决策建模", doesNotSolve: "高维连续问题的可解性" },
  ]},
  { role: "Recovery Optimization", methods: [
    { name: "MPC", solves: "约束下滚动优化", doesNotSolve: "失败信念估计；可诊断性；不确定性校准" },
    { name: "Risk-sensitive MPC", solves: "风险敏感的约束优化", doesNotSolve: "失败假设的来源与更新" },
    { name: "DRMPC", solves: "分布鲁棒约束优化", doesNotSolve: "信念估计；诊断决策" },
    { name: "MPPI", solves: "nonlinear/nonconvex sampling-based optimization", doesNotSolve: "failure belief estimation；diagnosability；uncertainty calibration", note: "用途：nonsmooth contacts 的替代求解器，不是论文核心创新" },
    { name: "Trajectory Optimization", solves: "轨迹级规划", doesNotSolve: "在线失败处理" },
  ]},
  { role: "Interaction Control", methods: [
    { name: "Impedance", solves: "接触柔顺控制", doesNotSolve: "失败检测；诊断" },
    { name: "Admittance", solves: "力输入下的柔顺控制", doesNotSolve: "失败检测；诊断" },
    { name: "Hybrid Force/Position", solves: "力/位混合约束控制", doesNotSolve: "信念估计；主动探测" },
    { name: "Sliding Mode", solves: "鲁棒跟踪", doesNotSolve: "柔顺交互；不确定性量化" },
    { name: "Super-Twisting", solves: "高阶滑模鲁棒控制", doesNotSolve: "诊断与恢复决策" },
  ]},
  { role: "Safety", methods: [
    { name: "CBF", solves: "状态约束的前向不变性保证", doesNotSolve: "失败信念估计；诊断" },
    { name: "Passivity", solves: "能量层面稳定性保证", doesNotSolve: "诊断决策；信息获取" },
    { name: "Energy Tank", solves: "无源性的能量预算实现", doesNotSolve: "任务级决策" },
    { name: "Safety Filter", solves: "命令级安全过滤", doesNotSolve: "信念与恢复策略生成" },
  ]},
];

// ---------------------------------------------------------------------------
// Master → PhD Expansion Tree (spec §42–§43, §71) — no fabricated acceptance odds
// ---------------------------------------------------------------------------
export const expansionTree = {
  // §47 硕士核心（显示用文案）
  masterCore: ["视觉 + 连续 F/T 失败信念", "风险受限主动诊断", "后验驱动风险恢复"],
  phdDirections: [
    { id: "d1", title: "Open-set Failure Discovery", titleZh: "开放集 / 未知失败发现", scientificValue: "突破封闭假设集限制", noveltyRisk: "中", technicalDifficulty: "高", masterReuse: "失败信念中保留未知失败通道", requiredHardware: "现有平台", requiredData: "开放式失败数据积累", potentialVenues: "robotics learning 类（需核验）", closestPapers: [] },
    { id: "d2", title: "Action-conditioned Physical World Model", titleZh: "动作条件物理世界模型", scientificValue: "接触动力学的可预测建模", noveltyRisk: "高（领域热点）", technicalDifficulty: "很高", masterReuse: "action-conditioned response model 直接衔接", requiredHardware: "现有平台 + 更高精度 F/T", requiredData: "大量交互数据", potentialVenues: "CoRL/RSS/ICRA（需核验）", closestPapers: [] },
    { id: "d3", title: "Vision + F/T + Tactile", titleZh: "视觉 + 腕部 F/T + 指尖触觉", scientificValue: "第三模态补全接触信息流", noveltyRisk: "中", technicalDifficulty: "高", masterReuse: "双流架构可扩展为三流", requiredHardware: "指尖触觉阵列", requiredData: "多模态标定数据", potentialVenues: "ICRA/IROS（需核验）", closestPapers: [] },
    { id: "d4", title: "Cross-task Generalization", titleZh: "跨任务泛化", scientificValue: "失败诊断策略的跨任务迁移", noveltyRisk: "中", technicalDifficulty: "高", masterReuse: "假设集合参数化可复用", requiredHardware: "多任务工位", requiredData: "多任务失败数据", potentialVenues: "CoRL/RSS（需核验）", closestPapers: [] },
    { id: "d5", title: "Cross-object Generalization", titleZh: "跨物体泛化", scientificValue: "物体几何/材料变化下的鲁棒性", noveltyRisk: "中", technicalDifficulty: "中高", masterReuse: "同一诊断框架", requiredHardware: "现有平台", requiredData: "多物体实验", potentialVenues: "ICRA/IROS（需核验）", closestPapers: [] },
    { id: "d6", title: "Cross-robot / Cross-embodiment", titleZh: "跨机器人 / 跨本体泛化", scientificValue: "跨本体迁移", noveltyRisk: "高", technicalDifficulty: "很高", masterReuse: "传感器抽象层", requiredHardware: "至少两台机器人", requiredData: "跨本体数据", potentialVenues: "CoRL/RSS（需核验）", closestPapers: [] },
    { id: "d7", title: "Continual Failure Learning", titleZh: "持续失败学习", scientificValue: "新失败类型的持续学习", noveltyRisk: "中", technicalDifficulty: "高", masterReuse: "Unknown 通道 + 信念更新", requiredHardware: "现有平台", requiredData: "长期运行日志", potentialVenues: "robot learning（需核验）", closestPapers: [] },
    { id: "d8", title: "Safety Guarantees", titleZh: "可证明安全保证", scientificValue: "主动诊断过程的形式化安全", noveltyRisk: "中高", technicalDifficulty: "高", masterReuse: "Safety Layer + NetVOI 约束", requiredHardware: "现有平台", requiredData: "安全边界实验", potentialVenues: "RSS/TRO（需核验）", closestPapers: [] },
    { id: "d9", title: "Foundation Policy / VLA Integration", titleZh: "基础策略 / VLA 融合", scientificValue: "VLA 失败处理能力补全", noveltyRisk: "高（快速拥挤）", technicalDifficulty: "高", masterReuse: "失败信念作为 VLA 监控层", requiredHardware: "VLA 推理算力", requiredData: "VLA 微调数据", potentialVenues: "CoRL（需核验）", closestPapers: [], status: "可选 / 后续融合" },
  ],
};
