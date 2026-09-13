# Embodied Research Radar

面向机器人操作与具身智能的个人科研论文雷达。V1完整实现“视觉–力觉融合”分支，其他研究分支已经有可扩展的导航、配置和数据Schema，但暂时显示Coming Soon。

在线目标地址：`https://nicholas-steven.github.io/embodied-research-radar/`

## 研究工作台（Research Workspace）

V2 新增独立入口 **研究工作台**（侧边栏，`?view=workspace`），把网站从论文发现工具升级为研究决策辅助系统：Paper → Evidence → Collision → Gap → Research Question → Experiment → Decision。界面以中文为主；论文标题、作者、venue、DOI 与算法缩写保留原文。

### 功能模块

| 模块 | 说明 |
|---|---|
| 工作台总览 | 当前研究主线、核心科学问题、高风险撞题论文、当前研究缺口、当前实验、最近研究决策、前沿窗口提醒、规则化"下一步建议" |
| 我的研究主线 | 研究主线节点图（含主动诊断决策门），节点信息卡（科学问题 / 输入 / 输出 / 候选方法 / 高风险撞题论文 / 当前状态 / 判断可信度），可编辑并导出 Markdown |
| 撞题雷达 | 规则化可解释撞题风险评分（0–100，六维加权）、风险五级、重合原因 / 尚未覆盖的部分、对当前课题的影响与文献核验状态、本周新增 / 风险上升监控 |
| 创新性红队审查 | 对研究主张做敌意审查：最接近的已有理论、语义重合关系、最强反例、仍可保留的创新表述、建议修改表述、保留 / 收缩 / 改名 / 删除结论 |
| 失败假设实验室 | 操作任务 / 失败假设 / 主动探测动作管理、可编辑假设矩阵、假设判别分析、净信息价值（NetVOI，启发式）主动探测决策 |
| 实验设计器 | 14 个实验对比方法模板、6 类评价指标、实验矩阵生成与 Markdown 导出 |
| 研究决策日志 | 研究方向保留 / 放弃的长期记录 |
| 研究缺口可信度 | 在 Research Gap 上增加证据强度 / 撞题风险 / 当前判断 |
| 方法角色图谱 | 按"角色"分类算法，标注"能够解决 / 不能直接解决"，防止热门算法=创新；点击卡片查看方法详情：30 秒理解、直观机器人示例、输入/输出、KaTeX 排版的标准数学公式（逐项解释）、机器人运行流程、相近方法比较、当前课题定位、三分类代表论文（经典基础 / 机器人应用 / 与课题最近，均经检索核验） |
| 视觉力觉融合架构 | 多模态融合架构对比 + 当前推荐方案 |
| 硕士博士研究扩展 | 硕士核心 → 博士扩展方向（D1–D9） |

### 如何本地启动

```bash
python scripts/build_landscape.py     # 生成 landscape（若 data 已有可跳过）
python scripts/build_site.py          # 构建 site/
python -m http.server 8010 --directory site --bind 127.0.0.1
# 打开 http://127.0.0.1:8010/?view=workspace
```

### 如何修改 research profile

当前研究主线全部是数据，不是硬编码：编辑 `web/assets/v2/v2-data.js` 顶部的
`researchProfile`（课题名、传感器、失败假设、future extensions）与 `researchNodes`
（研究节点、角色、候选方法）。换课题不需要改前端源码。

### 如何添加 collision paper

Collision Radar 的评分完全由规则计算：在 `web/assets/v2/v2-data.js` 的
`collisionConfig` 中调整维度正则与权重（权重必须保持总和 100）。单篇论文的
Impact / Verification / Closest Node 在页面卡片上直接标注（保存在浏览器 localStorage）。

### 如何添加 research claim

在 `web/assets/v2/v2-data.js` 的 `researchClaims` 数组中追加：title、atomicClaims
（原子拆解）、closestConcepts（关联 `researchConcepts` 字典中的概念 id）、红队评估
（existingTheory / strongestCounterexample / suggestedRewrite）与结论
（noveltyScore / collisionRisk / recommendation）。示例：Evidence Sufficiency 被判定
RENAME / NARROW 的用例已内置。

