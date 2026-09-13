# Method Reference Audit — 方法代表论文核验日志（Method Knowledge Base V2）

> 本日志记录 26 个方法的代表论文检索、核验与绑定决策。全部文献经 web 检索核验
> （publisher / 会议论文集 / arXiv / IEEE / PMLR / ASME / Cambridge 等官方来源），
> 未使用 ResearchGate 作为事实来源；无法核验的字段一律不写。
>
> Verification Level 说明：本轮所有论文均完成 **摘要级核验**（ABSTRACT_VERIFIED，
> 经检索摘要/官方页确认题目、作者、年份、venue、链接），未逐篇精读全文，故不标
> FULLTEXT_VERIFIED；用户后续精读后可手动升级。
>
> 原则：宁缺毋滥——某类没有高质量文献时留空数组（前端显示「暂无已核验文献」），
> 不硬凑数量；同一篇文献可在多个方法中以不同 relevanceNote 复用（去重后 38 篇唯一文献）。

## 核验来源汇总

| 来源类型 | 用于 |
|---|---|
| DOI 解析页（doi.org / IEEE / ASME / Elsevier / Cambridge / IET） | 经典基础文献元数据 |
| 官方论文集（papers.nips.cc / proceedings.mlr.press / emnlp2014.org） | ML 会议文献 |
| arXiv 官方摘要页 | 预印本（标注 PREPRINT） |
| MERL / 个人学术主页 / 项目页（merl.com, personalrobotics.cs.washington.edu, idto.github.io, matthewpeterkelly.com） | 会议论文官方副本 |
| projecteuclid / ADS | 统计与信息论经典 |

## 逐方法绑定记录

### 状态 / 信念估计（6 方法）

**Bayesian Filter**
- 经典基础：Kalman 1960（ASME J. Basic Engineering, DOI 10.1115/1.3662552）——检索确认原文出处。
- 机器人应用：Shirai et al., Tactile Tool Manipulation, ICRA 2023（MERL 官方 PDF）——触觉估计+MPC 闭环。
- 课题最近：Saund et al., The Blindfolded Robot, ISRR 2019（UW 官方 PDF）。
- 排除候选：Jazwinski 1970（专著，无稳定在线元数据，放弃，以 Kalman 1960 代替）。

**IMM**
- 经典基础：Blom & Bar-Shalom 1988（IEEE TAC 33(8), DOI 10.1109/9.1299，2405 引用确认）。
- 机器人应用 / 课题最近：**留空**——检索未找到「IMM 用于接触模式估计」的高质量代表作；不硬凑。

**Particle Filter**
- 经典基础：Gordon, Salmond & Smith 1993（IEE Proceedings F, DOI 10.1049/ip-f-2.1993.0015，bootstrap filter 原文）。
- 机器人应用：Saund et al. 2019（Manifold Particle Filter 处理接触观测）。
- 课题最近：同上（复用，relevanceNote 不同）。

**TCN**
- 经典基础：Bai, Kolter & Koltun 2018（arXiv:1803.01271，TCN 标志论文；官方页确认 authors/链接）。
- 机器人应用：**留空**——未找到「TCN 直接用于 F/T 分类」且经核验的代表作。
- 课题最近：İnceoğlu et al., FINO-Net, IROS 2021（arXiv:2011.05817 + IEEE 9636455 双重核验）——卷积族时序骨干做失败检测。

**Transformer**
- 经典基础：Vaswani et al., Attention Is All You Need, NeurIPS 2017（papers.nips.cc 官方页）。
- 机器人应用：Chen et al., Visuo-Tactile Transformers, CoRL 2023（PMLR v205 官方页）；Qi et al., RotateIt, CoRL 2023（PMLR v229 官方页，摘要确认 visuotactile transformer）。
- 课题最近：Visuo-Tactile Transformers（复用，强调「表征学习 vs 失败假设可辨识性」的差异点）。

