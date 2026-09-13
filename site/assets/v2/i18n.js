// V2 中文显示映射层（唯一来源，禁止在页面里散落 if(status) 判断）
// 原则：内部 enum / id / JSON key 保持英文；所有用户可见文字经此映射显示。
// 路由 key（ws key）不改，仅 tab 显示名映射。

// 一级入口与 Tab（spec 中文化指令 §5 / §7 / §11）
export const tabLabels = {
  dashboard: '工作台总览',
  thesis: '我的研究主线',
  collision: '撞题雷达',
  'red-team': '创新性红队审查',
  'failure-lab': '失败假设实验室',
  experiments: '实验设计器',
  decisions: '研究决策日志',
  gaps: '研究缺口可信度',
  methods: '方法角色图谱',
  fusion: '视觉力觉融合架构',
  expansion: '硕士博士研究扩展',
};

// Research Node role（内部值英文，显示中文；§11）
export const roleLabels = {
  'core-question': '核心科学问题',
  'core-algorithm': '核心算法问题',
  supporting: '支撑方法',
  baseline: '对比方法',
  safety: '安全层',
  future: '后续扩展',
};

// Research Node status（§12）
export const statusLabels = {
  'not-started': '尚未开始',
  reading: '文献阅读中',
  reproducing: '复现中',
  designing: '方案设计中',
  experimenting: '实验进行中',
  validated: '已验证',
  rejected: '已放弃',
};

// Collision 风险等级（§17）
export const riskLabels = {
  low: '低',
  moderate: '中等',
  high: '高',
  'very-high': '很高',
  critical: '极高',
};

// Collision 六维（§16）
export const dimensionLabels = {
  sensorOverlap: '传感模态重合',
  problemOverlap: '科学问题重合',
  stateOverlap: '状态 / 信念表示重合',
  activeActionOverlap: '主动动作机制重合',
  recoveryOverlap: '恢复机制重合',
  theoryOverlap: '理论基础重合',
};

// 对课题影响（§19）
export const impactLabels = {
  'No impact': '暂无明显影响',
  'Requires wording change': '需要修改创新表述',
  'Requires stronger baseline': '需要增加更强基线',
  'Weakens innovation': '削弱当前创新主张',
  'Invalidates current claim': '当前创新主张可能不成立',
};

// 文献核验状态（§18 卡片级 + §50 verification level）
export const cardVerificationLabels = {
  'Metadata only': '仅元数据',
  'Abstract verified': '摘要已核验',
  'Full paper checked': '全文已核验',
  'Supplement checked': '补充材料已核验',
};
export const verificationLevelLabels = {
  DISCOVERED: '已发现',
  METADATA_VERIFIED: '元数据已核验',
  ABSTRACT_VERIFIED: '摘要已核验',
  FULLTEXT_VERIFIED: '全文已核验',
  SUPPLEMENT_VERIFIED: '正文与补充材料均已核验',
};

// 语义重合关系（§22）
export const relationLabels = {
  'essentially-equivalent': '基本等价',
  'strong-overlap': '高度重合',
  'partial-overlap': '部分重合',
  'distinct': '明显不同',
  'unclear': '尚不明确',
};

// 红队审查建议（§23；内部值小写枚举）
export const recommendationLabels = {
  keep: '保留',
  narrow: '保留，但需收缩',
  merge: '合并到其他创新点',
  rename: '重新命名',
  downgrade: '降级为支撑内容',
  remove: '删除',
};

// Gap 状态（§44）
export const gapStatusLabels = {
  STRONG: '较强研究空间',
  VIABLE: '可继续研究',
  TENTATIVE: '暂定研究空间',
  'WINDOW CLOSING': '研究窗口正在收窄',
  'COLLISION DETECTED': '已发现高重合研究',
  REJECTED: '已放弃',
};

// 失败假设名称（§28；内部 id 不变）
export const hypothesisNameLabels = {
  success: '成功',
  misalignment: '错位',
  jam: '卡滞',
  slip: '滑移',
  'contact-loss': '接触丢失',
  unknown: '未知失败',
};
// misalignment tooltip（§28）
export const hypothesisTips = {
  misalignment: '包括位置或姿态未正确对准。',
};

// 探测动作名称（§30）
export const probeNameLabels = {
  'micro-retreat': '微量回撤',
  'small-advance': '小幅推进',
  'lateral-probe': '侧向微探',
  'micro-rotation': '微小旋转',
  're-contact': '受控重新接触',
  'small-lift': '小幅抬升',
};

// 操作任务名称（§27）
export const taskNameLabels = {
  'peg-in-hole': '插孔装配',
  'connector-insertion': '连接器插入',
  'grasp-lift': '抓取抬升',
  handover: '物体交接',
  drawer: '抽屉操作',
  door: '门操作',
  wiping: '擦拭',
  'cable-insertion': '线缆插接',
};

