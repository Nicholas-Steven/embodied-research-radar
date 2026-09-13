# V2 Progress Log

> 规则：每个阶段一条记录，最新在最上。禁止发布（deploy）直至人工验收。

---

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
