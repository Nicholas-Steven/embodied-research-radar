# Embodied Research Radar — Iteration Log

> **Rule:** Newest entries at the top. Each entry follows the fixed schema below.
> Do not delete old entries. Append new entries at the top.
> If a correction is needed, add a `Correction` sub-section to the existing entry.

---

## 2026-09-13 — 方法知识库 V2：解释重写 + KaTeX 公式 + 核验代表论文（已上线）

### User-visible Changes
- 方法角色图谱全部 26 个方法详情升级：新增「30 秒理解」「一个直观例子」「输入/输出」「在机器人里怎么跑」「与相近方法的区别（13 组指定对比全覆盖）」「当前课题接入层」「推荐程度原因」
- 数学公式从 `<pre>` 纯文本改为 KaTeX 标准排版（32 个公式块，逐项解释；KaTeX 0.16.11 本地 vendor，无 CDN；渲染失败降级原文不白屏；dark/light 主题色继承）
- Modal 重排为 19 段学习顺序（先直观后数学再科研），中文标题醒目、英文辅助小字
- 代表论文三分类（经典基础 / 机器人应用 / 与当前课题最近）：38 篇唯一文献全部检索核验（含 relevanceNote、publication status、verification level badge），无文献的类别显示「暂无已核验文献」不硬凑

### Technical Changes
- 新增 `web/assets/vendor/katex/`（CSS/JS + 9 字体）、`web/assets/v2/method-knowledge.js`（26 方法知识库）
- `web/assets/v2/workspace.js`：renderMathIn 安全渲染、paperGroups 渲染、Modal 内容函数重构；`web/index.html` KaTeX 引入；`web/assets/style.css` 全主题变量样式
- `tests/method_knowledge_harness.mjs` 新增（24 项断言）；v2_logic/ws_render harness 补拷 method-knowledge.js

### Data Safety
- 未修改 papers.json（方法文献独立绑定，无虚构论文；重复 URL 均为同一文献跨方法复用）
- 代表论文全部 METADATA/ABSTRACT_VERIFIED，不标 FULLTEXT；核对日志见 docs/METHOD_REFERENCE_AUDIT.md

### Validation
- method_knowledge 24/24、V2 logic 24/24、ws_render（M1–M10 等）全部 PASS、regression 82/82 OK、build PASS、本地+线上冒烟全 200
- commit d83f050 push main，GitHub Pages workflow 34789711081 success

---

## 2026-09-13 — V2-UI-FIX-3 实验对比方法语义修正 + 默认启用状态调整（本地完成）

### User-visible Changes
- 实验设计器标题「对比基线（勾选启用/禁用）」改为「实验对比方法（勾选启用/禁用）」（本文方法非严格 baseline）
- 新用户默认启用 12 项对比方法（含不考虑风险的主动探测），默认不启用置信度阈值/暂缓判断（扩展诊断对照，按需手动启用）
- 老用户已有 localStorage 选择不受影响（saved 优先返回）

### Technical Changes
- `web/assets/v2/workspace.js`：enabledBaselines() 默认值改为排除 conf-threshold/abstain；标题文案
- `tests/ws_render_harness.mjs`：B0 默认状态断言（12 启用/2 不启用/标题）、新增 B9 老用户 localStorage 优先断言（4 项）

### Data Safety
- 无数据逻辑修改、无实验内容修改、无 push / deploy

### Validation
- V2 logic: 24/24 PASS；render harness（含 B0–B9 交互）: 全部 PASS；regression 9/9 OK；build OK

---

## 2026-09-13 — V2-UI-FIX-2 Baseline 选择交互修复（本地完成）

### User-visible Changes
- 实验设计器：勾选/取消对比基线后实验矩阵 E1–E5 即时更新（无应用按钮）；矩阵单元格只显示该实验「适用且已启用」的基线 chip
- 新增轻量提示行「勾选的基线将实时用于下方实验矩阵和 Markdown 导出」
- 导出 Markdown 的已选基线与矩阵行与当前勾选实时一致
- 某实验无启用基线时显示「暂无启用的对比基线」+ 适用但未启用清单（不白屏）；未配置适用基线时显示防御性提示
- E3 加入可选诊断基线（置信度阈值 / 暂缓判断），默认仅 E3 适用

