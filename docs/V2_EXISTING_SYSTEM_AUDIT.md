# V2 Existing System Audit

> 生成日期：2026-09-13（Phase 0 交付物）
> 依据：对仓库代码的完整阅读 + 本地运行验证。若与代码冲突，以代码为准。

---

## 1. 当前技术架构

| 层 | 技术 | 说明 |
|---|---|---|
| 数据管线 | Python 3.10+（仅标准库，零第三方依赖） | arXiv 抓取 → 评分 → schema 校验 → 可选 LLM 分析 |
| 前端 | **Vanilla HTML / CSS / JS**（无框架、无 bundler、无 npm 依赖） | 单页应用，`web/` 为源码，`site/` 为构建产物 |
| 路由 | URL query string（`?view=…&topic=…&paper=…`）+ `history.pushState` | 无 hash router，无前端路由库 |
| 数据 | JSON 文件（无数据库） | `data/papers.json` 等，由管线生成 |
| 外部 API | arXiv Atom、OpenAlex、Semantic Scholar（均可降级） | 仅在 Python 管线中调用，前端零网络调用 |
| 部署 | GitHub Pages（`/embodied-research-radar/` base path） | `scripts/build_site.py` 复制 `web/` → `site/` 并注入 data.json |
| CI | 3 个 GitHub Actions workflows | deploy / update-radar（日）/ refresh-evidence（周） |
| 测试 | Python unittest（5 个测试文件，97 个用例） | 无 JS 测试框架，无 lint 配置 |
| 包管理 | `package.json` 存在但 scripts 只是调 Python；无 node_modules | `npm run build` = `python scripts/build_site.py` |

**关键结论：本项目不是 React/Vite 项目。** V2 必须沿用 vanilla JS + build_site.py 的架构，
不引入框架或 bundler。

## 2. 当前页面（views）

| View | 触发方式 | 渲染函数（web/assets/app.js） |
|---|---|---|
| 首页 / 今日雷达 | 默认 | `renderHome()` |
| 论文列表 | 首页内嵌 | `renderList()` / `renderCard()` |
| 论文详情 Reader | `?paper=<id>` | `renderDetail()` / `readerMarkup()` |
| Topic 分支列表 | `?topic=…` | `renderHome()` + filter |
| 核心论文集 | `?view=core` | `renderHome()` |
| Research Map | `?view=map` | `renderMap()` |
| Research Landscape | `?view=landscape` | `renderLandscape()`（overview/pipeline/maturity/gaps/directions/methodology） |
| 分支占位页 | coming-soon topic | `renderBranch()` |

## 3. 当前数据模型

### paper schema（scripts/radar/schema.py `REQUIRED_FIELDS`，40 个必填字段）

核心字段：`paper_id, title, authors, abstract, abstract_zh, published_date, year, venue,
doi, arxiv_id, paper_url, pdf_url, code_url, project_url, image, research_topics,
literature_categories, methods, tasks, sensors, keywords, summary_one_sentence,
research_problem, core_contributions, method_summary, experimental_setup, key_results,
limitations, why_it_matters, relevance_score, relevance_reason, related_to_my_research,
recommended_reading, reproduction_value, core_candidate, source, last_checked` 等。

扩展字段（`clean_paper` setdefault）：`fact_confidence, analysis_status, source_query_group,
potential_competition, competition_reason, borrowable_methods, trend_bucket, ai_provider,
ai_generated_at`。

**没有** `collisionScore / researchRoles / claimEvidence / verificationLevel` 等 V2 字段。

### research gap 模型（build_landscape.py 生成 research_landscape.json）

每 gap 含：中文/英文标题、`gap_status`（evidence-supported / partially-addressed /
open-hypotheses / dataset-limited）、`confidence`（high/medium/low/insufficient）、
`claim_type`、`claim_version`、`what_has_been_addressed`、`what_remains_open`、
`status_reason`、supporting/counter evidence、external_evidence（OpenAlex/S2/arXiv
结果 + SUPPORT/COUNTER/NEUTRAL 分类）。

