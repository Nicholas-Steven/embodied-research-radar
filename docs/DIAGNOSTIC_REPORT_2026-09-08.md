# Radar Update 链路诊断报告

> **诊断日期:** 2026-09-08
> **诊断范围:** 2026-09-04 ~ 2026-09-08
> **生产站点:** https://nicholas-steven.github.io/embodied-research-radar/

---

## 十二、最终诊断报告（17 项）

### 1. 9/4~9/8 Update Radar 每天是否运行？

**是。** 5 次 scheduled run 全部按时启动，另外有 1 次 manual dispatch。

| 日期 | 时间 (UTC) | 触发方式 | Run ID |
|---|---|---|---|
| 2026-09-04 | 08:21 | schedule | 33853036499 |
| 2026-09-05 | 07:57 | schedule | 33953933835 |
| 2026-09-06 | 08:14 | schedule | 34021320358 |
| 2026-09-07 | 03:10 | workflow_dispatch | 34078762575 |
| 2026-09-07 | 08:47 | schedule | 34102466767 |
| 2026-09-08 | (今日，尚未到04:00 UTC) | — | — |

### 2. 每次 workflow 状态

**全部 success。** 无失败。

### 3. 每天 arXiv retrieved 数量

| 日期 | candidate_count | retained_count | 说明 |
|---|---|---|---|
| 9/4 | 173 | 160 | 正常（从 155 增至 160） |
| 9/5 | 173 | 160 | 无新论文 |
| 9/6 | 173 | 160 | 无新论文 |
| 9/7 (manual) | **178** | **167** | **发现 7 篇新论文！** |
| 9/7 (scheduled) | **179** | **167** | **发现 7 篇新论文！** |

### 4. 每天新增数量

- 9/4: +5 篇（从 155 → 160）
- 9/5: +0（173 candidate 同前，无新通过阈值）
- 9/6: +0（同上）
- 9/7: **+7 篇**（160 → 167）— 包括 TacPAC、LIBERO-RECOVER、RoboSPA 等

### 5. 当前 papers 总数

- **远程（GitHub）:** 167 篇（截至 9/7 scheduled run commit f1d2f4e）
- **本地:** 160 篇（本地落后于远程，网络问题无法 fetch）

### 6. 当前最大 paper published date

- **本地数据库:** 2026-09-03（4 篇）
- **远程数据库:** 2026-09-04（7 篇新增，包括 TacPAC、LIBERO-RECOVER 等）
- **arXiv 当前最新匹配论文:** 2026-09-04

### 7. 最近 5 篇新增论文的 published date

远程 9/7 push 中新增的 7 篇（均为 2026-09-04 发布）：

| arXiv ID | score | published | 标题 |
|---|---|---|---|
| 2609.05266 | 71 | 2026-09-04 | TacPAC: Tactile Prediction and Real-Time Action Correction |
| 2609.04759 | 65 | 2026-09-04 | Dressing in Motion: Diffusion Policy for Robot-Assisted Dressing |
| 2609.05369 | 60 | 2026-09-04 | Neuro-Symbolic Procedural Reasoning for VLA |
| 2609.05324 | 55 | 2026-09-04 | RoboSPA: VLA Beyond Simple Scenes |
| 2609.05178 | 55 | 2026-09-04 | LIBERO-RECOVER: Failure Recovery in Robotic Manipulation |
| 2609.04893 | 50 | 2026-09-04 | Latent Semantic Scaffolding for Robotic Manipulation |
| 2609.05376 | 45 | 2026-09-04 | Conditional Visual Grounding for VLA Models |

### 8. 最近一次成功 Radar 检查时间

- **远程:** 2026-09-07 08:47 UTC（scheduled run，成功，179/167）
- **本地:** 2026-09-07（前次会话 rebuild，160 篇本地版本）

### 9. update_radar 目前查询几天的窗口

**无日期窗口。** 代码设计为：
- `sortBy=submittedDate, sortOrder=descending`
- `max_results=5`（每个查询取最近 5 篇）
- 21 个查询 × 5 = 最多 105 篇 fetched
- 与已有论文去重后 = candidate_count
- 依赖"已有论文始终保留 + 新论文累加"机制

**没有 `date_from` / `date_to` / `timedelta` 限制。**

### 10. 是否存在单日查询漏洞？

**存在，但不是主因。** 查询窗口设计本身没有单日限制（它取 top-N 而非日期范围）。但 `max_results=5` 意味着如果某天 arXiv 有 >5 篇新论文匹配同一查询，超出部分会被遗漏。

**主因不在此**——9/7 的 run 确实找到了 7 篇新论文并保留了它们。

### 11. 根因判定：属于 A/B/C/D/E 哪一种？

## 根因：E — 数据已更新，但前端未重建

### 完整因果链：

```
update-radar.yml (每天运行 ✅)
    ↓ 成功获取论文 ✅
    ↓ 成功评分筛选 ✅
    ↓ 成功 commit + push papers.json ✅
    ↓ 使用 GITHUB_TOKEN push
    ↓
    ✘ deploy.yml 未被触发 ← 根因在此！
    ↓
    站点未重建
    ↓
    用户看到旧数据（停留在 9/3 的部署版本）
```

**核心问题：** GitHub Actions 的安全机制——使用 `GITHUB_TOKEN`（默认令牌）推送的 commit **不会**触发其他 workflow。这是 GitHub 的设计行为，用于防止无限循环。

**证据：**