### 如何使用 hypothesis lab

打开 Failure Hypothesis Lab：矩阵单元格可直接编辑（保存在 localStorage）；
选择两个假设对比探测动作的判别性（人工评分，允许“未评分”）；NetVOI 表给出
Probe Recommended / Abstain / Safe Recovery 推荐——所有数值是启发式估计，
页面有明确标注。

### 如何生成 experiment matrix

Experiment Builder 中勾选启用的 baseline → 查看实验矩阵（E1–E5 默认已关联
claims）→ 点击 **Export to Markdown** 导出，可直接用于开题报告与论文规划。
Thesis / Red Team / Failure Lab / Decision Log 均支持同名导出。

### 重要约定

- 所有评分（Collision / NetVOI / Novelty / Gap Confidence）是**启发式研究决策辅助**，页面均有免责标注。
- “Radar 没找到” ≠ “没人研究”；AI 输出必须标注 “Requires verification”。
- 术语统一定义见 `docs/RESEARCH_METHOD_SEMANTICS.md`；架构决策见 `docs/V2_ARCHITECTURE_DECISIONS.md`。

## 这是什么

这是一个静态、可长期维护的科研工具：Python数据管线从arXiv Atom API召回候选论文，经过主类目/排除词过滤、标题与摘要相关性评分、去重和可选AI分析后生成`data/papers.json`；前端只读取构建后的JSON，不把论文硬编码到HTML。GitHub Actions负责每日更新和GitHub Pages部署。