**SSM**
- 经典基础：Gu, Goel & Ré, S4, ICLR 2022（arXiv:2111.00396 官方摘要页）。
- 机器人应用 / 课题最近：**留空**——现代 SSM 在接触操作的应用尚未有经核验的代表作。

### 主动诊断（6 方法）

**EIG**
- 经典基础：Lindley 1956（Ann. Math. Statist. 27(4), DOI 10.1214/aoms/1177728069，实验信息量奠基）。
- 机器人应用：Jiang & Wong, Active Tactile Exploration using Shape-Dependent RL, IROS 2022（IEEE DOI 确认）。
- 课题最近：Saund et al. 2019（复用）。

**VOI**
- 经典基础：Howard 1966（IEEE Trans. Systems Science and Cybernetics 2(1), DOI 10.1109/tssc.1966.300074，信息价值理论原文）。
- 机器人应用 / 课题最近：**留空**——「NetVOI 探测决策」的直接机器人应用即本课题本身；不虚构近邻。

**Optimal Experiment Design**
- 经典基础：Scott et al. 2014（Automatica 50(6), DOI 10.1016/j.automatica.2014.03.016，zonotope 分离输入）+ Punčochář et al. 2018 AFD 综述（DOI 10.1016/j.ifacol.2018.09.726）。
- 排除候选：Heirung & Mesbah 2019（Annu. Rev. Control input design for AFD）——综述级、信息足够但两篇已覆盖，避免堆砌。
- 机器人应用 / 课题最近：**留空**。

**Dual Control**
- 经典基础：Bar-Shalom & Tse 1974（IEEE TAC 19(5), DOI 10.1109/tac.1974.1100635，对偶效应严格定义）。
- 排除候选：Feldbaum 1961（原始提出但无稳定可核验电子版）；Tse, Bar-Shalom & Meier 1973（wide-sense adaptive dual control，同类可后补）。
- 机器人应用 / 课题最近：**留空**。

**Belief-space MPC**
- 机器人应用：Saund 2021 PhD Thesis（UW, DOI 10.7302/2890，官方库核验）。
- 课题最近：Saund et al. 2019（复用）。
- 经典基础：**留空**——belief-space 规划无单一奠基论文可代表，不硬凑。

**POMDP**
- 经典基础：Kaelbling, Littman & Cassandra 1998（Artificial Intelligence 101, MIT 官方 PDF）。
- 机器人应用：Shahidzadeh et al., AcTExplore, 2023（arXiv:2310.08745，PREPRINT 如实标注）。
- 课题最近：Saund et al. 2019（复用）。

### 恢复优化（5 方法）

**MPC**
- 经典基础：Mayne, Rawlings, Rao & Scokaert 2000（Automatica 36(6), DOI 10.1016/S0005-1098(99)00214-9）。
- 机器人应用：Shirai et al., ICRA 2023（复用）。
- 课题最近：Matschek, Bethge & Findeisen 2023（arXiv:2303.04569，力+运动 MPC 带随机安全保证）。

**Risk-sensitive MPC**
- 经典基础：Whittle 1981（Adv. Appl. Prob. 13(4), DOI 10.2307/1426972，风险敏感控制奠基）。
- 课题最近：Matschek et al. 2023（复用）。
- 机器人应用：**留空**（RS-EKF 文献存在但属滤波器而非 MPC，避免张冠李戴）。

**DRMPC**
- 经典基础：Scokaert & Mayne 1998（IEEE TAC 43(8), DOI 10.1109/9.704989，min-max feedback MPC）。
- 说明：DRMPC 本身文献分散，以最坏情况 MPC 经典为源头代表；不虚构「DRMPC 奠基论文」。
- 机器人应用 / 课题最近：**留空**。

**MPPI**
- 经典基础：Williams, Aldrich & Theodorou 2017（JGCD 40(2), DOI 10.2514/1.G001921）。
- 机器人应用：Pezzato et al. 2023（arXiv:2307.09105，官方摘要页确认作者与内容，IsaacGym-MPPI contact-rich）。
- 排除候选：Bhardwaj et al., Stabilize an Unstable Actuator (CoRL 2021)——检索未能核验官方元数据，放弃。