// 主动探测决策选项（§33；内部值英文）
export const decisionOptionLabels = {
  Probe: '主动探测',
  Wait: '等待',
  Continue: '继续执行',
  Retreat: '回撤',
  Abstain: '暂缓判断',
  Stop: '安全停止',
  'Human Escalation': '请求人工介入',
};

// 判别性等级
export const discriminabilityLabels = {
  'VERY HIGH': '极高',
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
  'VERY LOW': '极低',
};

// Baseline 名称（§37）
export const baselineLabels = {
  'vision-only': '仅视觉（Vision Only）',
  'ft-only': '仅力觉（F/T Only）',
  'vf-fusion': '视觉 + 力觉',
  'vf-no-history': '视觉 + 力觉（无时序历史）',
  'passive-detector': '被动检测器',
  'conf-threshold': '置信度阈值',
  'abstain': '暂缓判断',
  'random-probe': '随机探测',
  'eig-only-probe': '仅信息增益探测',
  'risk-blind-probe': '不考虑风险的主动探测',
  'fixed-recovery': '固定恢复策略',
  'class-conditioned-recovery': '基于失败类别的恢复',
  'belief-conditioned-recovery': '基于失败后验的恢复',
  'proposed': '本文方法',
};

// 评价指标中文（§38；按英文原名映射）
export const metricLabels = {
  'Accuracy': '准确率',
  'F1': 'F1 分数',
  'AUROC': 'AUROC',
  'AUPRC': 'AUPRC',
  'Dangerous False Success': '危险假成功率',
  'Failure Detection Delay': '失败检测延迟',
  'ECE': '期望校准误差（ECE）',
  'Brier Score': 'Brier 评分',
  'NLL': '负对数似然（NLL）',
  'Coverage': '覆盖率',
  'Selective Risk': '选择性风险',
  'Hypothesis Separation': '假设分离度',
  'Entropy Reduction': '后验熵下降量',
  'Mis-isolation Rate': '错误隔离率',
  'Diagnosis Time': '诊断时间',
  'Probe Count': '主动探测次数',
  'Recovery Success Rate': '恢复成功率',
  'Wrong Recovery Rate': '错误恢复率',
  'Task Completion Rate': '任务完成率',
  'Fallback Rate': '安全回退率',
  'Human Escalation Rate': '人工介入率',
  'Peak Force': '峰值接触力',
  'Peak Torque': '峰值力矩',
  'Safety Violations': '安全约束违反次数',
  'Collision Count': '碰撞次数',
  'Secondary Damage Rate': '二次损伤率',
  'Task Time': '任务时间',
  'Probe Time': '探测时间',
  'Planning Latency': '规划延迟',
  'Inference Latency': '推理延迟',
};
// metrics 分组名
export const metricGroupLabels = {
  Perception: '感知',
  Uncertainty: '不确定性',
  Diagnosis: '诊断',
  Recovery: '恢复',
  Safety: '安全',
  Efficiency: '效率',
};

// 融合架构名称（§39）
export const fusionLabels = {
  early: '早期融合（Early Fusion）',
  late: '后期融合（Late Fusion）',
  feature: '特征级融合（Feature Fusion）',
  gated: '门控融合（Gated Fusion）',
  'cross-attn': '交叉注意力融合（Cross-Attention）',
  'phase-conditioned': '阶段条件融合（Phase-conditioned）',
  'slow-fast': '快慢双时间尺度融合（Slow-Fast）',
  'temporal-memory': '时序记忆融合（Temporal Memory）',
  'world-model': '世界模型融合（World Model）',
};

// 方法角色分组（§41）
export const methodRoleGroupLabels = {
  'State / Belief Estimation': '状态 / 信念估计',
  'Active Diagnosis': '主动诊断',
  'Recovery Optimization': '恢复优化',
  'Interaction Control': '接触执行控制',
  'Safety': '安全约束',
};

// 博士扩展字段（§49）
export const expansionFieldLabels = {
  scientificValue: '科学价值',
  noveltyRisk: '创新性风险',
  technicalDifficulty: '技术难度',
  masterReuse: '硕士成果复用度',
  requiredHardware: '所需硬件',
  requiredData: '所需数据',
  potentialVenues: '潜在投稿方向',
  closestPapers: '最接近论文',
};

// 按钮与提示（§51 / §52）
export const ui = {
  exportMarkdown: '导出 Markdown',
  add: '添加',
  edit: '编辑',
  delete: '删除',
  save: '保存',
  cancel: '取消',
  reset: '重置',
  viewPaper: '查看论文',
  reReview: '重新审查',
  addDecision: '添加研究决策',
  close: '关闭',
  goTo: '前往',
  noData: '暂无数据',
  noPapers: '暂未关联论文',
  noCollision: '暂未发现明显撞题论文',
  requiresVerification: '需要进一步核验',
  heuristicEstimate: '启发式估计',
  unassessed: '未评估',
  pending: '待标注',
};