参考了[Infinity4B/daily-arxiv-vla](https://github.com/Infinity4B/daily-arxiv-vla)的“自动抓取→摘要→静态发布”思路，但没有复制其页面或数据结构。参考仓库根目录未发现明确的LICENSE文件，因此本项目只借鉴公开工作流思想，源码和Schema均为重新实现。

## 技术栈

- Python 3.10+标准库：arXiv Atom抓取、规范化、去重、二级相关性筛选、评分、可选OpenAI-compatible摘要。
- 原生HTML/CSS/JavaScript：无前端框架、无运行时服务器、相对路径兼容GitHub Pages project site，内置Desktop/Mobile布局和Dark Mode。
- GitHub Actions + GitHub Pages：每日定时、手动触发、构建和部署。
- JSON配置和数据：研究分支、查询组、评分权重、网站元信息与论文数据分离。

## 目录

```text
.
├── config/
│   ├── queries.json          # Query Groups和允许的研究类目
│   ├── scoring.json          # 相关性权重和奖励项
│   ├── site.json             # 网站、仓库和base path
│   └── topics.json            # Research Topic、ABCD占位、Research Map
├── data/
│   ├── demo_papers.json       # 已核验的真实arXiv论文Demo元数据
│   └── papers.json            # 管线生成的公开数据
├── scripts/
│   ├── radar/
│   │   ├── schema.py          # Schema、去版本、校验和星级
│   │   ├── arxiv_fetcher.py   # Atom API召回
│   │   ├── scoring.py         # 二级筛选、主题推断和评分
│   │   ├── ai.py              # 可替换LLM Provider，失败时Pending
│   │   └── pipeline.py        # 去重→评分→AI→写入
│   ├── update_radar.py        # 更新入口
│   └── build_site.py          # web→site静态构建
├── web/                       # 前端源文件
├── site/                      # GitHub Pages构建产物
├── tests/                     # unittest
└── .github/workflows/deploy.yml
```

## 本地运行

### Windows PowerShell

```powershell
git clone https://github.com/Nicholas-Steven/embodied-research-radar.git
cd embodied-research-radar
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m unittest discover -s tests -v
python scripts/update_radar.py --no-ai --threshold 45
python scripts/build_site.py
python -m http.server 8000 --directory site
```

浏览器打开`http://localhost:8000/`。如果PowerShell禁止激活脚本，可直接使用`.venv\Scripts\python.exe`运行命令，或按Windows执行策略配置虚拟环境。

### Ubuntu 22.04+

```bash
git clone https://github.com/Nicholas-Steven/embodied-research-radar.git
cd embodied-research-radar
python3 -m venv .venv
source .venv/bin/activate
python -m unittest discover -s tests -v
python scripts/update_radar.py --no-ai --threshold 45
python scripts/build_site.py
python3 -m http.server 8000 --directory site
```

无需安装第三方Python包即可看到Demo。`requirements.txt`保留为空依赖说明，是为了让基础构建不被可选服务阻塞。

## 抓取与更新

先做小规模在线试运行：

```bash
python scripts/update_radar.py --fetch --limit-per-query 2 --threshold 45 --no-ai
python scripts/build_site.py
```

初始化历史候选可以提高到约300–500篇：

```bash
python scripts/update_radar.py --fetch --limit-per-query 25 --threshold 45 --no-ai
```

查询组在`config/queries.json`中维护。每个查询只负责召回；评分模块再检查标题、摘要、方法和任务上下文，避免“force”物理学论文或纯计算机视觉论文直接进入雷达。论文先按arXiv ID去重，再按规范化标题去重；版本号会被去掉。

若arXiv暂时限流或网络失败，管线保留现有`data/papers.json`，不会用空响应覆盖网站。

## AI分析（可选）

默认无需API Key，Demo中的AI分析字段使用人工整理的摘要，新增论文的分析字段会显示`Pending`，站点仍然正常构建。若要启用OpenAI-compatible接口：

```bash
cp .env.example .env
export LLM_API_KEY="your-key"
export LLM_BASE_URL="https://api.openai.com/v1"
export LLM_MODEL="gpt-4o-mini"
python scripts/update_radar.py --fetch --limit-per-query 2 --threshold 45
```

本项目不会读取或写入GitHub密码、个人Token，也不会把Key写进源码。AI只填分析字段，事实字段（Title、Authors、Date、Venue、DOI、arXiv、Code）始终来自结构化来源；API失败只会留下`Pending`，不会让构建失败。

## GitHub Pages部署

1. 创建公开仓库`Nicholas-Steven/embodied-research-radar`并推送本目录。
2. 在仓库Settings → Pages → Build and deployment中选择`GitHub Actions`。
3. Actions会在push、每日UTC 04:00（北京时间12:00）或手动`workflow_dispatch`时运行。
4. 访问`https://nicholas-steven.github.io/embodied-research-radar/`。

可选Secrets/Variables：

- `LLM_API_KEY`：可选，启用AI分析时设置为Secret。
- `LLM_BASE_URL`：可选，建议作为Repository Variable；默认`https://api.openai.com/v1`。
- `LLM_MODEL`：可选，默认`gpt-4o-mini`。

不设置这些变量也可以自动抓取、评分、构建和部署。GitHub Actions使用`contents: write`提交更新后的`data/papers.json`和`site/`，使用Pages权限发布静态产物。

## 测试与质量检查

```bash
python -m unittest discover -s tests -v
python -m py_compile scripts/radar/*.py scripts/*.py
python scripts/update_radar.py --no-ai --threshold 45
python scripts/build_site.py
```

测试覆盖：arXiv ID版本规范化、标题规范化、Demo Schema、重复论文合并、相关性阈值筛选和强相关论文排序。构建后检查`site/build-manifest.json`与`site/assets/data.json`即可确认静态产物存在。

## 当前限制与下一步

- V1数据源是arXiv元数据和公开项目/代码链接，不抓取付费全文，也不承诺所有论文都有正式Venue或DOI。
- 相关性评分是可解释的规则模型，不是领域级语义模型；分数用于排序，不应当替代人工阅读。
- Demo中的ABCD仅保留`待人工确认`，因为工作区没有提供可读取的ABCD定义文件；不会虚构分类含义。
- 首图功能暂不启用，避免对论文图像进行不必要的复制和版权处理。

下一步最值得增加的是：先确认HKVL-75B采样率、坐标系、时间戳和零点标定，再加入“接触状态/失败模式”字段和针对真实F/T信号的阶段门控基线。