**Trajectory Optimization**
- 经典基础：Kelly 2017（SIAM Review 59(4)，作者官网官方 PDF）。
- 机器人应用：Kurtz, Castro, Önol & Lin, IDTO, 2023（arXiv:2309.01813 + idto.github.io 项目页双重核验，硬件 100Hz CI-MPC）。

### 交互控制（6 方法）

**Impedance Control**
- 经典基础：Hogan 1985 Part I（ASME JDSMC 107(1), DOI 10.1115/1.3140702，检索确认三部曲结构）。
- 课题最近：Whitney 1982（ASME JDSMC 104(1), DOI 10.1115/1.3149634，RCC 柔顺装配分析）。
- 机器人应用：**留空**（Whitney 兼作应用侧）。

**Admittance Control**
- 经典基础：Hogan 1985 Part I（复用——阻抗/导纳对偶的理论出处）。
- 机器人应用：Madani et al., IROS 2022（IEEE DOI 10.1109/iros47612.2022.9982000，6-DoF 自适应导纳钻孔实验）。
- 排除候选：工业抛光导纳多篇（Proc. IMechE 等）——质量低于 IROS 实验，排除。

**Hybrid Force/Position**
- 经典基础：Raibert & Craig 1981（ASME JDSMC 103(2), DOI 10.1115/1.3139652，官方 PDF 全文确认含插孔实验）。
- 机器人应用 / 课题最近：**留空**（原始论文即含实验验证）。

**Sliding Mode**
- 经典基础：Utkin 1977（IEEE TAC 22(2), DOI 10.1109/tac.1977.1101446，5322 引用确认）。
- 机器人应用 / 课题最近：**留空**——机器人 SMC 力控文献丰富但未完成本轮核验，不硬凑。

**Super-Twisting**
- 经典基础：Moreno & Osorio 2012（IEEE TAC 57(4), DOI 10.1109/tac.2012.2186179，严格 Lyapunov 证明）。
- 机器人应用 / 课题最近：**留空**。

**CBF**
- 经典基础：Ames et al., ECC 2019（作者官方 PDF，Coogan 主页核验）。
- 机器人应用 / 课题最近：**留空**——力量化 CBF（如 force-based CBF for contact）文献存在但本轮未核验，后补。

### 安全（4 方法）

**Passivity**
- 经典基础：Hogan 1985 Part I（复用——无源交互思想源头）。
- 机器人应用：Ferraguti et al. 2015（IEEE T-RO 31(5), DOI 10.1109/TRO.2015.2455791，能量罐+无源交互架构，含针 insertion 场景）。

**Energy Tank**
- 机器人应用（兼经典代表）：Ferraguti et al. 2015（复用，relevanceNote 不同）。
- 排除候选：Ferraguti et al. 2013 tank-based variable stiffness impedance（ICRA）——被 T-RO 2015 覆盖，取其一。

**Safety Filter**
- 经典基础：Wabersich & Zeilinger 2021（Automatica 129:109597，预测安全滤波器奠基）+ Wabersich et al. 2023 综述（IEEE DOI 10.1109/mcs.2023.3291885，三大路线统一视角）。
- 机器人应用 / 课题最近：**留空**。

## 统计

- 唯一文献数：**38**（复用后总绑定 49 处）
- 经典基础：18 · 机器人应用：13 · 课题最近：18（复用计入）
- PUBLISHED：34 · PREPRINT：4（arXiv 如实标注）
- ABSTRACT_VERIFIED：全部；FULLTEXT_VERIFIED：0（待人工精读升级）
- 复用 paper_id：0（papers.json 现有条目均无与本批文献匹配的条目；未向 papers.json 新增论文——
  方法文献以独立核验条目绑定，避免污染追踪数据集；后续如需并入再按 DOI/arXiv 去重）