### Technical Changes
- `web/assets/v2/v2-data.js`：defaultExperiments 增加 applicableBaselines（内部 id 英文，引用 experimentBaselines）
- `web/assets/v2/workspace.js`：矩阵行改按 enabled×applicable 过滤渲染；checkbox change 即时 render()；导出按启用基线生成
- `tests/ws_render_harness.mjs`：重写为交互式 DOM 桩（checkbox 桩按渲染缓存、fire() 等待异步重渲染、Blob 捕获导出内容），新增 B0–B8 交互断言

### Data Safety
- 无实验内容修改、无数据逻辑修改、无 push / deploy

### Validation
- V2 logic: 24/24 PASS；render harness（含 B0–B8 交互）: 全部 PASS；regression 9/9 OK；build OK

---

## 2026-09-13 — V2-UI-FIX 实验设计器长文本布局修复（本地完成）

### User-visible Changes
- 实验矩阵：单元格自然换行（white-space:normal + overflow-wrap:anywhere），列宽重排（实验 6% / 对比基线 26% / 核心变量 11% / 主要指标 24% / 验证主张 33%）
- E1–E5 说明卡与 metrics 标签：min-width:0 + height:auto + flex-wrap，长文本完整显示不截断（无 ellipsis / 无固定高 / 无 overflow:hidden 掩盖）
- E1–E5 基线、指标、实验目的显示文案进一步中文化（内部 claimId / enum 不变）

### Technical Changes
- `web/assets/style.css`：新增 .exp-matrix 列宽与换行规则、.ws-metric-group/.ws-metric-grid 换行规则、.ws-table-wrap min-width:0
- `web/assets/v2/workspace.js`：实验矩阵表加 exp-matrix class
- `web/assets/v2/v2-data.js`：defaultExperiments 显示文案中文化
- `tests/ws_render_harness.mjs`：新增 L1–L4（渲染内容）与 C1–C7（CSS 规则存在性）断言

### Data Safety
- 无数据逻辑修改、无实验内容修改、无 push / deploy

### Validation
- V2 logic: 24/24 PASS；render harness（含布局断言）: 全部 PASS；regression 9/9 OK；build OK

---

## 2026-09-13 — V2-CN 界面与研究术语中文化（本地完成）

### Goal
研究工作台全部用户可见 UI 中文化（一级入口"研究工作台"，11 个 Tab 中文），不改数据逻辑/算法/路由/localStorage schema/内部 enum。

### User-visible Changes
- 侧边栏与面包屑："研究工作台"；Tab：工作台总览 / 我的研究主线 / 撞题雷达 / 创新性红队审查 / 失败假设实验室 / 实验设计器 / 研究决策日志 / 研究缺口可信度 / 方法角色图谱 / 视觉力觉融合架构 / 硕士博士研究扩展
- 术语统一：撞题（非碰撞）、信念/后验信念、暂缓判断（非弃权）、主动探测（非探针）、失败假设、失败假设可辨识性
- 证据充分性显示为"证据充分性（操作性决策变量）"+ 中文说明
- 论文标题/作者/venue/DOI/算法缩写保留原文

### Technical Changes
- 新增 `web/assets/v2/i18n.js` 统一中文映射层（唯一来源，页面不散落映射）
- `workspace.js` 全部视图文案经映射层输出；`v2-data.js` 增 titleZh/概念中文名/新增 multimodal-fusion 节点/thesis 边更新
- `style.css` 中文断行防护；`web/index.html` 侧边栏入口
- `docs/RESEARCH_METHOD_SEMANTICS.md` 重写为中文为主；README Workspace 章节改"研究工作台"

### Data Safety
- 内部 enum/id/JSON key/paper id/localStorage key 全部未改；papers.json 未动；无 push/无 deploy

### Validation
- V2 logic harness: 24/24 PASS（2 个断言文案改中文，测试含义不变）
- 回归（schema/pipeline/frontend_layout/v2_logic）: 8/8 OK
- npm run build: OK；本地预览 5 项资源全 200
- 未翻译扫描：无用户可见英文残留（仅术语英文括号与 spec 允许的保留项）

---

## 2026-09-13 — V2 Research Workspace（研究决策系统升级，本地完成）

### Goal
把网站从论文发现工具升级为研究决策辅助系统：Paper → Evidence → Collision → Gap →
Research Question → Experiment → Decision。新增独立入口 Research Workspace（11 个模块）。

### User-visible Changes
- 侧边栏新增 WORKSPACE 分组 → `?view=workspace`（Dashboard / Thesis / Collision Radar /
  Red Team / Failure Lab / Experiment Builder / Decision Log / Gap Confidence /
  Method Role Map / Fusion Explorer / Expansion）
