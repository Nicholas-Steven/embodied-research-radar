# Architecture

## 目标

Embodied Research Radar被设计成“构建阶段有网络、发布阶段无服务器”的静态科研工具。用户打开GitHub Pages时只加载HTML/CSS/JS和一个构建好的JSON，不依赖数据库、登录系统或长期运行后端。

## 数据流

```text
config/queries.json
        ↓
arXiv Atom API（召回候选，带重试与延迟）
        ↓
主类目/排除词检查 + 标题/摘要上下文评分
        ↓
arXiv ID / normalized title 去重
        ↓
统一Paper Schema
        ↓
可选OpenAI-compatible分析（失败→Pending）
        ↓
data/papers.json
        ↓
build_site.py：复制web并注入assets/data.json
        ↓
GitHub Pages
```

## 为什么使用原生前端

当前站点是个人科研工具，核心需求是搜索、筛选、详情和可长期部署，而不是复杂交互应用。原生JavaScript能减少依赖、缩短GitHub Actions构建、避免React Router在project site二级路径下的额外配置。详情页使用`?paper=<paper_id>`，所有链接采用相对路径，兼容`/embodied-research-radar/`。

## 事实字段和分析字段

`title`、`authors`、`published_date`、`venue`、`doi`、`arxiv_id`、`paper_url`、`pdf_url`、`code_url`和`source`属于事实/元数据层。`summary_one_sentence`、`research_problem`、`core_contributions`、`key_results`、`relevance_reason`等属于分析层。AI Provider只能写分析层；没有API或无法解析时写`Pending`，不会填猜测的Venue、DOI、数字或代码链接。

## 两阶段相关性

Stage 1由查询组尽量提高召回，允许同一论文命中多个组。Stage 2由`scoring.py`检查机器人操作语境、视觉–力觉/接触/失败/策略信号、公开资源和排除词，并输出0–100分及解释。分数用于站内排序和阈值过滤；它不是论文质量、发表等级或因果结论。

## 可扩展点

- 新方向：在`config/topics.json`增加Topic，在`config/queries.json`增加Query Group。
- 新数据源：实现与`arxiv_fetcher.query_arxiv`同样输出Paper Schema的适配器，保留`source`字段。
- 新评分器：替换`scoring.py`或增加嵌入/LLM reranker，但必须保留`relevance_reason`。
- 新AI Provider：在`ai.py`中实现相同的`generate_analysis(paper)`契约，不暴露Key。
- ABCD：把真实定义填入`topics.json`后，前端已支持`literature_categories`字段，不需要改论文Schema。
- Research Map：`topics.json`的`research_map`直接驱动基础地图节点。

## 参考项目审计结论

参考的Daily arXiv VLA公开项目采用Python爬虫、Markdown表、ModelScope摘要、原生静态前端和GitHub Actions，适合低维护部署；但其核心数据结构只覆盖日期/标题/链接/摘要，分类与筛选不能承载本项目的Research Topic、ABCD、传感器、复现价值和竞争工作等字段。本项目因此只保留其自动化发布思路，不复用其页面代码；参考仓库根目录没有明确LICENSE文件，未将其源码复制进本项目。
