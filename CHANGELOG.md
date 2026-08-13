# 改动日志 / Changelog

本项目所有重要改动记录。格式：`日期 - 说明`。

## 2026-08-13 - UI 终版返工：宽卡片论文墙

- **Grid 布局**：论文列表改为真正的宽卡片网格，桌面 4 列（≥1500px）/ 3 列（1100-1499px）/ 平板 2 列（680-1099px）/ 手机 1 列（<680px）；主内容区 `max-width:1500px` 居中，卡片宽度保持在约 290-340px，不再出现细长竖条。
- **卡片结构**：重构 `renderCard()`，信息层级为 Figure 缩略图 → Meta（日期/Venue + 评分）→ 标题（最多 3 行）→ 作者（1 行）→ 一句话摘要（最多 3 行）→ 标签（最多 3 个 +N）→ 操作区（详细分析/论文/PDF/Code）。
- **图片区域**：固定 `aspect-ratio:4/3` + `object-fit:contain` 浅色背景，不裁图；无图论文显示统一占位（Embodied / Research / Radar）。
- **视觉**：卡片 10px 圆角、紧凑 padding、按钮统一靠底对齐、轻微 hover 阴影上移；整体保持学术、克制、高信息密度。
- **日期分组**：保持日期纵向 Section（日期标题 + 分割线 + 当日数量 + 横向卡片网格），减少大面积留白。

## 2026-08-13 - 稳定性修复与日期分组

- **arXiv 429 处理**（`arxiv_fetcher.py`）：429 专用退避——优先遵循 `Retry-After`，否则指数退避 + jitter（15/30/60s 量级，`ARXIV_BACKOFF_BASE_SECONDS` / `ARXIV_BACKOFF_MAX_SECONDS` 可配）；400/401/403/404 不重试；连续 429 达上限（默认 5 次）跳过剩余查询，保证更新在合理时间结束。
- **管线顺序**（`pipeline.py`）：改为 `评分 → threshold 过滤 → AI 分析`，低相关论文不再消耗 LLM；已有 `analysis_status=ready` 的论文直接复用。
- **LLM 重试**（`ai.py`）：timeout/URLError/408/429/5xx 最多重试 3 次（backoff + jitter）；400/401/402/403 不重试；超时可通过 `LLM_TIMEOUT_SECONDS` 配置（默认 90s）。
- **多 query 合并**（`arxiv_fetcher.py`）：同一论文被多个查询组命中时合并 `research_topics`，并记录 `source_query_groups` 来源。
- **前端日期分组**：列表页"最近加入雷达"按 `published_date` 分组，日期降序，每组显示日期标题、分割线、当日数量（筛选后数量动态变化）。
- **测试**：新增 `tests/test_stability.py`，8 个 mock 测试覆盖低分不调 LLM、ready 复用、高分调用、429 退避上限、402 不重试、timeout 后恢复、多 query 合并。

## 2026-08-12 - AI 分析与界面增强

- **AI 分析接入硅基流动**：`ai.py` 兼容 OpenAI-compatible 接口（`LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY`），支持 `response_format=json_object` 被拒时自动降级；新增 `related_to_my_research` 字段由 AI 生成（"待人工确认"减少）。
- **详情页**：修复空数组分析字段渲染空白问题（显示 Pending 占位）；区块标题改为中英双语（中文居左、英文居右）。
- **暗色模式**：切换按钮显示当前模式（◐ 暗色 / ◑ 浅色），同步更新浏览器主题色，选择记忆在本地。
- **论文缩略图**：管线从 arXiv HTML 版提取论文首图（`image` 字段），列表卡片显示缩略图。

## 2026-08-12 - 初始发布

- 完成项目初始化并部署至 GitHub Pages（`https://nicholas-steven.github.io/embodied-research-radar/`）。
- 首次发布包含：Demo 论文数据、Vision-Force Fusion 主分支、其余研究分支 Coming Soon 结构、每日自动更新工作流（UTC 04:00）。
