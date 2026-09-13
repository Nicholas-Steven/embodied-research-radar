# V2 验收修复记录（Acceptance Fix）

> 日期：2026-09-13 · 范围：P0 实验设计器空白修复 + Workspace 中文化收尾
> 未 push、未 deploy，等待人工验收。

---

## 一、P0：实验设计器页面空白

### 现象

`?view=workspace` → 实验设计器：Tab 高亮正常、面包屑正常，主体区域完全空白，直接进入 footer。

### 定位过程（非猜测）

新增 `tests/ws_diagnose.mjs`：用 DOM-stub 真实执行 workspace.js 的全部 11 个视图渲染。
结果：`experiments` 视图抛出异常，其余视图正常（其余报错为测试桩缺口，浏览器中不存在）。

### 根因

**`ReferenceError: experimentBaselines is not defined`。**
中文化阶段重写 workspace.js 顶部 import 块时，从 `v2-data.js` 的导入清单中遗漏了
`experimentBaselines`（该变量在视图内 `experimentBaselines.map(...)` 处使用）。
异常发生在 `body.innerHTML` 赋值之前，`#ws-body` 保持空白 —— 与"Tab 正常但主体空白"现象完全一致。

### 为什么之前测试没有发现

- 上一阶段的 V2 logic harness（`v2_logic_harness.mjs`）只测试**纯逻辑函数**
  （collision score / risk mapping / NetVOI），从不执行视图渲染；
- `tests/test_frontend_layout.py` 只覆盖 V1 页面骨架，不覆盖 workspace 视图内容；
- 本地冒烟测试只检查 HTTP 200 与静态资源存在，不执行 JS 渲染。
- 结论：**缺少"视图真实渲染"层测试** —— 本轮已补上（见下）。

### 修改内容

1. `web/assets/v2/workspace.js` import 块补回 `experimentBaselines`（根因修复）；
2. 视图内数据访问加安全默认值：`researchClaims ?? []`、`expStore.list() ?? []`；
3. 研究主张为空时显示 Empty State（"暂无研究主张…"+「使用默认研究主张」按钮），禁止白屏；
4. 顺便修复同函数中一处隐患：实验矩阵的 baseline 映射曾按英文名反查，现直接显示数据值。

## 二、实验设计器内容恢复（P0 验收标准）

- 页面标题「实验设计器」+ 指定说明文案；
- **研究主张**区块：5 条默认主张，中文为主（Claim 1–5，与指令一致）；
- **对比基线**：14 项全部中文显示（仅视觉 / 仅力觉（F/T Only）/ 视觉 + 力觉 / … / 本文方法），可勾选启用/禁用；
- **实验矩阵 E1–E5**：按指令表格结构（实验 / 对比基线 / 核心变量 / 主要指标 / 验证主张），附实验目的卡；
- **评价指标**：6 类全中文（感知 / 不确定性 / 诊断 / 恢复 / 安全 / 效果）；
- **导出 Markdown**：含当前研究主张、已选基线、E1–E5 矩阵、实验目的、评价指标，正文中文为主。

## 三、新增测试

`tests/ws_render_harness.mjs`（node，执行真实 workspace.js + DOM stub）：

| 测试 | 断言 |
|---|---|
| T1 | 页面出现标题「实验设计器」 |
| T2 | 出现「研究主张」区块 |
| T3 | 出现 E1–E5 |
| T4 | 出现「导出 Markdown」按钮 |
| T5 | researchClaims 为空时不白屏，显示 Empty State + 使用默认研究主张按钮 |
| 附加 | 基线 14 项、指标中文名渲染 |

经 `tests/test_v2_ui.py`（Python unittest 调度）接入回归。

## 四、中文化收尾范围（P1）

| 页面 | 修改 |
|---|---|
| 我的研究主线 | 传感器/失败假设/后续扩展改用中文显示字段（RGB / RGB-D + 腕部 6D F/T；成功…未知失败；开放集失败…VLA）；后续扩展状态「后续扩展」「可选 / 后续融合」；节点保持中文主标题 + 英文副标题 |
| 撞题雷达 | 删除用户可见的 collisionConfig 字样；页面说明改为六维度表述；英文标签仅作副标签 |
| 创新性红队审查 | 证据充分性主张改为「证据充分性作为独立理论创新（Evidence Sufficiency）」；已有理论经概念映射以中文名显示 |
| 失败假设实验室 | 矩阵证据全部中文（插入深度增加 / 视觉上可能存在歧义 / 轴向力持续偏高 / 六维力/力矩回落至基线 等）；预期阶段改「接触阶段/插入阶段/完成阶段」；机器人平台「6 自由度机械臂 + 腕部 6D F/T 传感器」；任务阶段「接近 → 接触 → 插入 → 完成」；localStorage 措辞改为「编辑结果自动保存在当前浏览器中」（决策日志同步） |
| 视觉力觉融合架构 | 推荐管线全中文六步；配置卡 label/value 全中文（视觉编码器/冻结 ViT / DINO 系列 等） |
| 方法角色图谱 | 说明全中文（算法名保留英文缩写，属允许项） |
| 硕士博士研究扩展 | 「失败信念中保留未知失败通道」等措辞修正 |
| 研究决策日志 | 两条默认决策全中文（证据充分性不再作为独立理论创新；候选核心创新 → 操作性诊断决策变量；非光滑接触场景下的备选优化求解器） |

## 五、术语红线检查

全源码扫描确认不存在：碰撞雷达 / 信仰 / 弃权 / 探针 / 故障假说
（abstention 概念别名字典中发现一处「弃权」，已改为「暂缓判断」）。

## 六、修改文件清单

- `web/assets/v2/workspace.js`（import 根因修复 + experiments 视图重写 + 各页文案）
- `web/assets/v2/v2-data.js`（claims titleZh、defaultExperiments E1–E5、labTasks/labHypotheses 中文、recommendedArchitecture 中文管线/配置卡、defaultDecisions 中文、状态标签中文）
- `web/assets/style.css`（无本轮改动）
- `tests/ws_diagnose.mjs`（诊断工具，保留）、`tests/ws_render_harness.mjs` + `tests/test_v2_ui.py`（新增测试）
- `docs/RESEARCH_METHOD_SEMANTICS.md`（上一阶段已更新为中文为主，本轮复核含全部 13 个术语）
- `docs/V2_ACCEPTANCE_FIX.md`（本文件）

## 七、剩余未翻译项（均为允许保留）

论文原始标题 / 作者 / venue / DOI / URL；标准算法缩写（MPC、MPPI、CBF、POMDP、VOI、EIG、F/T、VLA、TCN、IMM）；术语英文括号（如「主动故障诊断（Active Fault Diagnosis, AFD）」）；内部 enum / JSON key / 路由 key / 代码变量；敌意审稿人 Prompt 模板原文（英文，供未来 LLM 使用）。

## 八、已知问题

1. localStorage 中旧版默认数据（若用户已在浏览器中打开过旧版）会覆盖新默认值——需清一次站点数据或点「使用默认研究主张」；
2. ws_diagnose.mjs 为诊断工具，不属于正式测试链（正式测试为 ws_render_harness.mjs）；
3. 移动端 390×844 的视觉效果仍需人工过一遍。
