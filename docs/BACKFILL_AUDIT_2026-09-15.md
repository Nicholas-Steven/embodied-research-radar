# Backfill Data Quality Audit — 2026-09-15 (临时报告,不提交,待验收)

> 范围:仅审计本次 backfill 新增的 466 篇(OLD 185 = `_remote_ids_before.txt` 快照)。
> 只读审计,未修改抓取架构、评分规则,未删除论文,未 commit/push。
> 数据快照保存在 `_diag_logs/audit/`(score/category/date/duplicate/rule 分布 JSON)。

---

## 一、5875 → 6034 统计链纠正(问题 1)

上轮报告把 6034 标为 "Records after dedupe" 是**标注错误**,两数属于不同统计层,不是同链先后关系:

| 统计层 | 值 | 含义 |
|---|---|---|
| OAI-PMH raw records(采集池) | 5875 | 7 个 set 抓取并按 arXiv ID 去重后的窗口记录 |
| records merged before dedupe(pipeline 候选池) | 6034 | 5875 ∪ 已有 185 篇的并集 |
| 其中已有论文(去重重叠) | 26 | 旧论文在 7 天窗口内被 OAI 再次返回(update) |
| 其中窗口外旧论文 | 159 | OLD185 中 published < 9/8 的论文,由已有库直接并入候选池参与重评 |

真实链路:`raw=5875(OAI 内去重) → merged=6034(∪185, 再去重 −26 重叠) → 评分 → threshold=45 → 491 relevant → 新增 466(另 25 篇为已有论文重叠/保留)`。数字本身无矛盾,错的是标签。

---

## 二、Score 分布(问题 2)

threshold = 45,min=45, median=50, mean=53.8, p75=60, p90=65, max=100

| 区间 | 数量 | 占比 |
|---|---|---|
| 100 | 2 | 0.4% |
| 90–99 | 0 | 0.0% |
| 80–89 | 3 | 0.6% |
| 70–79 | 31 | 6.7% |
| 60–69 | 96 | 20.6% |
| 50–59 | 200 | 42.9% |
| 45–49(threshold 附近) | 134 | 28.8% |

**警讯:63% 的新增论文挤在 45–59 分,只有 6% 在 70+。**

## 三、Category 分布(问题 3)

Top(cs.RO 358, cs.AI 122, cs.CV 105, cs.LG 88, cs.SY 31, eess.SY 31, cs.CL 23)。
离题大类的**主分类计数为 0**(physics/math/q-fin/bio/astro 均未成为任何新增论文的主分类)。离题论文全部是以 cs.RO/AI/CV 为主分类、内容离题的论文(见九)。

## 四、日期分布(问题 4、17、18)

| 09-08 | 09-09 | 09-10 | 09-11 | 09-12 | 09-13 | 09-14 | 09-15 |
|---|---|---|---|---|---|---|---|
| 40 | 39 | 29 | 30 | 24 | 21 | 35 | 0 |

- **窗口外旧论文:248 篇(53%)** —— published < 2026-09-08,最老到 2024-05。
- 未来日期:0。arXiv ID 与 published 自洽,未发现 updated 被误当 published 的造假,但这 248 篇是 OAI datestamp(元数据更新日)落在窗口内的**旧论文被"更新"机制捞入**,不是按提交日期的增量。

## 五、Top 20 命中规则(问题 5)

robotic 377 / policy 166 / real-world 161 / code 157 / manipulat 155 / benchmark 151 / github 100 / dataset 93 / recover 90 / RL 81 / failure 76 / imitation 74 / contact 69 / alignment 67 / progress 66 / residual 55 / hardware 48 / transformer 47 / diffusion 43 / depth 39。

**过宽词确认:`code`/`github`/`benchmark`/`dataset`/`real-world` 这类"任何论文都可能有"的规则在 20–34% 的论文上命中;`robotic`+`policy`+`code` 三条组合即可把任意机器人论文推过 45 分。**

## 六、60 篇分层抽样人工判定(问题 6,完整逐篇表见 _diag_logs/audit/)

判定标准:具身智能/机器人操作/视触觉/失败恢复/VLA/生成式操作主线。

- **Top 20**(76–100):Force-Aware RL、GIFT、Vision-Force Admittance、Dex-X、GloVLA、PredTac、TacVLA、Colosseum V2、ControlTac 等 17 篇 Relevant;Calf Brain Ex-vivo(生物医疗手术场景)、TimeRLM(时序异常检测)、SNAP3D 偏应用场景,3 篇 Borderline。**precision ≈ 85%**
- **Mid 20**(65 左右):MemVLT、AtomicVLA、ArtManip、Touch2Trace、mjorbit、PhysReal 等 16 篇 Relevant;EasyLens(病灶影像)、Audio Deepfake、Streaming Translation、Countdown-Code 4 篇明显离题。**precision ≈ 80%**
- **Threshold 20**(45):ARC-Bench(失效动作排序,Relevant)、AtomicVLA、Continual Policy 等约 6 篇 Relevant/Borderline;**Agricultural Parcel Vectorization(农业矢量化)、Catheter Segmentation(导管分割)、SeRV(手语量化)、Satellite Collision(卫星碰撞)、Probing Speaker Identity(音频深伪)、PhysMent(物理题推理)、Meta-RL Bayesian 等 13–14 篇 Irrelevant**。**precision ≈ 30–35%**