| update-radar push 时间 | push 的 commit | deploy 是否触发？ |
|---|---|---|
| 9/4 08:27 UTC | c624ee5 | ❌ 未触发 |
| 9/5 08:04 UTC | 6e2f699 | ❌ 未触发 |
| 9/6 08:20 UTC | db90c30 | ❌ 未触发 |
| 9/7 08:52 UTC | f1d2f4e | ❌ 未触发 |

最后一次 deploy 由 push 触发：**2026-09-04 08:50 UTC**（由人工 merge commit af5877a 触发，非 bot push）。

此后所有 deploy 均为 `workflow_dispatch`（手动触发），且时间在 update-radar push 之前（03:08 UTC vs 08:47 UTC），因此部署的仍是旧数据。

### 12. 是否需要修改代码？

**是。** 需要修改 `.github/workflows/update-radar.yml`，在数据 push 之后显式触发 deploy workflow。

### 13. 如果修改，修改了什么？

**尚未修改**（诊断阶段，遵守"不直接修改代码"指令）。

建议修复方案（二选一）：

**方案 A（推荐）：** 在 update-radar.yml 的 push 步骤之后，添加 workflow_dispatch 触发：
```yaml
- name: Trigger deploy
  uses: peter-evans/repository-dispatch@v3
  with:
    event-type: deploy
```
同时在 deploy.yml 中添加 `repository_dispatch` 触发器。

**方案 B（更简单）：** 将 update-radar.yml 的 `git push` 改为使用 PAT（Personal Access Token）而非 GITHUB_TOKEN。PAT push 可以触发其他 workflow。需要在 repo secrets 中添加 PAT 并在 push step 中使用。

### 14. 原 160 篇是否 160/160 保留？

**是。** 远程 papers.json 中原有 160 篇全部保留。9/7 的 run 在此基础上新增 7 篇，达到 167 篇。`remote_paper_ids ⊆ final_paper_ids` 条件满足。

### 15. 测试结果

- 本地 dry-run（实时 arXiv 查询）确认：7 篇新论文真实存在，评分 45-71，全部通过 45 阈值
- 所有 workflow 测试（unittest + py_compile）全部通过
- deploy.yml 本身功能正常（手动触发可成功部署）

### 16. 最终是否 push？

**诊断报告本身未 push**（遵守"不直接修改代码"指令）。

远程状态：papers.json 已有 167 篇（commit f1d2f4e），但站点未重建。
本地状态：papers.json 有 160 篇（落后远程），且有未 push 的本地 commit 2aa20dd（站点重建）。

### 17. 网站是否真正存在故障，还是 arXiv 数据源暂时没有新批次？

**网站存在真实故障。** 不是 arXiv 数据源的问题。

- arXiv 数据源：正常，有新论文 ✅
- Update Radar pipeline：正常，已抓取并保留新论文 ✅
- Deploy pipeline：**断裂** ❌ — bot push 不触发 deploy，站点停留在 9/4 的部署版本

---

## 修复建议

### 立即修复（恢复站点更新）

1. 在 GitHub 上手动触发 deploy.yml workflow_dispatch，使站点立即重建（会使用远程已有的 167 篇数据）
2. 或在本地 `git pull origin main` 拉取远程 167 篇数据，然后 `git push`（人工 push 会触发 deploy）

### 长期修复（防止再次断裂）

在 `update-radar.yml` 的 push 步骤之后，添加显式 deploy 触发。两种方案：

**方案 A — repository_dispatch（推荐）：**
- 在 update-radar.yml push 成功后添加 `peter-evans/repository-dispatch@v3`
- 在 deploy.yml 添加 `repository_dispatch` 触发器
- 优点：不依赖 PAT，安全且明确

**方案 B — 改用 PAT push：**
- 创建 fine-grained PAT（contents: write 权限）
- 存为 repo secret
- 在 update-radar.yml 的 push step 使用该 PAT
- 优点：最简单，一行改动
- 缺点：需要管理 PAT 生命周期

### 可选改进

1. **滚动窗口查询：** 将 `max_results` 从 5 提升到 10-15，或实现7天日期窗口查询，防止单次遗漏
2. **UI 增加"最近检查时间"：** 让用户区分"系统没运行"和"系统运行了但无新论文"
3. **Deploy 验证步骤：** 在 update-radar.yml push 后检查 deploy 是否成功触发

---

## 附录：关键数据

### arXiv API dry-run 结果（2026-09-08 实测）

- 总查询：21 个（7 组 × 每组 2-4 个查询）
- 获取候选：86 篇（去重后）
- 已有论文：160 篇
- 新论文（不在 DB）：19 篇
- 通过阈值（≥45）：**7 篇**
- 最高分：TacPAC（71 分）
- 所有 7 篇 published_date 均为 2026-09-04

### deploy.yml 触发历史

| 时间 (UTC) | 触发方式 | 关联 commit | 状态 |
|---|---|---|---|
| 9/3 08:19 | schedule | — | success |
| 9/4 03:04 | push | feat: add update-radar.yml | success |
| 9/4 07:35 | push | — | success |
| 9/4 08:50 | push | af5877a (人工 merge) | success |
| 9/7 03:07 | workflow_dispatch | — | success |
| 9/7 03:08 | workflow_dispatch | — | success |
| 9/7 03:08 | workflow_dispatch | — | cancelled |
| 9/7 03:10 | workflow_dispatch | — | success |

**注意：9/4 08:50 之后无任何 push-triggered deploy。**
