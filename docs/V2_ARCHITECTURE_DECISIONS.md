# V2 Architecture Decision Records

## ADR-001: 采用 optional paper 字段而非 schema migration

**Decision**: V2 字段（collisionScore、researchRoles、claimEvidence、verificationLevel 等）不进入
`schema.py` 的 `REQUIRED_FIELDS`，也不写入管线产物 `data/papers.json`。

**Why**: `papers.json` 是每日 update-radar workflow 的生成产物，会被远端覆盖；写进去的字段会被
冲掉且违反"不修改原论文数据"约束。V2 逐论文元数据（firstSeen/previousScore/impact/verification）
全部存 localStorage，按 paper_id 关联。旧 schema 无需任何迁移即兼容（spec §44/§60）。

## ADR-002: Collision Score 在 V2 采用规则化（rule-based）可解释评分

**Why**: 无 embedding 基础设施（无 Python 第三方依赖、前端零网络调用），且 spec 要求可解释
（Why It Collides 需逐维度归因）。规则匹配（正则维度 × 集中权重）给出完全可解释、可离线、可复现
的分数。spec §9 权重集中在 `v2-data.js collisionConfig`，不在组件中散落。页面固定显示
heuristic 免责声明（spec §74）。

## ADR-003: 暂不引入后端数据库

**Why**: 现有架构是纯静态 GitHub Pages（PROJECT_CONTEXT §2）。spec §48 允许 JSON + localStorage
第一阶段方案。localStorage 仅存配置/标注/假设/决策（spec §49），论文数据继续走 data.json。
数据模型（store 函数 + JSON 结构）已按可迁移性设计，未来接后端只需替换 lsGet/lsSet 层。

## ADR-004: Evidence Sufficiency 表示为决策门（Decision Gate）而非独立理论节点

**Why**: Red Team 评估显示其与 Selective Prediction / Diagnosability / SPRT / VOI 存在强重叠
（spec §89）。Thesis 图中以 "Evidence / Diagnosability Gate" 卡片插在 Diagnosability 节点后，
说明文字固定为 spec §5 要求的表述。该决策同时记录在 Decision Log 默认条目中。

## ADR-005: 不引入第三方图形库

**Why**: 现有项目零前端依赖；spec §51 要求仅当确需图编辑能力时才新增依赖。Thesis 图第一版用
纯 CSS 纵向流程（flex + 连接线样式），满足 zoom 由浏览器、点击、tooltip（title 属性）需求；
React Flow 等留待需要拖拽编辑时再评估。

## ADR-006: V2 前端代码独立为 web/assets/v2/ 模块

**Why**: app.js 是 434 行高密度单文件，继续内联会不可维护。workspace.js 作为 ES module 与
app.js 通过 `window.WorkspaceView` / `window.__radarRerender` 两个钩子解耦，app.js 的 render 循环
只增加一个 `?view=workspace` 分支。build_site.py 的 copytree 自动携带 v2/ 子目录，构建链零改动。

## ADR-007: LLM Red Team 只保留 prompt 模板

**Why**: 项目 LLM 调用只在离线 Python 管线（可选 OpenAI 兼容）；spec §55 要求无 LLM API 时
不新增付费依赖。前端展示 prompt 模板 + "AI-generated hypotheses require verification" 标注，
红队评估当前为人工填写的启发式判断（v2-data.js），AI 输出永远不覆盖人工确认数据。