## 4. 当前论文数据入口

- 每日管线：`scripts/update_radar.py --fetch` → `scripts/radar/pipeline.py` → `data/papers.json`
- 手工补充：`data/demo_papers.json`（合并进 data.json）
- 当前规模：167 篇

## 5. 当前 AI 功能

- `scripts/radar/ai.py`：可选 OpenAI 兼容 LLM 分析（`LLM_API_KEY`/`LLM_BASE_URL` 环境变量），
  失败自动降级（重试 + 标记 pending）。运行在**离线管线**里，不在前端。
- 前端无任何 AI 调用。V2 的 Red Team prompt 先做模板，不新增付费依赖（符合约束 55 条）。

## 6. 当前本地运行方式（已验证）

```bash
python scripts/build_landscape.py     # papers.json → research_landscape.json
python scripts/build_site.py          # web/ + data → site/
python -m http.server 8010 --directory site --bind 127.0.0.1
# 访问 http://127.0.0.1:8010/  → index/app.js/data.json 均 200
```

注意：**本地 dev server 直接服务 `site/`（无子路径前缀）**，而 GitHub Pages base path 为
`/embodied-research-radar/`。检查结果：站点内所有资源引用均为**相对路径**（`assets/app.js`），
链接使用 `./`、`?query`，因此两种 base path 均可正常工作。无 vite.config，无环境变量依赖，
无 proxy。Node 版本不敏感（npm scripts 只调 Python）。

## 7. 当前部署方式

- `deploy.yml`：push / workflow_dispatch / workflow_run（数据 workflow 成功后）→
  build_landscape → build_site → Pages 上传发布。**不**改数据。
- `update-radar.yml`（每日 UTC 04:00）、`refresh-evidence.yml`（每周一 UTC 02:00）：
  抓取/搜索 → commit 数据文件 → push（GITHUB_TOKEN，不触发 deploy，由 workflow_run 链触发）。
- `site/.nojekyll` 存在。

## 8. 可以直接复用的组件

| 复用点 | 位置 | 用于 V2 |
|---|---|---|
| `esc()` / `uniq()` / `dateLabel()` / `scoreStars()` | web/assets/app.js L3-10 | 所有新页面 |
| URL state + pushState 路由模式 | `syncFromUrl` / `updateUrl` / `bind` nav handler | 新增 `view=workspace*` 路由 |
| 卡片 / section-kicker / stat-card / tag / badge 样式体系 | web/assets/style.css（CSS 变量 + dark mode） | 全部 V2 UI |
| 论文卡片、paper detail、轻量 modal/lightbox | app.js | Collision 卡片、论文引用跳转 |
| `data.json` 注入机制（build_site.py 把 papers/landscape/topics 打包） | scripts/build_site.py | V2 静态数据随之注入，无需新机制 |
| Python unittest 基础设施 | tests/ | V2 逻辑测试（collision score、NetVOI 等） |
| schema.py 的 `clean_paper` / `validate_paper` | scripts/radar/schema.py | 兼容性扩展 V2 optional 字段 |

## 9. 需要新增的组件（V2）

- `web/assets/workspace.js`（独立模块，避免 app.js 继续膨胀；由 app.js import 或 index.html 引入）
- Workspace 导航区（sidebar 新分组）+ 路由分支（`view=workspace` 系）
- 数据文件：`web/assets/v2/` 或 `data/v2/` → researchProfile、researchNodes、collisionConfig、
  researchConcepts、claims、fusionArchitectures、methodRoles、decisionLog、expansionTree
- 渲染器：Thesis Graph（纯 CSS/HTML 流程图，不引第三方图库）、Collision Radar 列表 + 卡片、
  Red Team 结果卡、Hypothesis Matrix 表格、Probe/NetVOI 面板、Experiment Matrix 表格、
  Decision Log、Dashboard、Method Role Map、Fusion Explorer、Expansion Tree
