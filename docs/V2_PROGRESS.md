# V2 Progress Log

> 规则：每个阶段一条记录，最新在最上。禁止发布（deploy）直至人工验收。

---

## V2-METHOD-KB — 方法知识库升级：解释/KaTeX 公式/代表论文三分类（代码+测试完成）

- **Status**: ✅ 代码+测试完成，待全量验证
- **Feature**: 26 方法全部新增 30 秒理解、直观机器人示例、输入/输出、KaTeX 标准公式（32 个公式块逐项解释）、机器人运行流程、相近方法区别（13 组指定对比全覆盖）、当前课题接入层、推荐程度原因；代表论文三分类（经典基础 / 机器人应用 / 与课题最近，38 篇唯一文献全部检索核验，含 relevanceNote / publication status / verification level）；Modal 重排为 19 段学习顺序，中文标题醒目英文辅助；KaTeX 0.16.11 本地 vendor（无 CDN），渲染失败降级原文不白屏，dark/light 主题色继承；旧字段保留兼容
- **Files Changed**: `web/assets/vendor/katex/`（新增）、`web/assets/v2/method-knowledge.js`（新增）、`web/assets/v2/workspace.js`（renderMathIn / paperGroups 渲染 / Modal 重构）、`web/assets/style.css`、`web/index.html`、`tests/method_knowledge_harness.mjs`（新增）、`docs/METHOD_REFERENCE_AUDIT.md`（新增）、`README.md`
- **Tests**: method_knowledge_harness 24/24 PASS
- **Known Issues**: 文献均为 ABSTRACT_VERIFIED；部分方法机器人应用类留空（宁缺毋滥）；未向 papers.json 新增条目
- **Next Step**: 全量测试 + build + 冒烟 + diff 自审

---

## V2-METHOD-MODAL — 方法详情悬浮窗口（本地完成，待部署）

- **Status**: ✅ 完成（本地测试通过）
- **Feature**: 方法角色图谱全部 26 个方法卡片可点击，打开 Modal 详情（原理/数学形式/能解决/不能直接解决/优缺点/适用场景/当前课题作用/推荐组合/难度/推荐程度/代表论文）；顶部快速摘要标签（研究角色/当前推荐/实现难度/是否核心创新）；× / 遮罩 / Esc 三种关闭方式；背景滚动锁定、关闭恢复焦点；related methods 点击就地切换；公式用 `<pre>` 文本不引入公式库；数据全部来自 `method-details.js`，无硬编码，字段缺失优雅降级；代表论文仅引用已核验 paper id，无则显示「暂无已核验代表论文」
- **Files Changed**: `web/assets/v2/method-details.js`（新增，26 个方法）、`web/assets/v2/workspace.js`（openMethodModal + methods 视图卡片接入）、`web/assets/style.css`（卡片 hover/cursor/Modal 尺寸/摘要标签/数学 pre/相关方法 chip，全用主题变量）
- **Tests**: 渲染 harness 新增 M1–M10（Modal 打开/内容/三种关闭/MPPI 定位/VOI 代价说明/相关方法切换/主题变量/卡片原信息保留），全过
- **Known Issues**: 代表论文关联留空（需人工核验后填写 paper_id）；公式为纯文本形式（不引入 KaTeX/MathJax）
- **Next Step**: 全量测试 + build + 部署

## V2-CN — 界面与研究术语中文化（本地完成，未部署）

- **Status**: ✅ 完成（等待人工验收）
- **Feature**: 统一中文映射层 `web/assets/v2/i18n.js`（role/status/risk/dimension/impact/verification/关系/建议/假设/探测/任务/baseline/metric/融合/方法角色/扩展字段/按钮提示）；一级入口改为"研究工作台"，11 个 Tab 全部中文；全部 11 个视图用户可见文案中文化（论文标题/作者/venue/DOI/算法缩写/内部 enum 保留英文）；证据充分性显示为"证据充分性（操作性决策变量）"并附中文说明；术语统一（撞题/信念/暂缓判断/主动探测/失败假设/失败假设可辨识性）；中文断行防护 CSS；`docs/RESEARCH_METHOD_SEMANTICS.md` 重写为中文为主；README Workspace 章节改为"研究工作台"
- **Files Changed**: `web/assets/v2/i18n.js`（新增）、`web/assets/v2/workspace.js`、`web/assets/v2/v2-data.js`（titleZh/title 中文化、新增 multimodal-fusion 节点、expansionTree titleZh、evidenceGateNoteZh）、`web/assets/style.css`（中文断行防护）、`web/index.html`（侧边栏入口）、`docs/RESEARCH_METHOD_SEMANTICS.md`、`README.md`
- **Tests**: 内部 enum/id/JSON key/localStorage schema 未改动；V2 logic 与回归测试见下一条验收记录
- **Known Issues**: 科学术语首次出现保留英文括号（科研惯例）；红线：未做任何自动机器翻译，全部采用指令给定术语
- **Next Step**: 回归测试 + 未翻译扫描 + 中文验收报告

## P5 — Workspace Dashboard + Expansion Tree + Next Action