- 各模块支持 Markdown 导出与 localStorage 持久化；V1 所有页面与功能不变

### Technical Changes
- 新增 `web/assets/v2/v2-data.js`（全部研究配置数据）与 `web/assets/v2/workspace.js`
  （路由 + 11 视图 + localStorage 层 + 导出）
- `web/index.html`：sidebar WORKSPACE 导航、workspace-section 容器、v2 脚本引入
- `web/assets/app.js`：render 循环增加 workspace 分支 + `__radarRerender` 钩子（3 处单行改动）
- `web/assets/style.css`：追加 ws-* 样式（沿用现有 CSS 变量，dark mode 兼容）
- 新增 `tests/test_v2_logic.py` + `tests/v2_logic_harness.mjs`（node harness，24 断言）

### Data / Schema Changes
- `data/papers.json` 未修改；V2 逐论文元数据存 localStorage（ADR-001，管线产物不被污染）

### Research Logic Changes
- Evidence Sufficiency 表示为 Decision Gate 而非独立理论（ADR-004）
- Collision/NetVOI/Novelty/Gap 分数全部标注 heuristic（spec §74）

### Workflow Changes
- 无 workflows 改动；**本次未 push、未 deploy，等待人工验收**

### Bugs Fixed
- 无 V1 缺陷修复（纯增量）；修复过程中发现并修正 2 次 heredoc 写文件截断

### Validation
- test_v2_logic harness: 24/24 PASS
- test_schema / test_pipeline / test_frontend_layout / test_v2_logic: 8/8 OK
- npm run build（build_site.py）: OK
- 本地预览：index / workspace / v2 assets / data.json 全部 200
- lint：项目无 lint 配置（如实报告）

### Data Safety
- Papers: 167（未动）；remote_paper_ids 未受影响（无数据文件修改）
- Force push: No；未触发任何 GitHub Actions

---

- **Commit:** (pending — this fix)
- **Date:** 2026-09-08
- **Paper Count at Release:** 167
- **Production URL:** https://nicholas-steven.github.io/embodied-research-radar/
- **Workflows:** deploy.yml (push / workflow_run), update-radar.yml (daily), refresh-evidence.yml (weekly)

---

## 2026-09-08 — Fix Automated Deploy Trigger

### Goal
Fix broken deploy trigger: data workflows (Update Radar, Refresh Evidence) use
GITHUB_TOKEN to push, which does not trigger push-based deploy.yml. Resulted in
production site stuck at Sept 3 data despite daily successful data updates.

### Root Cause
GitHub Actions GITHUB_TOKEN push does not trigger other workflows (anti-loop
design). update-radar.yml pushed daily but deploy.yml was never triggered by
those pushes. Last push-triggered deploy was 2026-09-04 08:50 UTC (from a
human merge commit, not a bot push).

### User-visible Changes
Production site will now automatically rebuild after each successful data
pipeline run (Update Radar daily, Refresh Evidence weekly).

### Technical Changes
- deploy.yml: added `workflow_run` trigger listening for "Update Radar" and
  "Refresh Research Gap Evidence" completion events
- deploy.yml: added `if` condition to build job — when triggered by
  `workflow_run`, only proceeds if `conclusion == 'success'`

### Files Changed
- `Modified` `.github/workflows/deploy.yml`
- `Modified` `docs/PROJECT_CONTEXT.md`
- `Modified` `docs/ITERATION_LOG.md`

### Data / Schema Changes
None.

### Research Logic Changes
None.

### Workflow Changes
- deploy.yml triggers: `push` + `workflow_dispatch` + `workflow_run` (new)
- deploy.yml build job: added `if` condition for workflow_run success check
- No PAT introduced, no new secrets, no schedule restored

### Bugs Fixed
- Deploy trigger gap: data workflows could not trigger site rebuild

### Validation
- unit tests: 97/97 OK
- py_compile: OK
- Remote paper IDs preserved: 167/167
- Force push: No

### End-to-End Chain Verification (2026-09-08)
- Update Radar workflow_dispatch run: **34221580096** — completed/success
- candidate_count=179, retained_count=167, new papers=0
- Automatic Deploy triggered by workflow_run: **34222074957** — completed/success
- Deploy event: `workflow_run` (NOT push, NOT workflow_dispatch)
- Trigger latency: 4 seconds after Update Radar completion
- Production site verified: 167 papers, latest date 2026-09-04, generated_at 2026-09-08
- **workflow_run chain: REAL verification PASSED ✅**