- localStorage 持久化层（用户编辑的 hypothesis/decision/experiment/weights/profile 覆盖）
- Markdown 导出工具函数
- V2 逻辑测试（tests/test_v2_logic.py：collision score、risk mapping、NetVOI、gap status、
  optional schema 兼容性）

## 10. 潜在冲突和技术债

1. **app.js 单文件 434 行且高度压缩（一行多语句）**——继续往里塞会不可维护。V2 逻辑拆到新文件。
2. **build_site.py 把数据打包为 data.json**——V2 新数据文件需要确认是否被复制进 site/
   （build_site 复制整个 web/ 目录，静态 JSON 放 web/assets/ 下即可被带上）。
3. **双语文案惯例**：现有 UI 为中文标题 + 英文 kicker，V2 沿用。
4. **base path**：相对路径已安全，但要避免在新代码里用绝对路径 `/assets/...`。
5. **data/papers.json 是管线产物**：每日 workflow 会覆盖。V2 的 collision 元数据
   （firstSeen/previousScore）若写进 papers.json 会被冲掉 → 存 localStorage，并按 paper_id 关联。
6. **测试基线**：test_landscape 与 test_stability 单跑较慢（内部有 retry sleep），
   全量 `python -m unittest discover` 在本机 >120s；验收时分文件跑或延长超时。
7. **无 lint、无 JS 测试框架**：如实报告缺失，不伪造。
8. `_remote_ids_before.txt` 为未跟踪的临时文件（此前合并流程残留），不删除，仅记录。

## 11. V2 实施计划（拟修改/新增文件）

### Phase 0（本文件）
- `docs/V2_EXISTING_SYSTEM_AUDIT.md` ✅

### P1 — My Research Thesis + Collision Radar
- `web/assets/v2/v2-data.js`（researchProfile、researchNodes、collisionConfig 权重、默认 claims）
- `web/assets/v2/workspace.js`（路由 + 渲染 + localStorage 层 + markdown 导出）
- `web/index.html`（sidebar 加 WORKSPACE 分组，引入 v2 脚本）
- `web/assets/style.css`（workspace 布局、节点图、卡片、矩阵表样式，全部走 CSS 变量）
- `scripts/radar/schema.py`（clean_paper 增加 V2 optional 字段 setdefault，不进 REQUIRED_FIELDS）
- `tests/test_v2_logic.py`（collision score / risk mapping / NetVOI / schema 兼容）

### P2 — Red Team + Failure Lab
- v2-data.js 增：researchConcepts、failureLab 默认 task/hypotheses/probes、claims
- workspace.js 增：red team 语义检查渲染、hypothesis matrix、probe 对比、NetVOI 计算

### P3 — Experiment Builder + Decision Log
- v2-data.js 增：baseline 模板、metrics 分类、默认 decisions
- workspace.js 增：experiment matrix 生成 + Markdown 导出、decision log CRUD

### P4 — Fusion Explorer / Method Role Map / Gap Confidence
- v2-data.js 增：fusionArchitectures、methodRoles
- workspace.js 增：两个展示页；landscape gap 卡片增加 confidence/collision/status 字段展示
  （build_landscape.py 输出扩展，保持旧字段不变）

### P5 — Workspace Dashboard / Expansion Tree / Next Action
- Dashboard 聚合（thesis、top collisions、gaps、experiments、decisions、alerts、next action 规则）

### 每阶段收尾
- `python scripts/build_site.py` + 本地 server 冒烟 + 旧功能回归（home/landscape/detail）
- 更新 `docs/V2_PROGRESS.md`；最终生成 `V2_ARCHITECTURE_DECISIONS.md`、
  `RESEARCH_METHOD_SEMANTICS.md`、README 更新、`V2_FINAL_REPORT.md`
- **不 push、不 deploy，等待人工验收**