- **Status**: ✅ 完成（本地验证通过，未部署）
- **Feature**: Dashboard 聚合视图（Current Thesis / Core Questions / Top 5 Collisions / Top 3 Gaps / Experiments / Recent Decisions / Window Closing Alerts）、规则化 Next Recommended Action、Master→PhD Expansion Tree（D1–D9）
- **Files Changed**: `web/assets/v2/workspace.js`（dashboard/expansion 视图）、`web/assets/v2/v2-data.js`（expansionTree）、`web/assets/style.css`
- **Tests**: 24 项 V2 逻辑测试全过；build OK；本地预览 200
- **Known Issues**: Next Action 规则基于本地数据（论文数、用户核验状态），非 AI 判断（按 spec §72/§79）
- **Next Step**: 人工验收

## P4 — Fusion Explorer + Method Role Map + Gap Confidence

- **Status**: ✅ 完成
- **Feature**: Multimodal Fusion Explorer（9 种融合方式对比 + Recommended Architecture，标记 "Current Research Recommendation"）、Method Role Map（按角色分类，每个方法标注 SOLVES / DOES NOT SOLVE，防"热门算法=创新"）、Gap Confidence Monitor（gap_status → V2 status 映射；evidence/collision 分数仅人工核验后填写，缺失显示"未评估"不虚构）
- **Files Changed**: `web/assets/v2/workspace.js`、`web/assets/v2/v2-data.js`、`web/assets/style.css`
- **Tests**: harness + build OK
- **Known Issues**: World model 标记 Future Extension；VLA 标记 Optional / Future Integration
- **Next Step**: P5

## P3 — Experiment Matrix Builder + Research Decision Log

- **Status**: ✅ 完成
- **Feature**: 14 个 baseline 模板（可勾选启用/禁用，localStorage 持久化）、6 类 metrics 模板、E1–E5 默认实验矩阵关联 claims、Markdown 导出；Decision Log（新增决策、追加说明、默认两条示例：Evidence Sufficiency 降级、MPPI 不作核心创新）
- **Files Changed**: `web/assets/v2/workspace.js`、`web/assets/v2/v2-data.js`、`web/assets/style.css`
- **Tests**: harness + build OK
- **Known Issues**: 新增决策用浏览器 prompt()，后续可换表单
- **Next Step**: P4

## P2 — Novelty Red Team + Failure Hypothesis Lab

- **Status**: ✅ 完成
- **Feature**: Red Team（Evidence Sufficiency 专属否定示例：Strong Overlap ×4 → RENAME/NARROW；5 个默认 claims 带完整红队评估；概念字典 20 条；敌意审稿人 prompt 模板仅展示不调用）；Failure Lab（Peg-in-hole task、6 个失败假设、6 个 probe、可编辑假设矩阵、假设对比判别性表、NetVOI 启发式计算 + Probe/Abstain 推荐）
- **Files Changed**: `web/assets/v2/workspace.js`、`web/assets/v2/v2-data.js`、`web/assets/style.css`
- **Tests**: NetVOI 算术、负 NetVOI → Abstain、"不值得探索"状态、pairKey 对称性测试通过
- **Known Issues**: 判别性评分为人工填写（spec §23 第一版要求），未接 AI
- **Next Step**: P3

## P1 — My Research Thesis + Collision Radar

- **Status**: ✅ 完成
- **Feature**: Thesis 图（11 个默认节点 + Evidence/Diagnosability Gate，节点点击弹信息卡，状态/置信度可编辑并持久化，Markdown 导出）；Collision Radar（规则化可解释评分、权重集中 collisionConfig、风险五级映射、Why It Collides / What It Does Not Cover、Impact/Verification/Closest Node 标注、New This Week / Score Increased / Recently Published / Requires Re-review 四类监控）
- **Files Changed**: `web/index.html`（sidebar + workspace-section + 脚本引入）、`web/assets/app.js`（workspace 路由分支 + rerender 钩子）、`web/assets/v2/workspace.js`、`web/assets/v2/v2-data.js`、`web/assets/style.css`、`tests/test_v2_logic.py`、`tests/v2_logic_harness.mjs`
- **Tests**: 18 项逻辑测试（权重和=100、风险边界、双传感器交集、裸 schema 不崩溃）；build + 预览 OK
- **Known Issues**: collision 变化历史存 localStorage（管线每日覆盖 papers.json，不能写入其中）
- **Next Step**: P2

## Phase 0 — Repository Audit

- **Status**: ✅ 完成
- **Feature**: 完整审计（技术栈 vanilla JS + Python 管线、无框架、GitHub Pages 相对路径安全、复用点清单、技术债清单）
- **Files Changed**: `docs/V2_EXISTING_SYSTEM_AUDIT.md`
- **Tests**: 本地 server（index/app.js/data.json = 200）；test_schema/test_frontend_layout 回归 OK
- **Known Issues**: 全量 unittest 在本机 >120s（test_landscape/test_stability 内部有 retry sleep），验收按文件分跑；无 lint、无 JS 测试框架（如实报告，不伪造）
- **Next Step**: P1
