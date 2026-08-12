# Paper Schema v1.0.0

`data/papers.json`是一个对象，顶层包含`schema_version`、`generated_at`、`source`、`candidate_count`、`retained_count`、`relevance_threshold`和`papers`数组。每个`papers[]`元素至少具有以下字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `paper_id` | string | 稳定ID，优先为`arxiv-<id>` |
| `title` | string | 原文标题 |
| `authors` | string[] | 原文作者 |
| `abstract` | string | 原文摘要 |
| `abstract_zh` | string | 中文摘要；AI不可用时为`Pending`或人工内容 |
| `published_date` / `updated_date` | ISO date string | 来源日期 |
| `year` | integer | 年份 |
| `venue` | string | 仅在来源确认时填写正式Venue，否则`Preprint / arXiv` |
| `doi` | string | 真实DOI；未知为空，不猜测 |
| `arxiv_id` | string | 去掉版本号的arXiv ID |
| `paper_url` / `pdf_url` | string | 合法公开链接 |
| `code_url` / `project_url` | string | 只有来源明确时填写 |
| `image` | string | V1保留字段，默认空，避免不必要图像复制 |
| `research_topics` | string[] | Research Topic，如`vision-force` |
| `literature_categories` | string[] | ABCD或`unassigned`；真实定义缺失时不虚构 |
| `methods` / `tasks` / `sensors` / `keywords` | string[] | 结构化标签 |
| `summary_one_sentence` | string | 一句话总结 |
| `research_problem` | string | 问题 |
| `core_contributions` | string[] | 核心贡献 |
| `method_summary` | string | 方法摘要 |
| `experimental_setup` | string | 实验设置；未核验处应说明 |
| `key_results` | string | 关键结果；不填未核验数字 |
| `limitations` | string | 局限与迁移风险 |
| `why_it_matters` | string | 与用户研究的关系 |
| `relevance_score` | integer 0–100 | 可解释规则评分 |
| `relevance_reason` | string | 评分原因 |
| `related_to_my_research` | string | 小论文1/2、大论文、Baseline等；不确定时待人工确认 |
| `recommended_reading` | string | 建议阅读重点 |
| `reproduction_value` | string | High/Medium/Low及理由 |
| `core_candidate` | string | Yes/No/Review |
| `source` | string | 当前为arXiv或arXiv + 正式Venue |
| `last_checked` | ISO date string | 最后核查日期 |

扩展字段包括`fact_confidence`、`analysis_status`、`ai_provider`、`ai_generated_at`、`source_query_group`、`potential_competition`、`competition_reason`和`borrowable_methods`。前端对未知字段保持兼容。

## 校验规则

`scripts/radar/schema.py`会检查必需字段、列表类型、`relevance_score`范围、URL存在性以及重复ID/规范化标题。Schema校验失败时，更新命令以非零状态退出，不覆盖有效公开数据。
