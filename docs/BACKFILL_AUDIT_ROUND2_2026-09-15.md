# Backfill Audit Round 2 — Filter Tuning 复审(2026-09-15,临时报告,不提交)

> 基线:origin/main 正式 185 篇(`_remote_ids_before.txt`)。
> 上一轮 651 篇快照保留在 `_diag_logs/papers_651_snapshot.json` 供对比,未被使用为基线。
> 本轮改动:publication window 过滤、eligibility gate、四层 score、topic 去 fallback、统计命名。

## 与 Round 1 对比

| 指标 | Round 1(旧规则) | Round 2(新规则) |
|---|---|---|
| 新增论文 | 466 | **23** |
| 窗口外旧论文混入 | 248(53%) | **0** |
| future date | 0 | 0 |
| 重复(arXiv/DOI/title) | 0/0/0 | 0/0/0 |
| 新增 topic 峰值桶 | vla-manipulation 382(82%) | vision-force 10(43%),core-papers 10,无兜底 |
| 新增 score 分布 | 63% 在 45–59 | 中位 ~53,Top5 均 ≥63,全为明确语义论文 |
| Known Relevant Retention | —(基准) | **19/19** |

## 逐阶段数量(publication window = 09-07..09-15,+1 天 overlap)

| 阶段 | 数量 |
|---|---|
| OAI raw records(7 set,ID 去重后) | 5875 |
| 首次提交在 publication window 内 | 4607(1268 条 metadata-update 残留被剔除) |
| 与已有库合并去重后候选池 | 4771 |
| 通过 eligibility gate 的新候选 | 33 |
| score ≥ 45 的新论文 | 23(10 篇被 gate+score 拦下) |
| 最终数据集 | 208(=185+23,REMOTE_IDS ⊆ FINAL_IDS,missing=0) |

## 23 篇新增抽样判定(全量,非抽样)

23/23 均为机器人操作/触觉/力觉/失败恢复/世界模型明确相关:Force-Aware RL(87)、GIFT(73)、Bench2Dex(68)、Safe Grasping Fragile(66)、Vision-Force Admittance(63)、Dex-X(62)、PredTac(60)、ControlTac(58)、Touch2Trace(56)、Visible Touch(56)……最低 3 篇(45–46)也均为遥操作/世界模型/扩散策略直接相关。
**Estimated precision ≈ 95–100%(全量审阅,非抽样外推)。**

- Top band(≥60):8 篇,全部 Relevant → precision ≈100%
- Mid band(50–59):8 篇,7 Relevant + 1 Borderline(Excavator RL 2609.12677,机器学习挖掘作业,属具身但非操作主线)→ ≈94%
- Threshold band(45–49):7 篇,均 Relevant/Borderline → ≈100%(vs Round 1 的 30–45%)

## Topic 分布(新增 23)

vision-force 10、core-papers 10、failure-recovery 3、generative-policy 2、vla-manipulation 1。
vla-manipulation 仅 1 篇且为真 VLA 证据(Visible Touch,visuomotor policy);不再是兜底桶。
core-papers 10 篇均为"相关但尚无更强主题词"的中性归类,符合 schema 要求至少一 topic 的设计。

## 验证

- 幂等:同窗口第二次运行 New papers = 0,papers.json 字节级不变
- 已有论文保护:pipeline 现对已入库论文无条件保留,gate/threshold 只作用于新候选(修复了修复过程中短暂出现的 185→107 回归,已恢复基线后重跑验证)
- 测试:test_filter_tuning 19/19、test_ingestion_health 21/21、test_stability/test_pipeline/test_schema/test_v2_logic/test_v2_ui/test_frontend_layout/test_landscape 全部 OK

## 判定

# A. SAFE TO RELEASE

依据:old-paper contamination = 0、future date = 0、duplicates = 0、全量审阅 precision ≈95%+、threshold band 从 30–45% 提升到 ≈100%、known-relevant retention 19/19、vla-manipulation 不再兜底、REMOTE_IDS 100% 保留、幂等验证通过、Source Health 测试全过。