### Data Safety
- Papers: 167 (160 existing + 7 new from 2026-09-04, all from remote)
- Remote IDs preserved: 167/167
- Missing IDs: []

### Diagnostic Report
Full diagnostic preserved at `docs/DIAGNOSTIC_REPORT_2026-09-08.md`.

---

## 2026-09-04 — Workflow Cleanup & Production Release

### Goal
Final workflow cleanup before production: remove redundant deploy schedule, unify
data-mutation concurrency, push to production, verify deployment.

### User-visible Changes
None (infrastructure only).

### Technical Changes
- Removed `schedule` trigger from deploy.yml (now only push + workflow_dispatch)
- Unified refresh-evidence.yml concurrency group to `radar-data-mutation` (shared with update-radar.yml)

### Files Changed
- `Modified` `.github/workflows/deploy.yml`
- `Modified` `.github/workflows/refresh-evidence.yml`
- `Modified` `data/research_landscape.json` (regenerated from 155 papers)

### Data / Schema Changes
None.

### Research Logic Changes
None.

### Workflow Changes
- deploy.yml: removed schedule trigger, kept push + workflow_dispatch
- refresh-evidence.yml: concurrency group changed from `evidence-refresh` to `radar-data-mutation`

### Bugs Fixed
None.

### Validation
- unit tests: 97/97 OK
- py_compile: OK
- build_landscape: 155 papers OK
- build_site: OK
- deploy Action: completed/success

### Data Safety
- Papers: 155 (unchanged)
- Remote IDs preserved: 155/155
- Force push: No

### Commit
- `e1d69ef` (deploy.yml schedule removal + concurrency unification)
- `8bdcb08` (add update-radar.yml)

### Deployment
- Deployed. https://nicholas-steven.github.io/embodied-research-radar/

### Decision / Rationale
deploy.yml daily schedule was redundant because update-radar.yml already runs daily
at the same time and triggers deploy via push. Removing it avoids duplicate deploys.
Shared concurrency group prevents update-radar and refresh-evidence from pushing
simultaneously.

---

## 2026-09-04 — Safe Production Release

### Goal
Merge Research Landscape feature into main, preserving all remote paper data.

### User-visible Changes
- New "研究进展与缺口" (Research Landscape) page accessible from sidebar
- Landscape Overview with stats, cross-topic coverage, evidence tiers
- Research Pipeline (9 stages, clickable cards with detail panel)
- Maturity Matrix (13 dimensions)
- Major Research Questions / Needs More Evidence split (6 + 6 gaps)
- External Evidence display per gap with Refresh Evidence panel
- Gap cards with claim version tracking and stale evidence detection
- Pipeline card interaction restored (whole-card click, stopPropagation on buttons)
- 5-column base stats, Chinese-first labels throughout

### Technical Changes
- New `scripts/build_landscape.py` (~970 lines): cross-paper gap analysis engine
- New `scripts/radar/gap_search.py` (~540 lines): external evidence search (OpenAlex, Semantic Scholar, arXiv)
- New `tests/test_landscape.py` (~770 lines): 97 tests covering evidence classification, gap search, claim version, workflow checks
- Modified `scripts/build_site.py`: merges landscape.json into data.json
- Modified `web/assets/app.js`: landscape routing, gap cards, pipeline detail, evidence display
- Modified `web/assets/style.css`: all landscape styles
- Modified `web/index.html`: landscape section and sidebar nav
- Modified `.github/workflows/deploy.yml`: removed update_radar.py, contents:read
- New `.github/workflows/refresh-evidence.yml`: weekly external evidence search
- New `.github/workflows/update-radar.yml`: daily arXiv paper fetch

### Files Changed
- `Added` `scripts/build_landscape.py`
- `Added` `scripts/radar/gap_search.py`
- `Added` `tests/test_landscape.py`
- `Added` `.github/workflows/refresh-evidence.yml`
- `Added` `.github/workflows/update-radar.yml`
- `Added` `data/research_landscape.json`
- `Added` `data/gap_search_results.json`
- `Modified` `scripts/build_site.py`
- `Modified` `.github/workflows/deploy.yml`
- `Modified` `web/assets/app.js`
- `Modified` `web/assets/style.css`
- `Modified` `web/index.html`

