// 方法知识库 V2：解释升级（先直观后数学）+ KaTeX 公式 + 三分类代表论文
// 论文均为检索核验的公开文献（标题/作者/年份/venue/DOI 或 arXiv），不得虚构；
// 某类无高质量文献时留空数组，UI 显示「暂无已核验文献」。
// verification: METADATA_VERIFIED / ABSTRACT_VERIFIED（本站未逐篇全文精读，不标 FULLTEXT）。
// latex 字段使用 String.raw 保持反斜杠字面量，交由 KaTeX 渲染，渲染失败自动降级为原文。
export const methodKnowledge = {
  // ── 状态 / 信念估计 ────────────────────────────────────────────
  "bayesian-filter": {
    plainExplanation:
      "贝叶斯滤波回答一个问题：在看过目前为止所有观测之后，系统真实状态最可能是什么？它不直接给标签，而是维护一个随时间递归更新的概率分布（信念）。每个时刻先由运动/转移模型把上一时刻的分布向前推（预测），再用当前观测把它修正（更新）。对接触操作而言，这意味着 Jam、Misalignment、Success 等失败假设各自带一个概率，且随 F/T 证据不断演化，而不是每次都从零开始判断。",
    robotExample:
      "机器人正在插孔。当前信念：成功 50%、错位 30%、卡滞 20%。下一时刻 Fz 很高且 My 持续偏正。贝叶斯滤波不会把这一帧单独分类，而是结合上一时刻信念与当前 F/T 证据，把后验更新为成功 10%、错位 25%、卡滞 65%——历史被显式继承，单帧证据被放大或抑制。",
    inputs: "上一时刻信念 b_{t-1}（各失败假设概率）；转移/运动模型；当前观测 z_t（6D F/T、视觉特征等）。",
    outputs: "更新后的信念 b_t（各失败假设的后验概率）；可选的期望状态估计。",
    mathBlocks: [
      {
        title: "预测（先验推进）",
        latex: String.raw`p(x_t \mid z_{1:t-1}) = \int p(x_t \mid x_{t-1})\, p(x_{t-1} \mid z_{1:t-1})\, dx_{t-1}`,
        explanation: [
          "p(x_{t-1} | z_{1:t-1})：上一时刻的后验，也就是「到目前为止所知道的一切」。",
          "p(x_t | x_{t-1})：转移模型——机器人动了之后状态大概率怎么变。",
          "积分把所有可能的上一时刻状态按概率加权，得到当前时刻的先验。",
          "直观理解：还没看新观测时，先把旧信念沿动力学推一步。",
        ],
      },
      {
        title: "更新（观测修正）",
        latex: String.raw`p(x_t \mid z_{1:t}) \propto p(z_t \mid x_t)\, p(x_t \mid z_{1:t-1})`,
        explanation: [
          "p(x_t | z_{1:t-1})：prior——预测步给出的先验。",
          "p(z_t | x_t)：likelihood——如果真实状态是 x_t，观测到 z_t 的可能性。",
          "p(x_t | z_{1:t})：posterior——两者相乘归一化后的后验。",
          "证据与先验一致的假设概率上升，矛盾的假设概率下降。",
        ],
      },
    ],
    robotWorkflow: [
      "初始化各失败假设的先验概率（如成功/错位/卡滞/接触丢失）。",
      "每个控制周期，用转移模型把上一时刻信念推进到当前时刻。",
      "读取腕部 6D F/T（与视觉特征），计算各假设下的观测似然。",
      "按贝叶斯公式更新后验并归一化。",
      "把后验交给下游：NetVOI 探测决策、后验条件化恢复。",
    ],
    comparisonNotes:
      "与 Particle Filter 的区别：贝叶斯滤波是框架，粒子滤波是它的一种数值实现——当状态连续、非高斯、无法解析积分时用粒子近似；离散失败假设集上直接做离散贝叶斯更新即可，无需粒子。与 IMM 的区别：普通贝叶斯滤波假设单一固定转移模型；IMM 并行运行多个模型（自由/接触/滑移）并维护模型概率，适合动力学模式切换的接触任务。",
    layerPosition: "Failure Belief Update——失败信念更新的概率骨架，接在时序编码器之后、NetVOI 决策之前。",
    recommendationReason:
      "推荐程度：高。当前课题的核心输出就是失败假设的后验信念，贝叶斯滤波以最小的实现代价提供概率化、可审计的信念维护，并与 belief-space 规划自然衔接；但它只是载体，不是创新点本身。",
    paperGroups: {
      foundation: [
        {
          title: "A New Approach to Linear Filtering and Prediction Problems",
          authors: "R. E. Kalman",
          year: 1960,
          venue: "Journal of Basic Engineering (ASME) 82(1):35–45",
          status: "PUBLISHED",
          verification: "METADATA_VERIFIED",
          url: "https://doi.org/10.1115/1.3662552",
          relevanceNote: "卡尔曼滤波原始论文，贝叶斯递归估计的高斯线性特例，一切现代滤波的出发点。",
        },
      ],
      robotics: [
        {
          title: "Tactile Tool Manipulation",
          authors: "Y. Shirai, D. K. Jha, A. Raghunathan, D. Hong",
          year: 2023,
          venue: "ICRA 2023",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://merl.com/publications/docs/TR2023-023.pdf",
          relevanceNote: "用触觉观测在线估计工具/物体位姿（贝叶斯估计），再接入闭环 MPC，是「估计+控制」分离架构的接触操作实例。",
        },
      ],
      closest: [
        {
          title: "The Blindfolded Robot: A Bayesian Approach to Planning with Contact Feedback",
          authors: "B. Saund, S. Choudhury, S. Srinivasa, D. Berenson",
          year: 2019,
          venue: "ISRR 2019",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://personalrobotics.cs.washington.edu/publications/saund2019btp.pdf",
          relevanceNote: "仅靠接触观测维护占据信念并驱动规划——与「用 F/T 证据维护失败信念」的推理结构最接近。",
        },
      ],
    },
  },

  "imm": {
    plainExplanation:
      "接触操作中，机器人的动力学不是一成不变的：抓着物体悬空是一种动力学，贴上表面是另一种，滑移、卡滞又是另外几种。IMM（交互多模型）的做法很直白：为每一种可能的接触模式各配一个滤波器并行运行，再根据「当前更像哪种模式」对它们的结果加权融合。它输出的不只是一个估计，还有每个模式自身的概率——这个模式概率恰好就是接触状态的信念。",
    robotExample:
      "机械臂推抽屉：自由挥动阶段「自由运动」滤波器主导；接触面板瞬间 Fz 跳变，「接触」滤波器权重上升；若随后出现持续切向速度，「滑移」滤波器接管。整个过程无需人工检测切换时刻，模式概率自动完成软切换。",
    inputs: "模式集合（free / contact / slip / jam…）；模式间转移概率矩阵；各模式的运动/观测模型；当前观测 z_t。",
    outputs: "混合状态估计 x̂_t；各模式的后验概率 P(M_i | z_{1:t})。",
    mathBlocks: [
      {
        title: "模式概率更新（交互思想）",
        latex: String.raw`\mu_j(t) \propto p(z_t \mid M_j) \sum_i \pi_{ij}\, \mu_i(t-1)`,
        explanation: [
          "M_j：第 j 种接触模式（如 free / contact / slip）。",
          "π_ij：上一时刻是模式 i、当前切到模式 j 的转移概率。",
          "μ_i(t-1)：上一时刻各模式的概率。",
          "p(z_t | M_j)：当前观测在模式 j 下出现的似然——证据支持哪种模式，哪种模式权重上升。",
          "融合估计：x̂(t) = Σ_j μ_j(t)·x̂_j(t)，各滤波器结果按模式概率加权。",
        ],
      },
    ],
    robotWorkflow: [
      "定义有限接触模式集（free / contact / slip / jam）并为每个模式配置滤波器。",
      "初始化模式概率与各滤波器状态。",
      "每周期：模式间按转移概率混合（交互）。",
      "各模式滤波器独立做一次预测+更新。",
      "用观测似然更新模式概率并加权融合输出。",
    ],
    comparisonNotes:
      "与普通贝叶斯滤波的区别：普通滤波只有一套固定转移/观测模型，动力学模式切换时必然失配；IMM 用多个模型并行+概率加权来适应切换。与 Particle Filter 的区别：粒子滤波用任意样本近似任意分布，通用但计算重；IMM 通常每个模式用高斯滤波器，轻量但模式集合需预先定义。",
    layerPosition: "Failure Belief Update 的多模式变体——当不同失败假设对应明显不同的动力学模式时，可用 IMM 替代单一滤波器。",
    recommendationReason:
      "推荐程度：中。适合作为失败假设对应动力学模式差异明显时的信念维护备选；但如果失败假设更多靠时序证据区分而非动力学切换，普通离散贝叶斯滤波更简单直接。",
    paperGroups: {
      foundation: [
        {
          title: "The Interacting Multiple Model Algorithm for Systems with Markovian Switching Coefficients",
          authors: "H. A. P. Blom, Y. Bar-Shalom",
          year: 1988,
          venue: "IEEE Transactions on Automatic Control 33(8):780–783",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1109/9.1299",
          relevanceNote: "IMM 算法原始论文，提出按马尔可夫切换系数做假设合并的经典方案。",
        },
      ],
      robotics: [],
      closest: [],
    },
  },

  "particle-filter": {
    plainExplanation:
      "粒子滤波用「一大群带权重的样本」来表示信念，而不是用一条公式。每个粒子是一个「世界可能是这样」的候选：机器人想象出几百种可能情形，每种情形预测下一步、再用当前观测打分，分数就是权重，最后权重高的粒子被复制、低的被淘汰（重采样）。它的最大好处是不受高斯假设限制——接触事件这种非线性和多峰场景，粒子照样能表达。",
    robotExample:
      "机械臂在遮挡区域摸索物体：视觉看不到，只有碰撞发生时腕部 F/T 突变。粒子滤波维持 500 个粒子，每个粒子代表「障碍物可能在某处」。碰撞发生时，与该碰撞一致的粒子权重上升，重采样后粒子群向真实障碍位置收敛——即使障碍物位置的可能性是多峰的（左边或右边都有可能）。",
    inputs: "上一时刻粒子集 {x_{t-1}^{(i)}, w_{t-1}^{(i)}}；转移模型；观测模型（如 F/T 突变与碰撞的似然）。",
    outputs: "新的带权粒子集（即信念的样本近似）；可从粒子统计出期望/方差/众数。",
    mathBlocks: [
      {
        title: "信念的粒子表示",
        latex: String.raw`p(x_t \mid z_{1:t}) \approx \sum_{i=1}^{N} w_t^{(i)}\, \delta\!\left(x_t - x_t^{(i)}\right)`,
        explanation: [
          "x_t^{(i)}：第 i 个粒子——一个具体的状态候选（如「障碍在 (0.3, 0.1)」）。",
          "w_t^{(i)}：该粒子的权重——当前观测对它的支持程度。",
          "δ：Dirac delta，把概率质量集中在这个候选点上。",
          "N 个加权粒子合起来近似整个后验分布。",
        ],
      },
      {
        title: "重采样",
        latex: String.raw`x_t^{(j)} \sim \left\{ x_t^{(i)}, w_t^{(i)} \right\}_{i=1}^{N}`,
        explanation: [
          "按权重 w 有放回地抽取 N 个新粒子，替换旧粒子集。",
          "作用：淘汰低权重（与现实不符）的粒子，避免「粒子退化」。",
          "代价：引入样本多样性损失，故需配合足够的粒子数或噪声注入。",
        ],
      },
    ],
    robotWorkflow: [
      "初始化 N 个粒子（失败假设或接触状态的候选）。",
      "每个粒子按转移模型前推一步（加过程噪声）。",
      "用当前 F/T / 视觉观测计算每个粒子的似然并赋权重。",
      "归一化权重；若有效粒子数过低则重采样。",
      "从粒子集统计出信念交给下游决策。",
    ],
    comparisonNotes:
      "与（离散）贝叶斯滤波的区别：失败假设只有几个、概率可直接在网格上递归时，离散滤波精确且便宜；粒子滤波是为连续/高维/非高斯状态准备的数值近似。与 IMM 的区别：IMM 假设模式有限且每个模式内近似高斯；粒子滤波对模式形状无假设，但计算量随状态维度增长。",
    layerPosition: "Failure Belief Update 的连续状态实现备选——当接触几何/物体位姿等连续量需要与失败假设联合估计时使用。",
    recommendationReason:
      "推荐程度：中。适合接触几何未知、信念多峰的子问题（如 Saund 的碰撞假设集）；若课题只需要区分少数失败假设，离散滤波足够，不必引入粒子开销。",
    paperGroups: {
      foundation: [
        {
          title: "Novel Approach to Nonlinear/Non-Gaussian Bayesian State Estimation",
          authors: "N. J. Gordon, D. J. Salmond, A. F. M. Smith",
          year: 1993,
          venue: "IEE Proceedings F (Radar and Signal Processing) 140(2):107–113",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1049/ip-f-2.1993.0015",
          relevanceNote: "bootstrap filter 原始论文，第一个实用的粒子滤波实现，摆脱线性高斯假设。",
        },
      ],
      robotics: [
        {
          title: "The Blindfolded Robot: A Bayesian Approach to Planning with Contact Feedback",
          authors: "B. Saund, S. Choudhury, S. Srinivasa, D. Berenson",
          year: 2019,
          venue: "ISRR 2019",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://personalrobotics.cs.washington.edu/publications/saund2019btp.pdf",
          relevanceNote: "提出 Manifold Particle Filter 处理接触观测（碰撞/无碰撞）下的信念维护，是粒子滤波在接触感知中的代表作。",
        },
      ],
      closest: [
        {
          title: "The Blindfolded Robot: A Bayesian Approach to Planning with Contact Feedback",
          authors: "B. Saund, S. Choudhury, S. Srinivasa, D. Berenson",
          year: 2019,
          venue: "ISRR 2019",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://personalrobotics.cs.washington.edu/publications/saund2019btp.pdf",
          relevanceNote: "同一篇论文兼作最近邻：仅凭接触信息维护信念并规划，与课题「F/T 证据→失败信念」结构同源，需作为撞题监控对象。",
        },
      ],
    },
  },

  "tcn": {
    plainExplanation:
      "TCN（时间卷积网络）用一维卷积处理时间序列。它有两个关键设计：因果卷积——每个时刻只能看过去、不能偷看未来，适合在线运行；膨胀卷积——每隔 d 个时刻采样一次再做卷积，层数叠起来后感受野指数增长，用很少的层数就能覆盖很长的历史。对 F/T 这种连续、局部模式很重要的信号，TCN 往往比循环网络更稳、更快、更好训练。",
    robotExample:
      "输入最近 1 秒的 6D F/T 序列（100Hz × 6 通道）。第一层看相邻几毫秒的力变化（接触瞬间的尖峰），第二层隔 2 个采样点看（约几十毫秒的振荡），第三层隔 4 个看（上百毫秒的持续趋势）。三层下来网络既看到了 Fz 尖峰，也看到了 My 缓慢累积——这正是区分「瞬时冲击」与「逐渐卡滞」的时序特征。输出是一个时序特征向量 z_t，后面接 belief head 才输出 Jam / Misalignment 概率。",
    inputs: "连续 6D F/T 时间序列 [F_x, F_y, F_z, M_x, M_y, M_z]_{t-H:t}（或已编码的视觉时序特征）。",
    outputs: "每个时刻的时序特征向量 z_t——它自己不直接输出 Jam / Misalignment，除非后面再接分类/belief head。",
    mathBlocks: [
      {
        title: "因果膨胀卷积",
        latex: String.raw`y_t = \sum_{k=0}^{K-1} w_k\, x_{t - d\cdot k}`,
        explanation: [
          "x：输入的 F/T 序列；y：卷积输出特征。",
          "w_k：卷积核权重——学习「什么样的历史模式重要」。",
          "K：卷积核长度——一次看多少个采样点。",
          "d：膨胀系数——采样间隔。d=1 是普通卷积；d=2、4、8 逐层加倍，感受野按 1+K(d₁+d₂+…) 增长。",
          "只对 t-d·k ≤ t 求和：因果性——当前输出只依赖过去，不泄漏未来。",
        ],
      },
    ],
    robotWorkflow: [
      "缓存最近 H 个采样点的 6D F/T（如 1–2 秒 @100Hz）。",
      "序列依次通过若干层因果膨胀卷积 + 残差连接。",
      "取最后一时刻（或时序池化）的输出作为时序特征 z_t。",
      "z_t 送入 belief head 或与视觉特征做跨模态融合。",
      "模型推理一次仅毫秒级，满足 100Hz 在线运行。",
    ],
    comparisonNotes:
      "TCN vs Transformer vs SSM：TCN 用固定感受野的卷积归纳偏置，训练稳定、推理快，但跨长程的信息传递靠层数堆叠；Transformer 用自注意力让任意两个时刻直接交互，长程依赖建模最强但计算量随序列长度平方增长；SSM（如 S4/Mamba）用线性状态空间递推，长序列下计算近似线性，适合超长历史。1–2 秒 F/T 窗口内三者差异不大，TCN 通常是最省心的起点。",
    layerPosition: "Force Temporal Encoder——F/T 时序编码器的首选实现，位于 belief 更新与跨模态融合之前。",
    recommendationReason:
      "推荐程度：高。F/T 信号局部模式丰富、采样率高、窗口不长，TCN 在该场景推理快、训练稳定，且比 Transformer 更容易在实验室算力下复现；作为论文方法栈的默认力觉编码器。",
    paperGroups: {
      foundation: [
        {
          title: "An Empirical Evaluation of Generic Convolutional and Recurrent Networks for Sequence Modeling",
          authors: "S. Bai, J. Z. Kolter, V. Koltun",
          year: 2018,
          venue: "arXiv:1803.01271",
          status: "PREPRINT",
          verification: "ABSTRACT_VERIFIED",
          url: "https://arxiv.org/abs/1803.01271",
          relevanceNote: "TCN 的标志性论文：系统证明因果+膨胀卷积架构在多种序列任务上优于 LSTM/GRU，确立了 TCN 作为序列建模默认选项的地位。",
        },
      ],
      robotics: [],
      closest: [
        {
          title: "FINO-Net: A Deep Multimodal Sensor Fusion Framework for Manipulation Failure Detection",
          authors: "A. Inceoglu, E. E. Aksoy, A. C. Ak, S. Sariel",
          year: 2021,
          venue: "IROS 2021",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://arxiv.org/abs/2011.05817",
          relevanceNote: "多模态时序网络做操作失败检测/分类，与「时序编码→失败识别」的角色定位最接近；其时序骨干与 TCN 同属卷积族。",
        },
      ],
    },
  },

  "transformer": {
    plainExplanation:
      "Transformer 的核心思想：在判断当前时刻时，不只看最近一个观测，而是让模型自己决定历史中哪些时刻最重要。每个时刻的观测被编码成 token，自注意力机制为「当前 token 与每个历史 token 的相关程度」打分，再按分数加权聚合信息。机器人当前出现很大的轴向力时，它可以回看 0.5 秒前是否发生过横向力矩突增，从而判断这是正常接触还是逐渐形成的卡滞。在你的课题里，它更适合用来编码连续 F/T 历史和视觉-力觉跨模态关系，而不是直接负责恢复控制。",
    robotExample:
      "插孔过程中：把每个采样点的 F/T 向量与视觉特征分别编码成 token。接触瞬间 My 出现明显突变——self-attention 让后续时刻的 token 给这段「突变片段」更大权重；再做 cross-attention，视觉 token 作为 Query 去查询 F/T 的 Key/Value，把「当时视觉看到的角度偏差」与「当时力的响应」对齐。融合特征送入 belief head，输出 Misalignment 概率上升。",
    inputs: "分帧编码后的 F/T token 序列与/或视觉 token 序列（含位置编码）。",
    outputs: "每个位置融合了历史与跨模态信息的上下文特征（fused latent）。",
    mathBlocks: [
      {
        title: "标准自注意力",
        latex: String.raw`\operatorname{Attention}(Q, K, V) = \operatorname{softmax}\!\left( \frac{QK^{\top}}{\sqrt{d_k}} \right) V`,
        explanation: [
          "Q（Query）：当前 token 想找什么信息。",
          "K（Key）：每个历史 token 提供「我有什么信息」。",
          "V（Value）：真正被聚合的内容。",
          "QK^T：衡量当前 token 和历史各 token 的相关程度。",
          "√d_k：防止维度增大后点积数值过大，softmax 饱和。",
          "softmax：把相关程度转换成总和为 1 的注意力权重。",
          "最终：模型自动决定历史哪些时刻更值得关注。",
        ],
      },
      {
        title: "跨模态交叉注意力（视觉↔力觉）",
        latex: String.raw`\operatorname{CrossAttn}(Q_{\text{vis}}, K_{\text{ft}}, V_{\text{ft}}) = \operatorname{softmax}\!\left( \frac{Q_{\text{vis}} K_{\text{ft}}^{\top}}{\sqrt{d_k}} \right) V_{\text{ft}}`,
        explanation: [
          "Q 来自视觉；K/V 来自 F/T（或反过来）。",
          "含义：视觉的每个位置去力觉历史中「查询」与自身相关的力响应模式。",
          "例如视觉 token（孔口区域）主动加权 My 突变的时间段——跨模态对齐由此显式发生。",
        ],
      },
    ],
    robotWorkflow: [
      "收集最近 1 秒 6D F/T 与同步视觉特征。",
      "每个采样点（加位置编码）编码成 token。",
      "self-attention 找出关键历史片段（如力矩突变）。",
      "visual token 与 force token 做 cross-attention 实现跨模态融合。",
      "输出 fused latent；belief head 输出 Jam / Misalignment posterior。",
    ],
    comparisonNotes:
      "与 TCN 的区别：TCN 感受野固定、靠层数扩大，注意力则任意两时刻直达，长程依赖更强但算力开销大；与 SSM 的区别：SSM 以线性递推实现近线性复杂度的长序列建模，Transformer 是平方复杂度但表达更通用、预训练生态最好。选型上：短窗口+实时优先 TCN，跨模态对齐需求强优先 Transformer。",
    layerPosition: "Temporal Encoder / Cross-modal Fusion——既可做 F/T 历史编码，更主要承担视觉-力觉跨模态融合。",
    recommendationReason:
      "推荐程度：高。当前推荐的融合路线是「异步双流时序编码 + 接触阶段门控 + 非对称交叉注意力」，Transformer（尤其是 cross-attention 形式）是该路线的核心构件；但它属于编码器/融合层，不是恢复控制器。",
    paperGroups: {
      foundation: [
        {
          title: "Attention Is All You Need",
          authors: "A. Vaswani, N. Shazeer, N. Parmar, J. Uszkoreit, L. Jones, A. N. Gomez, Ł. Kaiser, I. Polosukhin",
          year: 2017,
          venue: "NeurIPS 2017",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://papers.nips.cc/paper_files/paper/2017/hash/3f5ee243547dee91fbd053c1c4a845aa-Abstract.html",
          relevanceNote: "Transformer 原始论文，提出完全基于注意力的序列架构，Q/K/V 自注意力的标准出处。",
        },
      ],
      robotics: [
        {
          title: "Visuo-Tactile Transformers for Manipulation",
          authors: "Y. Chen, M. Van der Merwe, A. Sipos, N. Fazeli",
          year: 2023,
          venue: "CoRL 2023 (PMLR 205:2026–2040)",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://proceedings.mlr.press/v205/chen23d.html",
          relevanceNote: "把视觉 Transformer 扩展到视触觉：self/cross-modal attention 构建任务相关的表征，是跨模态注意力在操作中的直接实例。",
        },
        {
          title: "RotateIt: Visuotactile Transformer for Multi-axis In-hand Object Rotation",
          authors: "C. Qi et al.",
          year: 2023,
          venue: "CoRL 2023",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://proceedings.mlr.press/v229/qi23a.html",
          relevanceNote: "视觉+触觉多模态历史输入 transformer 推断隐状态（extrinsics），展示时序跨模态注意力在真实操作中的训练与部署。",
        },
      ],
      closest: [
        {
          title: "Visuo-Tactile Transformers for Manipulation",
          authors: "Y. Chen, M. Van der Merwe, A. Sipos, N. Fazeli",
          year: 2023,
          venue: "CoRL 2023",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://proceedings.mlr.press/v205/chen23d.html",
          relevanceNote: "与课题最近：cross-modal attention 融合视觉与触觉用于操作——注意它面向表征学习而非失败假设可辨识性，差异点应在此。",
        },
      ],
    },
  },

  "ssm": {
    plainExplanation:
      "状态空间模型（SSM）是控制里最经典的描述方式：一个内部状态 x 按线性规律演化（x_{t+1} = A x_t + B u_t），我们只能观测到它的输出 y_t。传统 SSM 就是卡尔曼滤波背后的模型。近年「现代 SSM」（S4、Mamba 等）把这个老框架重新参数化后用于深度学习序列建模：结构化的 A 矩阵让它既能像 RNN 一样递推、也能像 CNN 一样并行训练，处理上万步长序列时计算量近似线性——这正是 Transformer 的短板。",
    robotExample:
      "把 6D F/T 序列喂给一个轻量 SSM：内部状态 x 隐式累积了「力的低频趋势 + 高频振荡」两类信息。与 TCN 需要堆层扩感受野不同，SSM 的递推天然覆盖任意长的历史——如果未来要做长达数分钟装配过程的慢趋势监控（如温度漂移导致的力基线变化），SSM 的长序列优势会显现。",
    inputs: "时间序列输入 u_t（6D F/T 或编码特征）；初始状态 x_0。",
    outputs: "每个时刻的输出 y_t / 隐状态 x_t（作为下游 belief head 的特征）。",
    mathBlocks: [
      {
        title: "线性状态空间模型",
        latex: String.raw`x_{t+1} = A x_t + B u_t, \qquad y_t = C x_t + D u_t`,
        explanation: [
          "x_t：隐状态——对历史信息的压缩记忆。",
          "A：状态转移矩阵——决定记忆如何衰减/累积，现代 SSM 的关键就是对 A 做结构化参数化。",
          "B：输入如何写入记忆；C：记忆如何读出；D：输入直通项。",
          "现代 SSM（S4）要点：A 取特殊结构（低秩+正规），使递推可等价转化为长卷积，训练可并行、推理可递归，长序列复杂度近线性。",
        ],
      },
    ],
    robotWorkflow: [
      "将 F/T（或视觉特征）序列作为输入流。",
      "每周期递推更新隐状态 x_t（O(1) 内存，与历史长度无关）。",
      "取 x_t 或 y_t 作为时序表征。",
      "送入 belief head / 融合模块。",
      "若序列变长，SSM 无需重算整个窗口，适合流式部署。",
    ],
    comparisonNotes:
      "与 TCN 的区别：TCN 感受野有限且固定，SSM 理论上无限记忆、流式推理常数成本；与 Transformer 的区别：注意力是内容寻址（按相关性检索历史），SSM 是状态压缩（历史被固定维度记忆吸收，旧信息不可精确回取）。1–2 秒短窗口场景 SSM 优势不明显，属前瞻性备选。",
    layerPosition: "Force Temporal Encoder 的备选实现——面向超长时序（长任务全程监控）的前瞻选型，第一版非必需。",
    recommendationReason:
      "推荐程度：低到中（前瞻备选）。当前 F/T 窗口 1–2 秒，TCN 已够用；SSM 的价值在长时序与流式部署，作为后续扩展方向记录，避免引入不必要的技术风险。",
    paperGroups: {
      foundation: [
        {
          title: "Efficiently Modeling Long Sequences with Structured State Spaces",
          authors: "A. Gu, K. Goel, C. Ré",
          year: 2022,
          venue: "ICLR 2022 (arXiv:2111.00396)",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://arxiv.org/abs/2111.00396",
          relevanceNote: "S4 论文：结构化状态空间参数化让线性 SSM 高效处理长序列，是现代 SSM 序列建模的奠基工作。",
        },
      ],
      robotics: [],
      closest: [],
    },
  },

  // ── 主动诊断 ──────────────────────────────────────────────────
  "eig": {
    plainExplanation:
      "EIG（期望信息增益）回答一个问题：如果我执行某个探测动作，平均能把我的不确定性消除多少？它把每个候选动作在「所有可能观测」上取期望，度量信念熵的下降。直觉上：一个好探测是那种「无论看到什么结果，我的判断都会明显改变」的动作；如果一个动作不管结果如何都不改变判断，它的 EIG 接近零。注意 EIG 只管信息，不管安全——这是它与 VOI 的本质差别。",
    robotExample:
      "当前信念：Jam 50% / Misalignment 50%。候选探测：a) 微退 2mm 再进——若卡滞，退时轴向力异常持续；若错位，退回后力瞬间释放，两种结果截然不同，熵大幅下降；b) 继续直压——两个假设下力响应几乎一样，熵几乎不降。EIG 排序：a ≫ b。但 EIG 不会告诉你 a 可能让工件滑出夹爪——这是 VOI 的职责。",
    inputs: "当前信念 b_t（各假设概率）；候选动作集；每个动作下的预测观测分布 p(o | a, h)。",
    outputs: "每个动作的期望信息增益标量；用于排序候选探测动作。",
    mathBlocks: [
      {
        title: "KL 形式",
        latex: String.raw`\operatorname{EIG}(a) = \mathbb{E}_{o \sim p(o \mid a)} \left[ D_{\mathrm{KL}}\!\left( p(h \mid o, a) \,\Vert\, p(h) \right) \right]`,
        explanation: [
          "h：待区分的失败假设；p(h)：当前信念。",
          "p(o | a)：执行 a 后观测的预测分布（各假设加权平均）。",
          "p(h | o, a)：观测后的后验；D_KL 度量后验偏离先验的程度。",
          "直觉：平均而言，这个动作的观测会把信念「推动」多远。",
        ],
      },
      {
        title: "熵下降形式（等价，实现常用）",
        latex: String.raw`\operatorname{EIG}(a) = H(b_t) - \mathbb{E}\!\left[ H(b_{t+1}) \mid a \right]`,
        explanation: [
          "H(b_t)：当前信念熵——不确定性总量。",
          "E[H(b_{t+1}) | a]：执行 a 后熵的期望。",
          "差值即期望熵下降，数值上可直接由离散信念计算。",
          "⚠ 只最大化信息，不一定最安全；须进入 NetVOI 框架加风险代价。",
        ],
      },
    ],
    robotWorkflow: [
      "枚举候选探测动作（微退 / 侧推 / 微旋转…）。",
      "对每个 (动作, 假设) 对预测观测分布。",
      "对每个可能观测计算后验与熵，按预测分布取期望。",
      "得到 EIG 排序，作为 NetVOI 的信息收益项。",
    ],
    comparisonNotes:
      "EIG vs VOI：EIG 只算信息量，VOI = 信息带来的决策改善 − 力/损伤/时间代价；信息最大的探测不一定值得执行。EIG vs OED：OED 是设计实验的通用框架族（Fisher 信息、熵判据等），EIG 的熵判据是其中最常用的一种。",
    layerPosition: "Probe-vs-Abstain Decision 的信息收益项——NetVOI 的「决策风险降低」由此估计。",
    recommendationReason:
      "推荐程度：中。作为主动诊断的信息度量必须实现，但独立使用不安全；论文表述中应作为 NetVOI 的组成部分而非独立创新。",
    paperGroups: {
      foundation: [
        {
          title: "On a Measure of the Information Provided by an Experiment",
          authors: "D. V. Lindley",
          year: 1956,
          venue: "The Annals of Mathematical Statistics 27(4):986–1005",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1214/aoms/1177728069",
          relevanceNote: "实验信息量的奠基论文：用 Shannon 熵定义实验提供的信息，EIG 的理论源头。",
        },
      ],
      robotics: [
        {
          title: "Active Tactile Exploration using Shape-Dependent Reinforcement Learning",
          authors: "S. Jiang, L. L. S. Wong",
          year: 2022,
          venue: "IROS 2022",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1109/iros47612.2022.9982266",
          relevanceNote: "形状信念驱动的主动触觉探索：选择使形状信息增益最大的触摸动作。",
        },
      ],
      closest: [
        {
          title: "The Blindfolded Robot: A Bayesian Approach to Planning with Contact Feedback",
          authors: "B. Saund, S. Choudhury, S. Srinivasa, D. Berenson",
          year: 2019,
          venue: "ISRR 2019",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://personalrobotics.cs.washington.edu/publications/saund2019btp.pdf",
          relevanceNote: "接触即信息的信念规划代表作，与「探测动作消解失败假设不确定性」结构最近。",
        },
      ],
    },
  },

  "voi": {
    plainExplanation:
      "VOI（信息价值）在 EIG 之上补上「信息不是免费的」这个事实。一次主动探测可能造成力冲击、二次损伤、时间消耗、任务进度损失。NetVOI 用「决策风险降低」作收益，减去这些代价，回答「这个探测值不值得做」。当所有探测的 NetVOI 都低于阈值时，正确动作是暂缓判断并安全回收——这正是课题中「不知道，但不值得继续探索」状态的数学表达，也是 EIG 永远给不出的答案。",
    robotExample:
      "信念：Jam 60% / Misalignment 40%。候选：侧向微推——能把信念推到 85/15，但要在孔壁施加 3N 横向力，有划伤风险且耗时 2 秒；直接安全回收——信息增益为零但零风险。NetVOI 计算显示微推的决策改善不足以覆盖损伤与时间代价 → 推荐「暂缓 + 安全回收」。EIG 在这里会推荐微推，因为它只看到信息。",
    inputs: "当前信念 b_t；各动作的预期信息增益（决策改善）；力/损伤/时间/进度代价估计。",
    outputs: "每个动作的 NetVOI 标量（启发式估计，页面标注 Heuristic estimate）；超阈值 → 探测，否则 → 暂缓/回收。",
    mathBlocks: [
      {
        title: "NetVOI",
        latex: String.raw`\operatorname{NetVOI}(a) = \underbrace{R(b_t) - \mathbb{E}\!\left[R(b_{t+1}) \mid a\right]}_{\text{决策风险降低}} \;-\; \lambda_f C_f(a) \;-\; \lambda_d C_d(a) \;-\; \lambda_t C_t(a)`,
        explanation: [
          "R(b)：按当前信念行动的期望决策损失——信念越明确越低。",
          "决策风险降低：动作 a 平均让后续决策变好多少（信息的经济价值）。",
          "C_f：力风险（接触冲击）；C_d：损伤风险（工件/夹具二次损伤）；C_t：时间成本。",
          "λ_f、λ_d、λ_t：代价权重，集中配置便于调整。",
          "probe 还可能造成任务进度损失（progress cost），可并入 C_t 或单列。",
          "第一版为启发式评分，必须标注 Heuristic estimate，不冒充真实概率。",
        ],
      },
    ],
    robotWorkflow: [
      "从滤波器取得信念 b_t。",
      "估计各探测动作的决策风险降低（由熵下降映射）与各项代价。",
      "按 NetVOI 公式合成标量。",
      "NetVOI 最大且超阈值 → 执行；否则 → 暂缓判断 / 安全恢复。",
      "执行后更新信念，滚动循环。",
    ],
    comparisonNotes:
      "VOI vs EIG：见 EIG 条目——VOI 是决策度量，EIG 是信息度量。VOI vs POMDP：POMDP 完整建模信息-收益权衡但不可精确求解，NetVOI 是其单步启发式近似。VOI vs Dual Control：对偶控制要求动作同时控制与探索，NetVOI 是该思想在单步决策上的可实施形式。",
    layerPosition: "Probe-vs-Abstain Decision——对应课题 Evidence/Diagnosability Gate 的决策准则核心。",
    recommendationReason:
      "推荐程度：高。课题核心问题不是「如何最大化信息」而是「探测是否值得」，VOI 是唯一把诊断收益与风险/时间/损伤统一在同一框架的准则，是 Probe-vs-Abstain 的理论核心。",
    paperGroups: {
      foundation: [
        {
          title: "Information Value Theory",
          authors: "R. A. Howard",
          year: 1966,
          venue: "IEEE Transactions on Systems Science and Cybernetics 2(1):22–26",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1109/tssc.1966.300074",
          relevanceNote: "信息价值理论奠基论文：仅概率结构不足以刻画不确定性的意义，必须联合经济后果——VOI 区别于 Shannon 熵的立论点。",
        },
      ],
      robotics: [],
      closest: [],
    },
  },

  "optimal-experiment-design": {
    plainExplanation:
      "最优实验设计（OED）是统计学老问题：实验有成本，就要设计「区分度最高」的实验。搬到机器人上：一次探测 = 一次实验。OED 提供一族信息判据 Φ（Fisher 信息、熵下降、行列式准则等）来为候选实验打分，选信息量最大且成本可接受的。它与 EIG 的关系是「族与成员」：EIG 是取熵判据的特例。",
    robotExample:
      "区分 Jam vs Misalignment：候选实验为轴向微进、侧向微推、微旋转。分析响应差异：轴向微进时两假设的力响应差别小；侧向微推时 Misalignment 的力矩方向响应与 Jam 截然不同。Fisher 信息判据选侧向微推——一次探测大概率分开两个假设，同时把力风险控制在限值内。",
    inputs: "假设空间；候选实验（探测动作）集；信息判据 Φ 与 I(a)；成本/安全约束。",
    outputs: "最优实验 a* = argmax Φ(I(a))——即最优探测动作。",
    mathBlocks: [
      {
        title: "一般设计准则",
        latex: String.raw`a^{*} = \arg\max_{a} \; \Phi\!\left( \mathcal{I}(a) \right)`,
        explanation: [
          "I(a)：动作 a 的信息量——Fisher 信息矩阵或熵下降等。",
          "Φ：把信息矩阵压缩为标量（A-最优=迹，D-最优=行列式…）。",
          "当前课题映射：probe = experiment，a = 探测动作，约束 = 力/时间限制。",
          "与 EIG 的关系：熵判据 Φ 即得 EIG；OED 是这一族方法的统称。",
        ],
      },
    ],
    robotWorkflow: [
      "明确待区分假设与候选探测动作。",
      "建立 (动作, 假设) → 预测观测的模型。",
      "选信息判据并求解 argmax（带力/时间约束）。",
      "执行探测，更新信念，滚动重复。",
    ],
    comparisonNotes:
      "OED vs Active Fault Diagnosis：OED 是通用统计框架；AFD 是其在故障诊断的具体化——设计输入信号使故障模式可分离（如 zonotope 分离输入）。机器人接触场景两者合流：probe = 输入设计。OED vs EIG：判据族 vs 单一判据。",
    layerPosition: "Active Diagnosis Planning 的理论框架——「动作条件化可辨识性」主张的理论出处；实现退化为 NetVOI 单步形式。",
    recommendationReason:
      "推荐程度：中（理论框架）。OED/AFD 是课题主张的最近理论脉络，红队与相关工作必引；实现层面 NetVOI 单步启发式即可，不必做完整 OED。",
    paperGroups: {
      foundation: [
        {
          title: "Input Design for Guaranteed Fault Diagnosis Using Zonotopes",
          authors: "J. K. Scott, R. Findeisen, R. D. Braatz, D. M. Raimondo",
          year: 2014,
          venue: "Automatica 50(6):1580–1589",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1016/j.automatica.2014.03.016",
          relevanceNote: "主动故障诊断代表作：设计输入保证故障可分离且对其他目标「最小有害」——与安全约束下主动探测直接对应。",
        },
        {
          title: "A Survey of Active Fault Diagnosis Methods",
          authors: "I. Punčochář, J. Škach, M. Šimandl",
          year: 2018,
          venue: "IFAC-PapersOnLine 51(24):911–918",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1016/j.ifacol.2018.09.726",
          relevanceNote: "AFD 综述：主动诊断方法分类与趋势，是课题理论脉络的地图。",
        },
      ],
      robotics: [],
      closest: [],
    },
  },

  "dual-control": {
    plainExplanation:
      "对偶控制指出：机器人的每个动作既在控制系统（推进任务），也在探索系统（力响应暴露接触状态）。好的动作应该一石二鸟。严格求解「控制+探索」联合最优在理论上极其困难（需要前溯未来信息流），实际系统几乎都用近似——最常见的是在 MPC 代价里加不确定性惩罚项，鼓励顺带学习的动作。它是课题「动作条件化可辨识性」的理论背景，不是可完全照搬的算法。",
    robotExample:
      "插入中信念：Jam 45% / Misalignment 45% / Success 10%。纯任务动作=继续下压；纯探索动作=停下侧推。对偶视角动作=「小步长下压+侧向柔顺」：推进任务同时，每步 Fz 响应都在区分假设——力梯度异常增长指向 Jam，梯度平稳指向 Misalignment。控制与诊断被同一个动作完成。",
    inputs: "带不确定性的系统模型（信念 b_t）；任务目标；不确定性度量（熵/协方差）。",
    outputs: "同时权衡控制效果与不确定性降低的控制序列。",
    mathBlocks: [
      {
        title: "概念性代价（近似表达，非严格形式）",
        latex: String.raw`J = J_{\text{task}} + \lambda\, J_{\text{uncertainty}}`,
        explanation: [
          "J_task：常规任务代价；J_uncertainty：未来不确定性度量（如预测信念熵）。",
          "λ：权衡系数——越大越愿意花控制代价换信息。",
          "⚠ 严格 Dual Control 远比此式复杂（双重效应、前溯信息流）；此式只为建立「动作 = 控制 + 探索」的直觉。",
        ],
      },
    ],
    robotWorkflow: [
      "维护信念与不确定性度量。",
      "规划时前溯候选动作对未来信念的影响。",
      "在代价中显式/隐式奖励降低未来不确定性的动作。",
      "执行一步、观测、更新信念、重复。",
      "工程实现常退化为 belief-space MPC + 不确定性惩罚。",
    ],
    comparisonNotes:
      "Dual Control vs Belief-space MPC：后者在信念上做常规规划，最优动作未必主动降不确定；对偶控制额外要求动作有「探明」作用。POMDP 精确解天然含对偶效应；实际实现对偶控制几乎都以 belief-space MPC 近似。",
    layerPosition: "Active Diagnosis Planning——「动作条件化可辨识性 + Probe/Abstain」的理论背景框架，标注为理论近邻而非首创。",
    recommendationReason:
      "推荐程度：中（理论背景）。为课题主线提供理论合法性（红队必引的经典脉络）；严格求解不可行，作为设计动机而非直接实现。",
    paperGroups: {
      foundation: [
        {
          title: "Dual Effect, Certainty Equivalence, and Separation in Stochastic Control",
          authors: "Y. Bar-Shalom, E. Tse",
          year: 1974,
          venue: "IEEE Transactions on Automatic Control 19(5):494–500",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1109/tac.1974.1100635",
          relevanceNote: "对偶效应的严格定义文献：刻画控制对状态二阶矩（不确定性）的影响，对偶控制理论基石。",
        },
      ],
      robotics: [],
      closest: [],
    },
  },

  "belief-space-mpc": {
    plainExplanation:
      "普通 MPC 规划「状态怎么走」；Belief-space MPC 规划「信念怎么走」。机器人不确定工件是否卡滞时，它规划的不是位置轨迹，而是信念演化轨迹：未来每步信念如何收缩或扩散。这样规划出的动作天然把「下一步能否获得信息」纳入考量——一条让信念永远糊着的轨迹，在代价函数上就是差的。它是把课题「主动诊断、风险恢复、信念更新」三个诉求收束到同一框架的候选架构。",
    robotExample:
      "信念：Jam 55% / Misalignment 45%。规划未来 5 步：方案 A 直插——若真卡滞，第 3 步信念仍近对半，且力超限风险大；方案 B 微退+侧推+再进——第 2 步信念收缩到 85/15，后续恢复选择更准。Belief-space MPC 比较两条信念轨迹的期望损失，自动倾向 B——它顺带完成了主动诊断。",
    inputs: "当前信念 b_t；信念转移模型（动力学+观测联合传播）；任务/风险/不确定性代价；力约束。",
    outputs: "未来 H 步最优控制序列 u*；执行第一步后重规划。",
    mathBlocks: [
      {
        title: "信念作为规划状态",
        latex: String.raw`b_t = p(x_t \mid o_{1:t}), \qquad u^{*} = \arg\min_{u_{t:t+H}} \; \mathbb{E}\!\left[ \sum_{k=t}^{t+H} \ell(b_k, u_k) \right]`,
        explanation: [
          "b_t：信念分布，取代单一 x_t 成为被控对象。",
          "ℓ(b_k, u_k)：信念上的代价——可含任务损失、熵（不确定性）、力风险。",
          "期望对未来观测的随机性取得——观测不可预知。",
          "ℓ 含不确定性项时，规划器自动选择「顺带探明」的动作——对偶控制的近似实现。",
          "规划对象是 belief evolution：信念收缩/扩散的轨迹。",
        ],
      },
    ],
    robotWorkflow: [
      "从贝叶斯滤波取当前信念 b_t。",
      "前推未来 H 步信念轨迹（采样/近似传播）。",
      "在信念轨迹上评估期望代价并优化。",
      "执行第一步，观测，更新信念，滚动重规划。",
    ],
    comparisonNotes:
      "vs 普通 MPC：后者在 x 空间规划，不确定性只是扰动；前者在 b 空间规划，不确定性是被控对象。vs POMDP：POMDP 求全域策略（不可行），此为滚动时域近似。vs Dual Control：带不确定性代价项的 belief-space MPC 即对偶控制的常用近似。",
    layerPosition: "Active Diagnosis + Recovery Planning——课题规划层核心候选，统一探测收益、恢复代价与安全约束。",
    recommendationReason:
      "推荐程度：高（目标架构）。能统一课题三大诉求，是论文方法栈收束点；第一版可先以 NetVOI + MPC 分离实现，再逐步收敛。",
    paperGroups: {
      foundation: [],
      robotics: [
        {
          title: "Belief Representations for Planning with Contact Uncertainty",
          authors: "B. Saund",
          year: 2021,
          venue: "PhD Thesis, University of Washington",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.7302/2890",
          relevanceNote: "接触不确定性下的信念表示与信念空间规划的系统论述（粒子传播+成功概率约束）。",
        },
      ],
      closest: [
        {
          title: "The Blindfolded Robot: A Bayesian Approach to Planning with Contact Feedback",
          authors: "B. Saund, S. Choudhury, S. Srinivasa, D. Berenson",
          year: 2019,
          venue: "ISRR 2019",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://personalrobotics.cs.washington.edu/publications/saund2019btp.pdf",
          relevanceNote: "接触反馈信念规划代表作，与课题最近；聚焦占据/几何信念而非失败假设信念，差异点需明确。",
        },
      ],
    },
  },

  "pomdp": {
    plainExplanation:
      "POMDP 是「在看不见全部事实时做最优决策」的数学标准答案。六元组定义：状态 S（真实接触状态）、动作 A、观测 O（F/T 读数）、转移 T、观测模型 Z、奖励 R。在 POMDP 视角下，「探测」与「推进任务」无需人为区分——最优策略自动权衡每个动作的信息价值与任务价值。代价：精确求解在接触任务完全不可行，只能近似。它是课题决策模块的理论母框架。",
    robotExample:
      "插孔建成 POMDP：S={Success, Misalignment, Jam}，A={推进, 微退, 侧推, 回收}，O={Fz, My, 深度}，R=成功+100/力超限−50/时间−1。最优策略自动呈现「先侧推探测→信念明确→快速推进或回收」的分段结构——不是人工规则，而是期望回报最大化的自然结果。Probe/Abstain 决策即其单步近似。",
    inputs: "六元组 (S, A, O, T, Z, R)；初始信念 b_0。",
    outputs: "信念上的最优策略 π*(b)。",
    mathBlocks: [
      {
        title: "信念更新",
        latex: String.raw`b'(s') = \eta\; Z(o \mid s', a) \sum_{s} T(s' \mid s, a)\, b(s)`,
        explanation: [
          "b(s)：更新前信念；T(s'|s,a)：转移模型（预测步求和）。",
          "Z(o|s',a)：观测模型——新状态 s' 下看到 o 的似然（更新步）。",
          "η：归一化常数。",
          "这正是贝叶斯滤波公式在 POMDP 框架中的表述。",
        ],
      },
    ],
    robotWorkflow: [
      "任务形式化为 (S, A, O, T, Z, R)。",
      "在信念上近似规划（采样/启发式，精确值迭代不可行）。",
      "动作评估天然融合信息价值与任务回报。",
      "执行→观测→信念更新→循环。",
      "实际系统退化为 belief-space MPC 或 NetVOI 单步决策。",
    ],
    comparisonNotes:
      "POMDP vs Belief-space MPC：同一问题的全域最优 vs 滚动时域近似。POMDP vs 阈值规则：阈值规则不看信念结构、不前溯未来，在先验极端时失效；POMDP 视角解释了失效原因。",
    layerPosition: "Probe-vs-Abstain / Active Diagnosis 的理论母框架——理论基础与红队对话对象；实现取近似。",
    recommendationReason:
      "推荐程度：中（理论框架）。为「探测 vs 暂缓」权衡提供严格理论出身，相关工作必引；实现用其单步/滚动近似。",
    paperGroups: {
      foundation: [
        {
          title: "Planning and Acting in Partially Observable Stochastic Domains",
          authors: "L. P. Kaelbling, M. L. Littman, A. R. Cassandra",
          year: 1998,
          venue: "Artificial Intelligence 101(1–2):99–134",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://people.csail.mit.edu/lpk/papers/aij98-pomdp.pdf",
          relevanceNote: "POMDP 经典引文：信念马尔可夫性、belief MDP、值迭代框架，并指出每个动作兼具改变世界与获取信息的双重作用。",
        },
      ],
      robotics: [
        {
          title: "AcTExplore: Active Tactile Exploration of Unknown Objects",
          authors: "A.-H. Shahidzadeh, S. J. Yoo, P. Mantripragada, C. D. Singh, C. Fermüller, Y. Aloimonos",
          year: 2023,
          venue: "arXiv:2310.08745",
          status: "PREPRINT",
          verification: "ABSTRACT_VERIFIED",
          url: "https://arxiv.org/abs/2310.08745",
          relevanceNote: "主动触觉探索形式化为 POMDP 并给出可实现近似策略的近期实例。",
        },
      ],
      closest: [
        {
          title: "The Blindfolded Robot: A Bayesian Approach to Planning with Contact Feedback",
          authors: "B. Saund, S. Choudhury, S. Srinivasa, D. Berenson",
          year: 2019,
          venue: "ISRR 2019",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://personalrobotics.cs.washington.edu/publications/saund2019btp.pdf",
          relevanceNote: "接触感知规划（BTP）代表作：理论+系统结合，与课题最近，需监控其向失败假设方向的延伸。",
        },
      ],
    },
  },

  // ── 恢复优化 ──────────────────────────────────────────────────
  "mpc": {
    plainExplanation:
      "MPC（模型预测控制）的想法很朴素：每次只规划未来一小段路，走一步就重新规划。它用一个动力学模型预测「如果我这么控制，未来会怎样」，在满足所有限制（力上限、速度上限、位置边界）的前提下，找一段未来控制序列让代价最小——然后只执行第一步，下个周期用新观测重算。它的核心价值是显式处理约束：接触操作里「力不许超过 5N」这类硬约束，MPC 可以直接写进优化问题里。",
    robotExample:
      "卡滞恢复：当前状态 = 工件卡在孔中，belief 提示 Jam 70%。MPC 输入：当前状态/belief、接触动力学模型、目标（脱出或继续插入）、约束（Fz ≤ 5N、速度 ≤ 10mm/s）。优化器给出未来 0.5 秒的控制序列，其中第一段是「缓慢轴向回退+微振动」——因为模型预测硬拔会超力。执行第一步后重新感知、重新规划。",
    inputs: "当前状态或 belief；动力学/接触模型；目标（代价函数）；约束（力、力矩、速度、位置）。",
    outputs: "未来一段控制序列 u_{t:t+H}——实际通常只执行第一步，再重新规划（滚动时域）。",
    mathBlocks: [
      {
        title: "滚动时域优化",
        latex: String.raw`\min_{u_{0:H-1}} \; \sum_{k=0}^{H-1} \ell(x_k, u_k) + \ell_f(x_H)`,
        explanation: [
          "x_k：模型预测的未来状态；u_k：待优化的控制序列。",
          "ℓ(x_k, u_k)：每一步的代价（跟踪误差、能量、力…）。",
          "ℓ_f(x_H)：终端代价——保证「规划到头」的状态也是好的。",
          "滚动执行：解出 u₀…u_{H-1} 后只执行 u₀，下周期重解。",
        ],
      },
      {
        title: "动力学与约束",
        latex: String.raw`x_{k+1} = f(x_k, u_k), \qquad x_k \in \mathcal{X}, \;\; u_k \in \mathcal{U}`,
        explanation: [
          "f：动力学模型——预测控制下状态如何演化。",
          "𝒳、𝒰：状态与控制的可行集——接触任务里最重要的是力约束 F ∈ F_max。",
          "约束不是「建议」而是硬边界：优化器不会给出超力的方案。",
          "模型越准，预测越可信；接触动力学不准是 MPC 在接触任务里的主要瓶颈。",
        ],
      },
    ],
    robotWorkflow: [
      "估计当前状态（或从 belief 取期望状态）。",
      "用模型预测未来 H 步。",
      "在约束内优化未来控制序列。",
      "计算轨迹代价，取最优解。",
      "只执行第一步；下一周期重新感知并重规划。",
    ],
    comparisonNotes:
      "MPC vs MPPI：MPC 依赖梯度优化，要求模型可微、问题较光滑；MPPI 用随机采样+加权，无梯度、天然适配非光滑接触动力学，但采样量大、依赖算力。MPC vs Risk-sensitive MPC / DRMPC：标准 MPC 优化期望代价，对「小概率大损失」不敏感；风险敏感版惩罚尾部分布，DRMPC 直接最坏情况优化。",
    layerPosition: "Recovery Optimizer——恢复控制层的默认优化器，接在 belief 更新与 Probe/Abstain 决策之后。",
    recommendationReason:
      "推荐程度：高。恢复阶段需要显式力约束，MPC 是唯一成熟且约束处理干净的框架；作为实现工具引用，但不作为论文创新点（创新在 belief 条件化与风险感知，不在 MPC 本身）。",
    paperGroups: {
      foundation: [
        {
          title: "Constrained Model Predictive Control: Stability and Optimality",
          authors: "D. Q. Mayne, J. B. Rawlings, C. V. Rao, P. O. M. Scokaert",
          year: 2000,
          venue: "Automatica 36(6):789–814",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1016/S0005-1098(99)00214-9",
          relevanceNote: "MPC 理论权威综述：稳定性与最优性的系统梳理，约束 MPC 的标准参考。",
        },
      ],
      robotics: [
        {
          title: "Tactile Tool Manipulation",
          authors: "Y. Shirai, D. K. Jha, A. Raghunathan, D. Hong",
          year: 2023,
          venue: "ICRA 2023",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://merl.com/publications/docs/TR2023-023.pdf",
          relevanceNote: "触觉估计+闭环 MPC 的工具操作：约束 MPC 在多接触约束下的完整实例。",
        },
      ],
      closest: [
        {
          title: "Safe Machine-Learning-supported Model Predictive Force and Motion Control in Robotics",
          authors: "J. Matschek, J. Bethge, R. Findeisen",
          year: 2023,
          venue: "arXiv:2303.04569",
          status: "PREPRINT",
          verification: "ABSTRACT_VERIFIED",
          url: "https://arxiv.org/abs/2303.04569",
          relevanceNote: "力+运动联合 MPC 并以学习模型处理不确定性与安全约束——与「力约束下的恢复控制」最近，但不含失败信念与主动诊断。",
        },
      ],
    },
  },

  "risk-sensitive-mpc": {
    plainExplanation:
      "普通 MPC 优化「平均代价」：一次小概率的严重超力和多次轻微扰动在期望意义下可能等价——但这在接触操作里不可接受。Risk-sensitive MPC 改变优化目标：不只看平均，还惩罚代价分布的尾部——「最坏的那部分情况有多糟」被显式计入。效果是控制器在不确定时自动更保守：宁可慢一点、轻一点，也不给小概率的大力冲击留机会。",
    robotExample:
      "拔出卡滞工件：两种策略期望代价相同。策略 A：80% 概率顺利拔出（代价小），20% 概率力飙到 15N（工件损伤）；策略 B：100% 概率缓慢分段拔出（代价略高但力平稳）。普通 MPC 可能选 A（期望更优），Risk-sensitive MPC 选 B——因为 A 的尾部分布（20% × 15N）被风险项重罚。",
    inputs: "同 MPC（状态/belief、模型、目标、约束），外加风险度量参数（风险厌恶系数或 CVaR 置信水平）。",
    outputs: "同 MPC 的控制序列，但优化目标是风险调整后的代价。",
    mathBlocks: [
      {
        title: "风险敏感代价",
        latex: String.raw`J = \mathbb{E}[C] + \lambda \operatorname{Risk}(C)`,
        explanation: [
          "E[C]：期望代价——普通 MPC 只优化这一项。",
          "Risk(C)：风险度量——常用方差、指数变换（Whittle）或 CVaR（条件风险价值：最坏 α 比例情形的平均代价）。",
          "λ：风险厌恶系数——λ 越大越保守。",
          "直觉：为「小概率大损失」的场景付保险费。",
        ],
      },
    ],
    robotWorkflow: [
      "在标准 MPC 之上选择风险度量（CVaR 或指数变换）。",
      "预测未来代价分布（采样或解析传播）。",
      "优化 E[C] + λ·Risk(C)。",
      "执行第一步，滚动重规划。",
      "λ 可随信念不确定性动态调整：越不确定越保守。",
    ],
    comparisonNotes:
      "vs 标准 MPC：目标从期望变为风险调整期望，代价是平均性能略降、换取尾部安全。vs DRMPC：Risk-sensitive 用统计风险度量（CVaR 仍需分布知识/采样估计），DRMPC 不假设任何分布、在分布集合上做最坏情况优化——更悲观也更保守。",
    layerPosition: "Recovery Optimizer（风险感知变体）——「Risk-aware Recovery」节点的候选实现：把力风险显式计入恢复规划。",
    recommendationReason:
      "推荐程度：高。课题主张 Risk-aware Recovery，需要在恢复优化中体现风险项；CVaR-MPC 或风险敏感代价是比「口头说 risk-aware」扎实得多的实现方式，也是与 Risk-blind baseline 区分的关键。",
    paperGroups: {
      foundation: [
        {
          title: "Risk-Sensitive Linear/Quadratic/Gaussian Control",
          authors: "P. Whittle",
          year: 1981,
          venue: "Advances in Applied Probability 13(4):764–777",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.2307/1426972",
          relevanceNote: "风险敏感控制奠基论文：引入风险厌恶参数的指数代价变换，证明确定性等价与分离定理的修正版本仍然成立。",
        },
      ],
      robotics: [],
      closest: [
        {
          title: "Safe Machine-Learning-supported Model Predictive Force and Motion Control in Robotics",
          authors: "J. Matschek, J. Bethge, R. Findeisen",
          year: 2023,
          venue: "arXiv:2303.04569",
          status: "PREPRINT",
          verification: "ABSTRACT_VERIFIED",
          url: "https://arxiv.org/abs/2303.04569",
          relevanceNote: "力约束下带随机安全保证的 MPC（机会约束收紧）——机器人力控中「风险进入 MPC」的近期实例。",
        },
      ],
    },
  },

  "drmpc": {
    plainExplanation:
      "DRMPC（分布鲁棒 MPC）比 Risk-sensitive 更进一步：它干脆不假设你知道真实的概率分布。传感器噪声、接触模型误差意味着你估计的分布本身就不准。DRMPC 的做法是定义一个「可能分布的集合」（比如以经验分布为中心、半径为 ε 的球），然后在这个集合里找最坏情况的分布，针对它优化。一句话：不做最乐观的假设，也不做无边的悲观，而是在「你确信的范围内」做最坏打算。",
    robotExample:
      "恢复一个未知刚度工件的卡滞：你对 F/T 响应的分布只有少量样本估计。普通 MPC 用点估计——错一点就超力；Risk-sensitive 用估计分布的尾部——但分布本身错了照样失效；DRMPC 考虑「所有与样本一致的分布」中最坏的那个，给出的恢复动作在最坏分布下也不会超力——代价是动作更保守、耗时更长。",
    inputs: "同 MPC；外加不确定性集合 𝒫（分布球/矩约束界定）。",
    outputs: "在最坏分布下仍最优（或近优）的控制序列。",
    mathBlocks: [
      {
        title: "分布鲁棒优化",
        latex: String.raw`\min_{u} \; \sup_{P \in \mathcal{P}} \; \mathbb{E}_{P}\!\left[ C(x, u) \right]`,
        explanation: [
          "𝒫：可能分布的集合——由数据样本 + 不确定半径界定。",
          "sup：在集合内找最坏分布——你的方案必须对这个分布也成立。",
          "min：在「最坏分布」下仍最小化期望代价。",
          "关键直觉：不是假定一个准确概率，而是在一组可能分布中考虑最坏风险。",
        ],
      },
    ],
    robotWorkflow: [
      "从历史数据/模型误差估计构建分布集合 𝒫。",
      "前推未来代价在 𝒫 内的最坏期望。",
      "求解 min-sup 优化（常转化为可解的凸/采样近似）。",
      "执行第一步，滚动重规划；数据更新后 𝒫 收缩、策略变激进。",
    ],
    comparisonNotes:
      "vs Risk-sensitive MPC：Risk-sensitive 假设分布已知、只惩罚尾部；DRMPC 连分布本身的不确定都处理。vs Min-max MPC（Scokaert & Mayne）：min-max 在扰动集合上最坏化（更早的经典），DRMPC 是其概率版——在分布集合上最坏化，通常没有 min-max 那么保守。",
    layerPosition: "Recovery Optimizer（鲁棒变体）——当接触模型/分布高度不确定时的备选；不是默认首选。",
    recommendationReason:
      "推荐程度：低到中。理论上完整，但计算与调参成本高；当前课题优先 Risk-sensitive（CVaR）路线，DRMPC 作为鲁棒性上限的备选与对比方法记录。",
    paperGroups: {
      foundation: [
        {
          title: "Min-max Feedback Model Predictive Control for Constrained Linear Systems",
          authors: "P. O. M. Scokaert, D. Q. Mayne",
          year: 1998,
          venue: "IEEE Transactions on Automatic Control 43(8):1136–1142",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1109/9.704989",
          relevanceNote: "最坏情况（min-max）MPC 经典：在扰动集合上优化最坏性能，是 DRMPC「最坏情况优化」思想的直接前身。",
        },
      ],
      robotics: [],
      closest: [],
    },
  },

  "mppi": {
    plainExplanation:
      "MPPI（模型预测路径积分控制）是 MPC 的「无梯度」版本：不解优化方程，而是随机撒出几百条候选控制序列，各自在模型里推演（rollout）一遍算出代价，然后用「代价越低权重越大」的指数加权平均更新控制序列。好处：不需要可微模型——接触这种不连续、非光滑的动力学（一撞就变、一滑就跳）梯度法容易崩，采样法照常工作。代价：要大量并行 rollout，通常靠 GPU。",
    robotExample:
      "卡滞工件的抖动拔出：接触状态在「卡住/滑动」间跳变，力信号不连续。MPPI 每周期采样 512 条「小抖动+回退」的控制序列，在仿真中各自 rollout：导致力超限的序列代价高、权重低；平稳拔出的序列权重高。加权平均后的下一动作自然趋向「抖动幅度适中、力不超限」的拔出策略。",
    inputs: "当前状态（或仿真初始态）；动力学/仿真模型（不需可微）；代价函数；采样参数（噪声方差、温度 λ、采样数 K）。",
    outputs: "加权更新后的最优控制序列（执行第一步）；每条 rollout 的代价分布。",
    mathBlocks: [
      {
        title: "加权采样更新",
        latex: String.raw`u_t \leftarrow u_t + \frac{\sum_{k} w_k\, \epsilon_{k,t}}{\sum_{k} w_k}, \qquad w_k = \exp\!\left( -\frac{1}{\lambda} S_k \right)`,
        explanation: [
          "ε_{k,t}：第 k 条采样序列在 t 时刻的随机扰动。",
          "S_k：第 k 条 rollout 的轨迹代价（沿未来时域累积）。",
          "w_k：指数权重——代价越低权重越大；λ（温度）控制「好序列」与「差序列」的权重差距。",
          "加权平均：把所有好的扰动按比例叠加到当前序列上——一代代迭代逼近优解。",
          "整个过程就是「rollout → 打分 → 加权更新」的循环，无梯度、无凸性要求。",
        ],
      },
    ],
    robotWorkflow: [
      "读取当前状态/仿真环境快照。",
      "并行采样 K 条控制扰动序列（GPU 上数百条）。",
      "每条序列 rollout 计算轨迹代价。",
      "指数加权平均更新控制序列。",
      "执行第一步，下周期重新采样。",
    ],
    comparisonNotes:
      "MPC vs MPPI：MPC 需可微模型与光滑代价，约束处理干净；MPPI 无梯度、适配非光滑接触，但硬约束只能靠代价惩罚近似（力超限是罚项不是硬边界）。MPPI vs 轨迹优化：两者都面向复杂动力学，轨迹优化收敛于局部优解、可离线精细；MPPI 在线滚动、随时重算。MPPI 不能解决 failure belief 与可辨识性——它只是求解器。",
    layerPosition: "Alternative Recovery Optimizer——非光滑接触下的备选恢复求解器（替代 MPC），不是核心创新。",
    recommendationReason:
      "推荐程度：中（备选求解器）。接触恢复的非光滑性是真实痛点，MPPI 是合理备选；但它是优化求解器，不解决失败信念与主动诊断问题，论文定位必须是 alternative solver 而非创新（Decision Log 已有对应决策）。",
    paperGroups: {
      foundation: [
        {
          title: "Model Predictive Path Integral Control: From Theory to Parallel Computation",
          authors: "G. Williams, A. Aldrich, E. A. Theodorou",
          year: 2017,
          venue: "Journal of Guidance, Control, and Dynamics 40(2):344–357",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.2514/1.G001921",
          relevanceNote: "MPPI 理论奠基：从路径积分控制推导出可并行实现的采样式 MPC，GPU 实时控制的起点。",
        },
      ],
      robotics: [
        {
          title: "Sampling-based Model Predictive Control Leveraging Parallelizable Physics Simulations",
          authors: "C. Pezzato, C. Salmi, E. Trevisan, M. Spahn, J. Alonso-Mora, C. Hernández Corbato",
          year: 2023,
          venue: "arXiv:2307.09105",
          status: "PREPRINT",
          verification: "ABSTRACT_VERIFIED",
          url: "https://arxiv.org/abs/2307.09105",
          relevanceNote: "用 GPU 并行物理仿真直接作为 MPPI 动力学模型，无需显式接触建模即可处理 contact-rich 任务——MPPI 在接触操作中的代表性近期实现。",
        },
      ],
      closest: [],
    },
  },

  "trajectory-optimization": {
    plainExplanation:
      "轨迹优化把「怎么动」变成一个数学优化问题：把整条轨迹（一串状态+控制）作为变量，让动力学、边界条件、路径约束全部成立的前提下最小化代价（时间、能量、力）。与 MPC 的区别：MPC 在线滚动、每步重解短时域；轨迹优化常离线解一条完整轨迹。接触版本的难点在于接触序列本身未知（什么时候碰、在哪里碰）——新一代 contact-implicit 方法让优化器连接触时刻一起决定。",
    robotExample:
      "规划一条「抓起-移动-插入」轨迹：变量是整条轨迹的状态与控制，约束包括动力学、关节限位、末端 Fz ≤ 5N、终止于插入完成位形。求解器（直接配点法）输出全程轨迹，插入段的力约束使它在接近孔口时自动减速、对准。若用 contact-implicit（IDTO），连「何时接触孔口」都由求解器自动决定。",
    inputs: "动力学模型；边界条件（起点/终点）；路径约束（力/力矩/速度限值）；代价（时间/能量/平滑度）。",
    outputs: "完整轨迹的状态与控制序列（离线）或滚动优化的短时域解（在线 MPC 模式）。",
    mathBlocks: [
      {
        title: "直接配点形式（概念）",
        latex: String.raw`\min_{x(\cdot),\, u(\cdot)} \; \int_0^{T} \ell\big(x(t), u(t)\big)\, dt \quad \text{s.t.} \quad \dot{x} = f(x, u), \;\; g(x, u) \le 0`,
        explanation: [
          "x(·), u(·)：整条连续轨迹——被离散成有限个配点后交给 NLP 求解器。",
          "∫ℓ：轨迹积分代价（时间、能量、平滑度…）。",
          "ẋ = f(x,u)：动力学等式约束——每个配点都要满足。",
          "g ≤ 0：路径约束——力上限、避障、关节限位。",
          "接触难点：接触力是不等式+互补条件，contact-implicit 方法用光滑化/正则化让梯度法可用。",
        ],
      },
    ],
    robotWorkflow: [
      "把任务写成优化问题：变量=离散轨迹点，约束=动力学+限位，目标=代价。",
      "选方法：直接配点/多重打靶（离线）或 contact-implicit（接触序列未知时）。",
      "求解 NLP 得到轨迹。",
      "在线执行时配合轨迹跟踪控制，或转成 MPC 滚动模式。",
      "轨迹偏离实测过大时重新规划。",
    ],
    comparisonNotes:
      "vs MPC：轨迹优化解完整轨迹（常离线），MPC 滚动解短时域（在线）；contact-implicit MPC（IDTO）把两者结合——用轨迹优化求解器做在线滚动。vs MPPI：轨迹优化依赖梯度与光滑化，MPPI 无梯度但采样开销大。",
    layerPosition: "Recovery Optimizer（离线/规划层）——复杂恢复动作的离线轨迹设计；在线恢复更常用 MPC/MPPI。",
    recommendationReason:
      "推荐程度：中。适合设计可复用的恢复基元（recovery primitive）离线库；课题在线闭环部分以 MPC 为主，轨迹优化作为恢复基元的生成工具。",
    paperGroups: {
      foundation: [
        {
          title: "An Introduction to Trajectory Optimization: How to Do Your Own Direct Collocation",
          authors: "M. Kelly",
          year: 2017,
          venue: "SIAM Review 59(4):849–904",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://www.matthewpeterkelly.com/research/MatthewKelly_IntroTrajectoryOptimization_SIAM_Review_2017.pdf",
          relevanceNote: "轨迹优化教学经典：直接配点方法的完整入门，含调试与实现细节。",
        },
      ],
      robotics: [
        {
          title: "Inverse Dynamics Trajectory Optimization for Contact-Implicit Model Predictive Control",
          authors: "V. Kurtz, A. Castro, A. Ö. Önol, H. Lin",
          year: 2023,
          venue: "arXiv:2309.01813",
          status: "PREPRINT",
          verification: "ABSTRACT_VERIFIED",
          url: "https://arxiv.org/abs/2309.01813",
          relevanceNote: "contact-implicit 轨迹优化实时化的代表作：20 自由度双臂操作硬件上 100Hz CI-MPC，接触序列自动涌现。",
        },
      ],
      closest: [],
    },
  },

  // ── 交互控制 ──────────────────────────────────────────────────
  "impedance": {
    plainExplanation:
      "阻抗控制不直接规定力，也不单纯规定位置——它规定的是「偏离多少，产生多大恢复力」，即把机器人末端变成一个可调的弹簧-阻尼系统。位置误差被视为「弹簧被压缩的量」，力就是弹簧的恢复力。这样一来，机器人碰上环境时不会死顶硬抗（位置控制）也不会一推就飘（纯力控制），而是表现出设计好的柔顺行为。刚度 K 越大越「硬」，阻尼 D 越大越「稳」。",
    robotExample:
      "插孔对准阶段：设定低刚度（K 小）+ 高阻尼——机器人末端像一个柔软的弹簧，人工推动或接触误差都能被柔顺吸收，工件不会被孔壁顶死；插入完成锁定阶段：切换到高刚度——工件被稳定保持。同一个控制器，只改 K/D 参数就完成两种行为，这正是可变阻抗的意义。",
    inputs: "期望位姿 x_d、期望速度 ẋ_d；实际位姿/速度（来自编码器）；阻抗参数 K（刚度）、D（阻尼）。",
    outputs: "关节/末端控制力矩——使末端表现出目标弹簧-阻尼动态行为。",
    mathBlocks: [
      {
        title: "目标阻抗关系",
        latex: String.raw`F = K(x_d - x) + D(\dot{x}_d - \dot{x})`,
        explanation: [
          "x_d − x：位置偏离——「弹簧被压缩了多少」。",
          "K：刚度矩阵——偏离越大恢复力越大；对角各元素对应各方向的柔顺度。",
          "ẋ_d − ẋ：速度偏离；D：阻尼——耗散能量、防止振荡。",
          "核心直觉：不是规定力，也不是规定位置，而是规定「偏离→力」的映射关系。",
          "物理依据（Hogan）：环境多为导纳（受力才动），机器人应为阻抗（受位移出力），两者物理互补。",
        ],
      },
    ],
    robotWorkflow: [
      "设定任务各方向的目标阻抗（K、D）。",
      "每周期读取实际位姿/速度，计算与期望的偏离。",
      "按阻抗关系计算所需力/力矩。",
      "转换为关节力矩下发。",
      "任务阶段变化时更新 K/D（可变阻抗）。",
    ],
    comparisonNotes:
      "Impedance vs Admittance：方向相反——阻抗控制「测位置、出力」，要求机器人本体有力控能力（力矩可控）；导纳控制「测力、动位置」，可在普通位置控制工业臂上以位置外环实现。刚性环境+力矩可控机器人 → 阻抗；位置控制工业臂+六维力传感器 → 导纳。Hybrid Force/Position 则是把任务空间按方向切成「控力」与「控位」两块分而治之。",
    layerPosition: "Contact Execution——执行层：接触行为的物理呈现，接收上层（belief/恢复决策）的参数与目标指令。",
    recommendationReason:
      "推荐程度：高。可变阻抗/导纳是课题主线的执行层组成部分；实现简单、物理意义清晰，且为「风险感知恢复」提供柔顺兜底。",
    paperGroups: {
      foundation: [
        {
          title: "Impedance Control: An Approach to Manipulation, Part I—Theory",
          authors: "N. Hogan",
          year: 1985,
          venue: "Journal of Dynamic Systems, Measurement, and Control 107(1):1–24",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1115/1.3140702",
          relevanceNote: "阻抗控制奠基论文（三部曲之一）：建立「环境是导纳、机器人应为阻抗」的物理互补论证，交互控制的理论源头。",
        },
      ],
      robotics: [],
      closest: [
        {
          title: "Quasi-Static Assembly of Compliantly Supported Rigid Parts",
          authors: "D. E. Whitney",
          year: 1982,
          venue: "Journal of Dynamic Systems, Measurement, and Control 104(1):65–77",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1115/1.3149634",
          relevanceNote: "柔顺支撑装配的经典分析：解释 RCC 远心柔顺为何能让插孔自动纠偏——阻抗参数选择的理论基础，插孔任务的必引文献。",
        },
      ],
    },
  },

  "admittance": {
    plainExplanation:
      "导纳控制与阻抗方向相反：它测量机器人受到的外力，然后「顺着力」修改位置轨迹——你越推它，它越让开。等效于把机器人变成一个接受力输入、输出运动的「导纳」。它最大的实用优点：内环仍是普通位置控制，因此任何工业机械臂加一个六维力传感器就能实现，不需要改造底层力矩控制。代价是响应速度受位置环带宽限制，适合较慢的接触任务。",
    robotExample:
      "打磨/抛光：操作工直接扶着机器人末端引导走向，力传感器感知操作工施加的力，导纳控制器把力转成末端位移修正——机器人像被「拖着走」的合作者。在装配场景同理：工件与孔口接触产生意外力时，机器人顺着力微调位姿，避免死顶造成卡滞或划伤。",
    inputs: "实测外力 F_ext（来自腕部六维 F/T 传感器）；导纳参数 M_d、D_d、K_d（虚拟质量/阻尼/刚度）。",
    outputs: "位置修正轨迹 x——送入底层位置控制环执行。",
    mathBlocks: [
      {
        title: "目标导纳动力学",
        latex: String.raw`M_d\ddot{x} + D_d\dot{x} + K_d(x - x_d) = F_{\text{ext}}`,
        explanation: [
          "F_ext：测到的外力——输入；x：位置修正——输出。方向与阻抗控制正好相反。",
          "M_d：虚拟质量——决定对外力的响应快慢；D_d：虚拟阻尼——抑制振荡；K_d：虚拟刚度——偏离期望位姿的回弹。",
          "直觉：把机器人伪装成一个「受力会动的弹簧质量块」。",
          "与阻抗的区别：阻抗「测位移出力」，导纳「测力出位移」；物理上互为对偶。",
        ],
      },
    ],
    robotWorkflow: [
      "从腕部 F/T 传感器读取外力（扣除重力/惯性补偿）。",
      "按导纳动力学积分得到位置修正量。",
      "把修正后的目标位置发给底层位置控制器。",
      "参数随任务阶段调整（如接触前高导纳、锁定后低导纳）。",
    ],
    comparisonNotes:
      "vs Impedance：见阻抗条目——测量/输出方向互逆，适用平台不同。vs Hybrid Force/Position：导纳是全方向统一的柔顺映射；Hybrid 按任务坐标系显式切分力控/位控方向。当前课题腕部六维 F/T 是现成传感配置，导纳可直接落地。",
    layerPosition: "Contact Execution——阻抗的替代实现（位置控制平台优先），同样接收上层参数指令。",
    recommendationReason:
      "推荐程度：高（与阻抗二选一或互补）。普通位置控制平台加 F/T 传感器即可实现，工程成本低；论文中与阻抗一起构成 Variable Impedance / Admittance 执行层。",
    paperGroups: {
      foundation: [
        {
          title: "Impedance Control: An Approach to Manipulation, Part I—Theory",
          authors: "N. Hogan",
          year: 1985,
          venue: "Journal of Dynamic Systems, Measurement, and Control 107(1):1–24",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1115/1.3140702",
          relevanceNote: "阻抗/导纳对偶关系的理论出处——Hogan 明确论证了两者作为物理交互因果性的互补地位。",
        },
      ],
      robotics: [
        {
          title: "Robot-Assisted Drilling on Curved Surfaces with Haptic Guidance under Adaptive Admittance Control",
          authors: "A. Madani, P. P. Niaz, B. Guler, Y. Aydın, Ç. Başdoğan",
          year: 2022,
          venue: "IROS 2022",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1109/iros47612.2022.9982000",
          relevanceNote: "6-DoF 自适应导纳控制（阻尼实时调整）在曲面钻孔协作机器人上的完整实验——自适应导纳的代表性机器人应用。",
        },
      ],
      closest: [],
    },
  },

  "hybrid-force-position": {
    plainExplanation:
      "插孔这种任务有个天然结构：沿孔轴方向你想控制力（推多少用多少力，避免顶死），垂直孔轴的方向你想控制位置（对准不能偏）。Hybrid Force/Position 控制就是这个思路的公式化：在任务坐标系里选一个「力控子空间」和「位控子空间」，两个子空间各配一个控制器并行工作。它是 1980 年代装配机器人的核心遗产，今天仍是理解一切接触控制任务分解的起点。",
    robotExample:
      "插孔：任务坐标系下 Z 轴（孔轴）用力控制——维持恒定插入力 3N；X/Y 轴与姿态用位置控制——锁定对准。工件接触孔口倒角时，力控环自动降低推进速度，位控环继续纠偏。两个子空间互不干扰，插入过程平稳推进。",
    inputs: "任务坐标系定义（哪些方向力控、哪些方向位控）；期望力轨迹 f_d 与期望位置轨迹 x_d；实测位姿与 F/T。",
    outputs: "关节控制指令——力控子空间输出力矩、位控子空间输出位置目标，经选择矩阵合成。",
    mathBlocks: [
      {
        title: "选择矩阵分解",
        latex: String.raw`u = S\, u_{\text{pos}} + (I - S)\, u_{\text{force}}`,
        explanation: [
          "S：选择矩阵——把任务空间切成位控子空间与力控子空间（对角 1/0）。",
          "u_pos：位控子空间的控制量（跟踪 x_d）；u_force：力控子空间的控制量（跟踪 f_d）。",
          "I − S：力控方向的选择——两个子空间互补且正交。",
          "直觉：一个任务被拆成「几个方向管力、几个方向管位」，各自独立闭环。",
        ],
      },
    ],
    robotWorkflow: [
      "分析任务，定义约束坐标系与两个子空间。",
      "配置位控环（跟踪位置轨迹）与力控环（跟踪力轨迹）。",
      "每周期用选择矩阵合成两环输出。",
      "接触阶段切换时更新选择矩阵与参考轨迹。",
    ],
    comparisonNotes:
      "vs Impedance：Hybrid 是「显式任务分解、方向各司其职」，阻抗是「全方向统一柔顺映射」；Hybrid 需要准确的约束方向知识（方向错了力环会与位环打架），阻抗对此更鲁棒。vs Admittance：Hybrid 关心任务结构划分，导纳关心平台实现方式——正交的两种设计维度。",
    layerPosition: "Contact Execution——插孔类任务执行层的经典方案；在课题中作为阻抗/导纳的结构化补充。",
    recommendationReason:
      "推荐程度：中。概念对插孔任务非常契合，但对约束方向误差敏感、切换易引入冲击；当前推荐以可变阻抗/导纳为主，Hybrid 作为概念理解与 baseline。",
    paperGroups: {
      foundation: [
        {
          title: "Hybrid Position/Force Control of Manipulators",
          authors: "M. H. Raibert, J. J. Craig",
          year: 1981,
          venue: "Journal of Dynamic Systems, Measurement, and Control 103(2):126–133",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1115/1.3139652",
          relevanceNote: "混合控制原始论文：选择矩阵分解 + 力感手腕实验（含插孔验证），交互控制任务分解的标准出处。",
        },
      ],
      robotics: [],
      closest: [],
    },
  },

  "sliding-mode": {
    plainExplanation:
      "滑模控制（SMC）的核心是一个「面」：在状态空间里设计一个滑模面 s=0，用猛烈的开关控制把状态强行驱到这个面上，之后状态就被「钉」在面上滑动直到目标——无论中途遇到多大的模型误差和外部扰动，只要不超出设计界。这个对扰动的完全不变性使它特别适合接触这种模型永远不准的场景。代价是「开关」会带来抖振（chattering）——控制量高频切换，可能激励机械振动。",
    robotExample:
      "机械臂在未知刚度表面上恒力跟踪：表面刚度参数不准、且有摩擦突变。滑模控制器以「力误差」构造滑模面，开关控制在误差偏离面的瞬间猛烈纠正——力跟踪误差被压在小边界内，表面参数变化完全不影响精度（只要控制器输出饱和限足够）。工程上用边界层法把开关软化以抑制抖振。",
    inputs: "滑模面定义 s（通常=误差+其导数的组合）；状态/误差测量；扰动上界估计；控制增益。",
    outputs: "高频开关型控制量（经边界层软化后为连续控制）。",
    mathBlocks: [
      {
        title: "滑模面与到达条件",
        latex: String.raw`s = \dot{e} + c\, e, \qquad s\,\dot{s} \le -\eta\, |s|`,
        explanation: [
          "e：跟踪误差（如力误差）；c：面斜率——决定误差收敛的动态。",
          "s = 0：滑模面——状态到达后沿面滑动至零。",
          "s·ṡ ≤ −η|s|：到达条件——保证状态无论从哪里出发都被「驱向」滑模面。",
          "一旦在面上（s=0），动力学只剩 s 的动态：扰动不影响误差收敛——这就是不变性。",
          "代价：驱向面的开关控制引起抖振，需边界层/高阶滑模软化。",
        ],
      },
    ],
    robotWorkflow: [
      "定义误差变量与滑模面 s。",
      "按到达条件设计开关控制律（含扰动上界）。",
      "加入边界层（饱和函数替代符号函数）抑制抖振。",
      "每周期计算控制量并下发。",
      "监控 s 的行为判断扰动是否超出设计界。",
    ],
    comparisonNotes:
      "vs Super-Twisting：一阶滑模的抖振来自控制量本身的高频切换；Super-Twisting 把不连续项藏进控制量积分里，控制量连续、抖振大幅减小，且保持对 Lipschitz 扰动的鲁棒性。vs MPC：滑模是反馈设计（鲁棒性强、约束处理弱），MPC 是滚动优化（约束强、模型依赖强）。",
    layerPosition: "Contact Execution 的鲁棒备选——恒力跟踪等子任务；不适合作主控（约束与柔顺需求优先阻抗/导纳）。",
    recommendationReason:
      "推荐程度：低到中。鲁棒性对接触任务有吸引力，但抖振与柔顺控制的目标相悖；作为恒力跟踪子模块或对比方法了解。",
    paperGroups: {
      foundation: [
        {
          title: "Variable Structure Systems with Sliding Modes",
          authors: "V. Utkin",
          year: 1977,
          venue: "IEEE Transactions on Automatic Control 22(2):212–222",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1109/tac.1977.1101446",
          relevanceNote: "滑模控制奠基综述：变结构系统设计与分析的开创性文献，SMC 一切后续工作的引用原点。",
        },
      ],
      robotics: [],
      closest: [],
    },
  },

  "super-twisting": {
    plainExplanation:
      "Super-Twisting 是二阶滑模的代表算法，专治一阶滑模的抖振病。普通滑模靠控制量本身高频开关来驱误差上滑模面；Super-Twisting 把不连续项放进控制量的积分里——输出控制量是连续的，抖振从源头消失，同时保留了滑模家族对扰动的强鲁棒性与有限时间收敛。它常被用作鲁棒观测器/微分器（从带噪声的力信号里提取干净的力变化率）。",
    robotExample:
      "F/T 信号的实时滤波+微分：腕部力传感器噪声大，但卡滞检测需要「力的变化率」。Super-Twisting 观测器从含噪 F_z 信号中有限时间收敛地估计出 dF_z/dt——估计值连续无抖振，比直接差分（噪声放大）或普通滑模微分器（抖振）干净得多。控制侧同理可用于恒力跟踪的平滑鲁棒实现。",
    inputs: "被控/被观测变量及其测量（如 F_z）；扰动界（Lipschitz 常数）；增益 α、β。",
    outputs: "连续控制量（或干净的状态导数估计——作为观测器时）。",
    mathBlocks: [
      {
        title: "Super-Twisting 控制律",
        latex: String.raw`u = -\alpha\, |s|^{1/2}\operatorname{sign}(s) + v, \qquad \dot{v} = -\beta\, \operatorname{sign}(s)`,
        explanation: [
          "s：滑模变量（误差+导数）。",
          "第一项 −α|s|^{1/2}sign(s)：连续的「半幂」项——主要纠偏力。",
          "v 的积分：不连续项 −β·sign(s) 被藏进积分器——控制量 u 本身连续，抖振源头消除。",
          "性质：有限时间收敛到滑模面，对一类 Lipschitz 扰动完全鲁棒。",
          "Moreno & Osorio 给出严格 Lyapunov 证明：收敛时间可估计、稳定性可证。",
        ],
      },
    ],
    robotWorkflow: [
      "定义滑模变量 s（跟踪误差或观测误差）。",
      "按扰动界整定增益 α、β。",
      "实现积分项（注意抗积分漂移）。",
      "输出连续控制量/微分估计值。",
      "验证有限时间收敛与抖振抑制效果。",
    ],
    comparisonNotes:
      "vs Sliding Mode：一阶滑模控制量不连续→抖振；Super-Twisting 控制量连续→抖振小，鲁棒性相当。vs 自适应控制：自适应靠参数估计对付已知结构的不确定性，Super-Twisting 靠不连续积分对付有界扰动——机理不同可结合。",
    layerPosition: "Contact Execution / State Estimation 的鲁棒子模块——力微分估计（观测器）或平滑恒力控制；非课题主控。",
    recommendationReason:
      "推荐程度：低到中。作为 F/T 信号鲁棒微分/滤波的工具有实用价值；作为控制器与柔顺执行层的定位不符，作备选与对比方法。",
    paperGroups: {
      foundation: [
        {
          title: "Strict Lyapunov Functions for the Super-Twisting Algorithm",
          authors: "J. A. Moreno, M. Osorio",
          year: 2012,
          venue: "IEEE Transactions on Automatic Control 57(4):1035–1040",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1109/tac.2012.2186179",
          relevanceNote: "Super-Twisting 的严格 Lyapunov 稳定性证明：有限时间收敛与鲁棒性的理论基础，该算法的权威引文。",
        },
      ],
      robotics: [],
      closest: [],
    },
  },

  // ── 安全 ──────────────────────────────────────────────────────
  "cbf": {
    plainExplanation:
      "CBF（控制障碍函数）回答一个问题：如何保证机器人「永远不会」进入危险状态？它的做法分两步：先用一个函数 h(x) 把安全集合圈出来——h(x) ≥ 0 表示安全（如「力还有余量」「离障碍还有距离」）；然后强制任何控制都满足 ḣ + α(h) ≥ 0——直观意思是「不许让安全余量消耗得太快，越靠近边界收敛越慢」。它以「安全过滤器」的形式落地：正常控制器随便给动作，CBF-QP 在最后一刻做最小修正，只改必要的部分。",
    robotExample:
      "插孔时设定 h(x) = F_max − |F_z|（力余量）。恢复控制器想快速拔出，预测下一步 |F_z| = 4.8N（接近 5N 上限）。CBF-QP 求解「离原控制最近的修正」：把拔出速度降一档，使 ḣ ≥ −α(h) 成立——力余量不被过快消耗。机器人表现为「越接近力上限动作越柔」，无需人工设计减速规则。",
    inputs: "安全函数 h(x)（编码力/距离/速度等安全余量）；名义控制 u_nom（来自上层控制器）；α（类 K 函数，松弛速度）。",
    outputs: "修正后的安全控制 u*——在最小干预意义下最接近 u_nom 且满足安全约束。",
    mathBlocks: [
      {
        title: "安全集合与 CBF 约束",
        latex: String.raw`\mathcal{C} = \{x : h(x) \ge 0\}, \qquad \dot{h}(x, u) + \alpha\big(h(x)\big) \ge 0`,
        explanation: [
          "h(x) ≥ 0：安全集合——如力余量、到障碍的距离。",
          "ḣ(x,u)：h 沿动力学的变化率——控制 u 直接影响它。",
          "α(h)：余量越少允许的消耗越慢（h→0 时 ḣ ≥ 0，绝不越过边界）。",
          "满足该约束 ⇒ 安全集合前向不变：从安全状态出发永远安全。",
        ],
      },
      {
        title: "安全过滤 QP",
        latex: String.raw`u^{*} = \arg\min_{u} \; \|u - u_{\text{nom}}\|^{2} \quad \text{s.t. CBF 约束}`,
        explanation: [
          "u_nom：上层（恢复/规划）给出的名义控制。",
          "目标：在所有安全控制里找「最接近名义控制」的——最小干预原则。",
          "二次规划（QP）形式，毫秒级可解，适合 1kHz 安全环。",
          "这就是 Safety Filter 的 CBF 实现方式。",
        ],
      },
    ],
    robotWorkflow: [
      "定义安全函数 h（力余量、距离余量等）。",
      "上层控制器给出名义控制。",
      "每个控制周期求解 CBF-QP 得到修正控制。",
      "若名义控制本就安全，QP 输出≈名义控制（零干预）。",
      "靠近边界时修正幅度自动增大（渐近保守）。",
    ],
    comparisonNotes:
      "CBF vs Safety Filter：CBF 是一类函数方法，Safety Filter 是「最小修正保安全」的架构概念——CBF-QP 是 Safety Filter 最常用的实现，预测安全滤波器（MPC 版）是另一实现。CBF vs Passivity：CBF 保护指定的安全集合（状态约束），Passivity 保护能量平衡（更根本但性能保守）；两者可叠加。",
    layerPosition: "Safety Layer——最内层安全兜底：不参与决策，只保证执行不越界。",
    recommendationReason:
      "推荐程度：高（分层采纳）。第一层用硬力限（必备），第二层 CBF 型渐近保守约束作为力限的软化升级；CBF 本身是工具，课题创新在「belief 驱动的安全约束设计」，不在 CBF。",
    paperGroups: {
      foundation: [
        {
          title: "Control Barrier Functions: Theory and Applications",
          authors: "A. Ames, S. Coogan, M. Egerstedt, G. Notomista, K. Sreenath, P. Tabuada",
          year: 2019,
          venue: "2019 European Control Conference (ECC)",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://coogan.ece.gatech.edu/papers/pdf/amesecc19.pdf",
          relevanceNote: "CBF 理论权威导论：前向不变性、最小干预 QP 合成与机器人应用概览，安全控制的标准入门引文。",
        },
      ],
      robotics: [],
      closest: [],
    },
  },

  "passivity": {
    plainExplanation:
      "无源性（Passivity）是能量视角的安全观：把机器人和控制器看成一个能量系统，要求「系统不能凭空无限产生能量」——数学上是：外界注入的能量（力×速度的累积）最多被系统储存或耗散，不能凭空造能。满足无源性的系统在接触任何（可能未知的）无源环境时都保证稳定——不需要精确模型。它是交互控制里最根本的稳定性保证，阻抗控制、导纳控制都可以按无源性设计。",
    robotExample:
      "机器人做未知刚度表面的力跟踪：表面参数完全未知。若控制器满足无源性，则无论表面是软是硬、是线性还是非线性，交互都是能量耗散的——不会出现「机器人越推越猛」的共振发散。工程表现：接触瞬间可能有小幅振荡，但能量始终被耗散，振荡必然衰减，不会爆炸。",
    inputs: "系统的功率共轭对（力/速度或力矩/角速度）——即交互端口变量；储能函数设计。",
    outputs: "无源性证书（Lyapunov/储能函数）+ 满足无源性的控制律——理论保证而非具体控制量。",
    mathBlocks: [
      {
        title: "无源性不等式",
        latex: String.raw`\int_0^{T} u^{\top}\, y\, dt \;\ge\; -E_0`,
        explanation: [
          "u、y：交互端口的力与速度（功率共轭变量）。",
          "u^T y：注入系统的瞬时功率。",
          "积分：从 0 到 T 外界注入的总能量。",
          "−E_0：初始储存能量——注入能量最多被系统「吃掉」这么多，不能凭空产出。",
          "含义：系统不能凭空无限产生能量——接触任意无源环境时交互稳定。",
        ],
      },
    ],
    robotWorkflow: [
      "选定交互端口变量（末端力/速度）。",
      "设计控制律使其满足无源性不等式（可用 PBC/能量整形）。",
      "需要主动行为（如设定点跟踪）时引入能量罐供给能量（见 Energy Tank）。",
      "监控能量流确认无源性成立。",
      "与阻抗/导纳控制器组合：柔顺行为 + 无源保证。",
    ],
    comparisonNotes:
      "Passivity vs Energy Tank：无源性是「不能造能」的约束；能量罐是实现它的记账机制——把可控能量放进虚拟储罐，罐空则主动行为停止。Passivity vs CBF：无源约束能量平衡（通用但保守），CBF 约束指定安全集合（灵活可设计）；无源性天然覆盖「未知环境交互稳定」，CBF 需要为每个环境定义 h。",
    layerPosition: "Safety Layer 的理论底座——为执行层（阻抗/导纳）与变刚度行为提供稳定性证书。",
    recommendationReason:
      "推荐程度：中（理论底座）。作为安全层的设计原则采纳（变阻抗行为需无源性论证），实现上通过能量罐机制落地；论文中作为稳定性论证的引用框架。",
    paperGroups: {
      foundation: [
        {
          title: "Impedance Control: An Approach to Manipulation, Part I—Theory",
          authors: "N. Hogan",
          year: 1985,
          venue: "Journal of Dynamic Systems, Measurement, and Control 107(1):1–24",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1115/1.3140702",
          relevanceNote: "交互物理因果性与无源思想的经典论述——阻抗控制三部曲同时是无源交互控制的理论起点。",
        },
      ],
      robotics: [
        {
          title: "An Energy Tank-Based Interactive Control Architecture for Autonomous and Teleoperated Robotic Surgery",
          authors: "F. Ferraguti, N. Preda, A. Manurung, M. Bonfe, O. Lambercy, R. Gassert, R. Muradore, P. Fiorini, C. Secchi",
          year: 2015,
          venue: "IEEE Transactions on Robotics 31(5):1073–1088",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1109/TRO.2015.2455791",
          relevanceNote: "无源+能量罐的完整交互控制架构在手术机器人（针 insertion 场景）上的实现——无源性设计落地为系统的代表作。",
        },
      ],
      closest: [],
    },
  },

  "energy-tank": {
    plainExplanation:
      "能量罐解决一个矛盾：纯无源的控制器很安全但「没劲」——不能主动跟踪轨迹、不能变刚度（改变参数会注入能量）。能量罐的方案是给机器人开一个「虚拟电池」：外界注入的及允许消耗的能量都记在罐里，控制器的主动行为按耗电记账，罐空了主动行为自动停止。这样既保留了无源性的安全保证，又给主动行为分配了一笔「预算」。",
    robotExample:
      "可变阻抗插孔：对准阶段想切到低刚度（参数切换注入能量）。能量罐机制下：切换消耗罐内储存，若罐余量不足，切换被限制或刚度渐变——保证任何时刻交互都是无源的。检测到卡滞需要主动抖动拔出时，同样从罐中「取电」，罐见底则抖动幅度自动受限——不会越抖越猛。",
    inputs: "系统实时能量流（端口功率）；罐初始储量 E_0；各主动行为的耗电计价。",
    outputs: "能量阀门开度 α(t)（0–1 缩放主动行为）+ 无源性证书；罐空时主动行为自动降级。",
    mathBlocks: [
      {
        title: "能量罐动态（概念）",
        latex: String.raw`\dot{E} = -\alpha(t)\, P_{\text{act}} + P_{\text{in}}, \qquad 0 \le E \le E_{\max}`,
        explanation: [
          "E：罐内储存的虚拟能量。",
          "P_act：主动行为功率（变刚度、设定点跟踪、抖动…）——受阀门 α 缩放。",
          "P_in：环境/交互注入的可回收能量。",
          "α(t)：能量阀门——罐快空时 α→0，主动行为渐停，无源性保持。",
          "直觉：给「主动做功」设预算，预算花光就只能被动耗散。",
        ],
      },
    ],
    robotWorkflow: [
      "初始化能量罐储量。",
      "实时统计端口功率流（注入/耗散）。",
      "每个主动行为按功率记账扣减。",
      "罐低于阈值时按比例缩小主动行为幅度。",
      "罐为空时仅保留被动耗散行为——全程无源。",
    ],
    comparisonNotes:
      "vs 纯 Passivity：纯无源约束下主动能力受限；能量罐以「预算制」恢复主动能力而不破坏无源性。vs CBF：CBF 约束状态（力/距离），能量罐约束能量——能量罐保护的是「稳定性资源」本身，是更底层的安全货币。",
    layerPosition: "Safety Layer 的实现机制——支撑可变阻抗/主动恢复行为的能量记账与限幅。",
    recommendationReason:
      "推荐程度：中。变阻抗与主动恢复需要能量预算机制，能量罐是无源性框架下的标准解法；第一版可先用简单限幅，能量记账作为升级项。",
    paperGroups: {
      foundation: [
        {
          title: "An Energy Tank-Based Interactive Control Architecture for Autonomous and Teleoperated Robotic Surgery",
          authors: "F. Ferraguti, N. Preda, A. Manurung, M. Bonfe, O. Lambercy, R. Gassert, R. Muradore, P. Fiorini, C. Secchi",
          year: 2015,
          venue: "IEEE Transactions on Robotics 31(5):1073–1088",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1109/TRO.2015.2455791",
          relevanceNote: "能量罐机制的代表性系统实现：变参数导纳+自主/遥操作切换全程无源，含插入类任务实验。",
        },
      ],
      robotics: [],
      closest: [],
    },
  },

  "safety-filter": {
    plainExplanation:
      "安全过滤器是一个架构概念而非单一算法：在「想做什么」（学习策略、恢复控制器、遥操作）和「实际执行」之间插入一层监督。它拿到上层给的名义控制后判断：照这样执行，未来会不会不安全？会——就以最小干预原则修改它；不会——原样放行。与「直接给控制器加约束」相比，过滤器的优点是上层算法可以完全不管安全（随便怎么设计），安全由独立一层保证。",
    robotExample:
      "学习型恢复策略（RL 训练）给出激进拔出动作。安全过滤器每周期检查：用预测模型前推 0.5 秒，若预测力超限，就修改该动作（最小偏差修正）后执行；若安全则放行。RL 策略负责「聪明」，过滤器负责「不出事」——两者解耦，RL 更新不影响安全证书。",
    inputs: "名义控制 u_nom；系统模型（用于前推验证）；安全集合定义（力限、距离、速度）；可选的备份策略。",
    outputs: "过滤后的控制 u——安全时等于 u_nom，不安全时做最小修改或切换到备份策略。",
    mathBlocks: [
      {
        title: "过滤器决策（两种实现同构）",
        latex: String.raw`u = \begin{cases} u_{\text{nom}}, & \text{前推验证安全} \\[4pt] \arg\min_{u} \|u - u_{\text{nom}}\|^{2} \;\; \text{s.t. 安全约束}, & \text{否则} \end{cases}`,
        explanation: [
          "前推验证：用模型检查名义控制的未来是否留在安全集合内。",
          "安全 → 原样放行（零干预，不拖累上层性能）。",
          "不安全 → 最小修正（QP）或切换到预计算的备份轨迹。",
          "CBF-QP 与预测安全滤波器（MPC 版）是这一决策结构的两种实现——前者逐点约束、后者前推多步。",
        ],
      },
    ],
    robotWorkflow: [
      "上层（学习/恢复控制器）输出名义控制。",
      "过滤器用模型前推验证未来安全性。",
      "安全 → 放行；不安全 → 最小修正或启用备份策略。",
      "记录干预日志（过滤率是安全裕度的诊断信号）。",
      "模型/安全集合更新后过滤器自动适应。",
    ],
    comparisonNotes:
      "vs CBF：CBF-QP 是安全过滤器的一种实现（逐点、瞬时）；预测安全滤波器用 MPC 前推多步、可处理更复杂约束但更贵。vs 硬限幅：硬限幅是事后截断（可能引入抖振与任务失败），过滤器是事前最小干预（平滑修正）。过滤率上升 = 上层策略接近安全边界，本身是有价值的诊断信号。",
    layerPosition: "Safety Layer 的架构级实现——介于恢复决策与执行层之间，课题安全栈的收口。",
    recommendationReason:
      "推荐程度：高（架构）。分层安全栈「力硬限 + 过滤器 + 无源执行」中过滤层承上启下；第一版可用简单前推+限幅实现，CBF-QP 作为升级。",
    paperGroups: {
      foundation: [
        {
          title: "A Predictive Safety Filter for Learning-Based Control of Constrained Nonlinear Dynamical Systems",
          authors: "K. P. Wabersich, M. N. Zeilinger",
          year: 2021,
          venue: "Automatica 129:109597",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1016/j.automatica.2021.109597",
          relevanceNote: "预测安全滤波器的奠基论文：任意学习算法「开箱即安全」的过滤器架构，最小干预+备份轨迹的完整理论。",
        },
        {
          title: "Data-Driven Safety Filters: Hamilton-Jacobi Reachability, Control Barrier Functions, and Predictive Methods for Uncertain Systems",
          authors: "K. P. Wabersich, A. J. Taylor, J. J. Choi, K. Sreenath, C. J. Tomlin, A. D. Ames, M. N. Zeilinger",
          year: 2023,
          venue: "IEEE Control Systems Letters / IEEE Control Systems Magazine",
          status: "PUBLISHED",
          verification: "ABSTRACT_VERIFIED",
          url: "https://doi.org/10.1109/mcs.2023.3291885",
          relevanceNote: "安全过滤器家族综述：HJ 可达性、CBF、预测方法三大路线的统一视角与对比。",
        },
      ],
      robotics: [],
      closest: [],
    },
  },
};