## 七、Precision 估算(问题 7–10,抽样估计非总体精确值)

| 分层 | 估算 precision |
|---|---|
| Top band(70+) | ≈ 85% |
| Mid band(60–69) | ≈ 80% |
| Threshold band(45–59) | **≈ 30–45%** |
| Overall(466) | ≈ 60–70% |

**Threshold 附近大量假阳性,明确成立。**

## 八、最低 50 篇假阳性检查(问题 11)

50 篇全部 s=45(即"刚好过线"),其中**明显无关约 30+ 篇**:农业遥感矢量化、X 光导管分割、卫星碰撞预测、音频深伪检测、手语向量量化、物理题 LLM 推理、UAV 对抗、SLAM/里程计、水下重建等。成因:`robotic/policy/code/benchmark/real-world` 等宽词叠加 + 部分来自窗口外旧论文的"更新"重评。构成结构性假阳性带。

## 九、高分 100 篇假阳性检查(问题 12)

Top 100 中约 **10 篇偏题/离题**:Electrospun Fields(纳米纤维材料)、Countdown-Code、Visual Token Pruning、音频深伪(S=65)、TimeRLM、RADAR/雷达里程计、LiDAR 腿式、VBVR-Pro(纯视觉推理基准)、Isotropic Embedding(纯 NLP)、Steering 形式化证明。**高分段存在离题论文说明评分结构性偏宽(`robotic` 单词 + category 基础分即可到 65–70),但 Top 30 核心区(vision-force/tactile/VLA)基本可靠。**

## 十、OLD185 vs NEW466 分布对比(问题 13)

| | OLD 185 | NEW 466 |
|---|---|---|
| mean / median score | 64.7 / 61 | 53.8 / 50 |
| vision-force | 41% | 6% |
| vla-manipulation | 35% | 82% |
| generative-policy | 23% | 4% |
| failure-* | 16% | 3% |

**极端偏移:新库 82% 标到 vla-manipulation(旧库 35%),vision-force 从 41% 跌到 6%。topic 归类被宽泛的 VLA/manipulation 规则淹没,分布严重变形——重要预警成立。**

## 十一、各 Radar Topic 新增量(问题 14)

vla-manipulation 382 / core-papers 43 / vision-force 29 / generative-policy 20 / failure-recovery 13 / failure-understanding 3。
与 Radar 主线(视触觉、失败恢复)的真正强关联论文极少,vla-manipulation 成为兜底桶。

## 十二、OAI-PMH 实际抓取范围(问题 15)

- 实际 set:7 个(cs:cs:RO / AI / LG / CV / CL / SY、eess:eess:SY),checkpoint completed_sets=7/7
- from/until:2026-09-08 .. 2026-09-15(OAI datestamp = **元数据更新日**,非提交日)
- 总记录 5875,其中 multi-set 记录 3685;窗口内 per-setSpec 计数含大量交集(cs:AI 2302、cs:LG 2162、cs:CL 1179、cs:CV 1364)
- 抓取面评估:**名义上只抓 7 个 set,但 OAI datestamp 语义使 3291 条(56%)是老论文的更新事件;再叠加 multi-set 交叉,实际是"7 个大类 7 天内发生过任何元数据变动的全部论文",由关键词做唯一筛选——范围确实偏宽,这是 466 篇膨胀的主因。**(注:per-setSpec 统计含交叉重叠,总和 > 5875 是正常现象。)

## 十三、重复检查(问题 16)

最终 651 篇:重复 arXiv ID **0**,重复 DOI **0**,normalized title 重复 **0**。三字段交叉验证通过,去重可靠。

## 十四、旧论文误补 / future date(问题 17、18)

- 旧论文误补:**存在,248 篇**(published < 9/8 但 OAI 更新日落在窗口)。
- future date:0。

## 十五、是否需要调整 filter(问题 19)

**需要。** 抓取链(去重、幂等、失败语义)正确;但 (a) datestamp 窗口语义把 53% 旧论文捞入,(b) code/github/benchmark/dataset/real-world 类宽词 + robotic 单词组合造成 threshold 带假阳性率 ~60–70%。两者都需调整后重做 backfill。

## 十六、最终建议(问题 20)

# B. RELEASE AFTER FILTER TUNING

理由:抓取架构与数据安全机制已验证正确(0 重复、幂等、失败语义正确);但 threshold 带 precision(≈30–45%)远低于 80% 参考线,248 篇窗口外旧论文混入,vla-manipulation 桶占比 82% 分布变形。当前 466 篇**不应直接发布**;本地数据保留用于对比,调整窗口语义(按 submittedDate 而非 OAI datestamp 过滤)与宽词规则后重新 backfill。

---
*审计产物:_diag_logs/audit/*.json、_diag_logs/audit_backfill.py(只读脚本)。本报告与全部审计产物均未提交。*