### Data / Schema Changes
- New `data/research_landscape.json`: pipeline, maturity, gaps, directions, evidence_index, external_evidence
- New `data/gap_search_results.json`: per-gap external search results with dedup and classification
- New gap fields: `gap_status`, `claim_version`, `what_has_been_addressed`, `what_remains_open`, `status_reason`
- `data.json` gains `landscape` top-level key
- `data.json` gains `external_update_source` and `external_searched_at`

### Research Logic Changes
- Evidence classification: Direct / Related / Background based on topic + sensor + failure signals
- Claim version tracking: bumped when gap claim is narrowed; stale evidence flagged
- Gap status model: evidence-supported / partially-addressed / open-hypotheses / dataset-limited
- Confidence adjusted by external evidence (counter ≥ 2× supporting AND ≥ 5 → downgrade)
- 3 gaps narrowed (temporal-6d-ft, selective-human-escalation, learning-from-corrections)
- Known misclassification guards documented (HITL regex, feedback disambiguation)

### Workflow Changes
- deploy.yml: removed update_radar.py step, permissions changed to contents:read
- New refresh-evidence.yml: weekly search → commit evidence → push → deploy
- New update-radar.yml: daily fetch → commit papers → push → deploy

### Bugs Fixed
- Pipeline card click interaction regression after CSS layout changes
- Blue underline/dashed decoration on pipeline card children
- Gap card badges squeezing title into narrow column
- `learning-from-corrections` missing claim_version=2
- `test_all_gaps_have_group_field` missing `partially-addressed` in valid set

### Validation
- unit tests: 97/97 OK
- py_compile: OK
- build_landscape: 155 papers OK
- build_site: OK
- HTTP verification: 200 OK
- Deploy Action: completed/success

### Data Safety
- Papers: 88 (local) + 155 (remote) → 155 (merged, all remote preserved)
- Remote IDs preserved: 155/155
- Force push: No

### Commit
- `c54918e` (main feature commit)
- `f4668ba` (merge remote/main)
- `8bdcb08` (add update-radar.yml)

### Deployment
- Deployed. https://nicholas-steven.github.io/embodied-research-radar/

### Decision / Rationale
- Deploy.yml separated from data mutation: deploy only builds, data workflows commit/push
- Claim version system chosen over full re-search on every build (cost/time tradeoff)
- Major / Needs More Evidence split chosen over flat list (user testing showed flat list confused readers)
- Regex-based evidence classification chosen for V1 (LLM-based deferred to future, always optional)

---

## 2026-09-03 — Evidence Audit & Gap Refinement

### Goal
Audit all 12 Research Gap supporting/counter evidence against real paper abstracts.

### User-visible Changes
- Gap descriptions updated to reflect narrowed claims
- Confidence levels adjusted per audit findings
- Evidence-supported Chinese name changed from "较强证据" to "有证据支持"

### Technical Changes
- `_HITL_RE` regex tightened (no longer matches "human demonstration")
- Gap 4 description: "恢复后缺少重新验证" → "恢复后重新验证机制的系统性仍待确认"
- Gap 5 description: focus shifted from "有没有 Temporal F/T" to "是否改善失败状态验证"
- Gap 9 narrowed to VF failure recovery context
- Gap 10: all 26 "supporting" papers reclassified as counter (all doing correction learning)

### Files Changed
- `Modified` `scripts/build_landscape.py`
- `Modified` `web/index.html`

### Validation
- unit tests: 86/86 OK (at time of audit)

### Decision / Rationale
Manual abstract-level audit found systematic over-counting of supporting evidence due to
broad keyword matching ("human", "feedback", "benchmark", "generalization"). Tightened
regex and reclassified where needed.

---

## Historical Milestones (Reconstructed from repository)

*The following milestones are reconstructed from git log and current source files.
Specific dates and details are approximate where not directly verifiable.*

### Initial Release (~2026-08)
- Commit `b41865b`
- Basic radar: arXiv fetch, scoring, demo papers, static site
- Topics: vision-force, failure-understanding, failure-recovery, vla-manipulation, generative-policy
- Research Map with 8 nodes
- Dark mode, responsive layout

### Iterative Radar Updates (2026-08 to 2026-09)
- Daily automated arXiv updates via GitHub Actions
- Paper count grew from ~10 to ~155
- Bug fixes: Pending placeholder rendering, lightbox zoom

### Research Landscape Development (2026-09-03 to 2026-09-04)
- Full landscape analysis engine (build_landscape.py)
- External evidence search (gap_search.py)
- Gap claim version and stale evidence tracking
- Workflow responsibility separation
- Safe production release preserving all remote paper data
