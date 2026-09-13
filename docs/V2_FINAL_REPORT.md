# V2 Final Report — Research Workspace

> 日期：2026-09-13 · 状态：本地开发完成，**未部署**（等待人工验收）

## 1. 本次开发完成什么

把 Embodied Research Radar 从论文发现/趋势展示工具升级为研究决策辅助系统
（Paper → Evidence → Collision → Gap → Research Question → Experiment → Decision）。
按 Phase 0 审计 → P1–P5 分阶段完成，未破坏任何 V1 功能，未部署。

## 2. 新增页面（Research Workspace，`?view=workspace&ws=…`）

| ws key | 页面 | 核心内容 |
|---|---|---|
| dashboard | Workspace Dashboard | 当前课题、核心问题、Top 5 撞题、Top 3 gaps、实验、决策、窗口告警、Next Recommended Action（规则化） |
| thesis | My Research Thesis | 11 节点研究主线图 + Evidence/Diagnosability Gate + 节点信息卡（状态/置信度可编辑） |
| collision | Collision Radar | 六维规则化撞题评分、五级风险、Why/Not Cover、监控告警 |
| red-team | Novelty Red Team | Evidence Sufficiency 否定示例 + 5 个默认 claims 红队评估 + 20 条概念字典 + prompt 模板 |
| failure-lab | Failure Hypothesis Lab | 可编辑假设矩阵、假设对判别性、NetVOI Probe/Abstain 决策 |
| experiments | Experiment Builder | 14 baseline 模板、6 类 metrics、E1–E5 实验矩阵 |
| decisions | Decision Log | 研究决策记录（含两条默认示例） |
| gaps | Gap Confidence Monitor | gap_status → STRONG/VIABLE/TENTATIVE/WINDOW CLOSING 映射 |
| methods | Method Role Map | 按角色分类 + SOLVES / DOES NOT SOLVE |
| fusion | Fusion Explorer | 9 种融合架构对比 + Current Research Recommendation |
| expansion | Research Expansion | 硕士核心 → 博士 D1–D9 扩展树 |

## 3. 新增组件

- `web/assets/v2/v2-data.js` — 全部研究配置数据（profile/nodes/concepts/claims/fusion/methods/expansion），换课题不改源码
- `web/assets/v2/workspace.js` — workspace 路由 + 11 个视图渲染器 + localStorage 持久化层 + Markdown 导出
- sidebar WORKSPACE 导航组、workspace-section 容器、ws-* 样式体系（全部走现有 CSS 变量，支持 dark mode）
- 论文跳转钩子（workspace → 论文 Reader 双向打通）

## 4. 新增数据结构

- `researchProfile` / `researchNodes` / `researchEdges`（Research Node schema，role/status 枚举）
- `collisionConfig`（集中权重，六维合计 100）/ `criticalCollisionTopics`
- `researchConcepts`（概念字典：aliases/definition/category/canonicalReferences 标注 verify）
- `researchClaims`（Novelty Score / Collision Risk / Evidence Strength / Recommendation 枚举）
- `evidenceSufficiencyRedTeam`（RENAME/NARROW 否定示例）
- `labTasks` / `labHypotheses` / `labProbes` / `labDiscriminability` / `netVoiConfig` / `labNetVoi`
- `experimentBaselines` / `experimentMetrics` / `defaultExperiments` / `defaultDecisions`
- `fusionArchitectures` / `recommendedArchitecture` / `methodRoles` / `expansionTree`
- 论文 V2 字段采用 **localStorage 按 paper_id 关联**（firstSeen/lastChecked/collisionScore/previousCollisionScore、impact、verification）——见 ADR-001，papers.json 保持管线产物不动

## 5. 修改文件列表

- 新增：`docs/V2_EXISTING_SYSTEM_AUDIT.md`、`docs/V2_PROGRESS.md`、`docs/V2_ARCHITECTURE_DECISIONS.md`、`docs/RESEARCH_METHOD_SEMANTICS.md`、`docs/V2_FINAL_REPORT.md`、`web/assets/v2/v2-data.js`、`web/assets/v2/workspace.js`、`tests/v2_logic_harness.mjs`、`tests/test_v2_logic.py`
- 修改：`web/index.html`（导航 + 容器 + 脚本）、`web/assets/app.js`（workspace 路由分支 + rerender 钩子，3 处单行改动）、`web/assets/style.css`（追加 ws-* 样式）、`README.md`
- `data/papers.json`、`scripts/radar/*`、`.github/workflows/*`：**未修改**

## 6. 没有修改的关键功能

首页/今日雷达、论文列表与筛选搜索排序、论文 Reader、Research Landscape（overview/pipeline/maturity/gaps/directions/methodology）、Research Map、核心论文集、dark mode、移动端布局、每日数据管线与 3 个 workflows — 全部保持原样并回归验证。

## 7. 测试结果

- `tests/test_v2_logic.py`（调用 node harness）：**24/24 PASS** — 权重和=100、风险边界 0/30/31/50/51/70/71/85/86/100、双传感器交集要求、多维度单调性、裸 schema 不崩溃、NetVOI 算术与阈值行为、pairKey 对称
- 回归：`test_schema` / `test_frontend_layout` / `test_v2_logic`：**6/6 OK**
- 说明：无 lint 配置、无 JS 测试框架（如实报告，未伪造）；全量 unittest 含网络重试逻辑在本机 >120s，验收建议分文件运行

## 8. Build 结果

`npm run build`（= `python scripts/build_site.py`）**成功**；`build_landscape.py` 成功（167 papers / 12 gaps）。

## 9. 本地访问地址

```bash
python scripts/build_site.py
python -m http.server 8010 --directory site --bind 127.0.0.1
```

- 首页：`http://127.0.0.1:8010/`
- Research Workspace：`http://127.0.0.1:8010/?view=workspace`
- 相对路径资源在 GitHub Pages `/embodied-research-radar/` base 下同样有效；本地与生产 base 已验证区分。

## 10. 已知问题

1. 无 lint、无组件级 JS 测试框架（未引入，避免超范围依赖）
2. Collision 历史与用户标注存 localStorage：换浏览器/清缓存会丢失（可后续导出）
3. Red Team / 判别性 / NetVOI / Gap Confidence 分数为人工启发式填写，页面均已标注
4. 概念 canonicalReferences 仅作者+年份，需人工核验后才能引用（不虚构 DOI/venue）
5. Decision Log 新增条目使用浏览器 prompt()，体验可再优化
6. test_landscape / test_stability 单跑较慢（内部 retry sleep）
7. 会话开始时存在的未跟踪文件 `_remote_ids_before.txt` 未处理（非本次产物）

## 11. 下一阶段建议

1. 把 workspace 用户数据（decisions/hypotheses）增加"导出/导入 JSON"以便跨浏览器迁移
2. Frontier Window Monitor（paper count + velocity + collision density 规则版）
3. Reproduction Feasibility、Claim–Evidence Cards
4. Red Team 接入 LLM（复用管线 ai.py 的 provider 抽象，输出必须标 AI-generated）
5. Collision Radar 与每日管线的增量集成（脚本端预计算 firstSeen）
