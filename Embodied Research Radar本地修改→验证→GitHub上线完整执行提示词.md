你当前已经位于我的本地项目目录：

`embodied-research-radar-v1`

请直接基于**当前本地工作区**检查、修改、测试并发布项目。

GitHub远程仓库为：

`Nicholas-Steven/embodied-research-radar`

本任务不是只给建议，也不是只生成代码片段。

你需要完整执行：

**检查当前本地代码**
→**实施修改**
→**本地测试**
→**检查diff**
→**提交Git**
→**push到GitHub**
→**触发GitHub Actions**
→**检查workflow日志**
→**检查GitHub Pages线上结果**
→**如果发现本次修改引入的问题，继续修复并再次验证**
→**最终汇报**

---

# 一、执行原则

## 1. 当前本地项目是本次工作的修改源

你已经在项目目录中。

不要重新clone仓库。

首先执行并检查：

```bash
git status
git branch --show-current
git remote -v
git log -5 --oneline
```

确认：

- 当前分支
- 当前远程仓库
- 是否存在未提交修改
- 最近提交状态

---

## 2. 不得破坏已有本地修改

如果`git status`发现本任务开始前已经存在用户自己的未提交修改：

**不要覆盖、删除、reset或checkout掉这些修改。**

禁止使用：

```bash
git reset --hard
git clean -fd
```

或其他可能造成用户工作丢失的命令。

如果现有修改与本任务修改发生冲突：

先识别具体冲突，再采取最小风险方案。

---

## 3. 不要修改当前LLM模型

当前模型配置保持现状。

不要修改：

```text
LLM_MODEL
LLM_BASE_URL
LLM_API_KEY
```

尤其不要把当前模型替换成其他DeepSeek、Qwen或OpenAI模型。

本任务只解决：

- arXiv 429稳定性
- AI timeout稳定性
- 无效LLM消费
- 多query标签合并
- 最近加入雷达按日期分组

---

# 二、开始前先检查实际代码

重点阅读：

```text
scripts/update_radar.py
scripts/radar/pipeline.py
scripts/radar/arxiv_fetcher.py
scripts/radar/ai.py
scripts/radar/scoring.py

config/queries.json

web/index.html
web/assets/app.js
web/assets/style.css

.github/workflows/deploy.yml

tests/
```

不要机械按照下面方案修改。

首先确认当前实现是否仍与问题描述一致。

如果代码已经被其他修改解决了一部分：

**不要重复实现。**

---

# 三、任务A：解决arXiv HTTP 429导致运行时间过长

当前曾经出现大量：

```text
arXiv query failed after 3 attempts:
HTTP Error 429
```

并导致：

```text
Fetch, score and enrich radar
```

运行超过1小时。

重点修改：

```text
scripts/radar/arxiv_fetcher.py
```

---

## A1. 429必须专门处理

针对：

```python
urllib.error.HTTPError
```

如果：

```python
exc.code == 429
```

不要再与普通异常完全相同处理。

优先检查：

```text
Retry-After
```

如果服务器返回合法的`Retry-After`：

按照服务器要求等待。

如果不存在：

使用：

```text
exponential backoff + jitter
```

例如：

```text
第一次：15秒左右
第二次：30秒左右
第三次：60秒左右
```

具体实现可以根据项目结构调整。

必须具有：

- 最大重试次数
- 最大等待上限
- 随机jitter
- 不允许无限循环

---

## A2. 区分不同错误

合理区分：

```text
429
408
5xx
timeout
URLError
XML解析失败
400/401/403等明显不可恢复错误
```

对临时网络问题允许重试。

对明显不可恢复的错误不要无意义长时间重试。

---

## A3. arXiv失败不能让整个Radar卡死

目标不是保证每一个query当天都成功。

目标是：

> arXiv临时限流时，可以少抓一部分论文，但整个Radar仍应在合理时间内完成更新。

可根据实现增加：

```text
consecutive 429计数
单query最大重试
整次运行最大限流保护
```

达到一定条件后：

跳过当前query或后续部分抓取，

继续：

```text
已有论文
→评分
→AI
→构建站点
→部署
```

绝不能因为arXiv临时失败删除已有历史论文。

---

## A4. 不要只简单把4秒改成几十秒

`.github/workflows/deploy.yml`目前有类似：

```text
ARXIV_DELAY_SECONDS=4
```

可以合理调整或增加：

```text
ARXIV_BACKOFF_BASE_SECONDS
ARXIV_BACKOFF_MAX_SECONDS
```

但是：

**不要把解决方案简化成“4秒改成30秒”。**

真正需要的是：

```text
正常请求间隔
+
429专用backoff
+
最大失败保护
```

---

# 四、任务B：改变处理顺序，避免对低相关论文调用LLM

重点检查：

```text
scripts/radar/pipeline.py
```

当前曾存在：

```text
deduplicate
↓
score/topics + AI
↓
threshold过滤
```

这意味着：

最终相关度低于45分、会被删除的论文，

也可能已经消耗一次LLM调用。

请改成：

```text
collect
↓
deduplicate
↓
规则评分 + topic识别
↓
threshold过滤
↓
只对保留下来的论文执行AI分析
↓
保存
```

即：

### Phase 1

只执行：

```python
enrich_score_and_topics()
```

### Phase 2

执行：

```text
relevance_score >= threshold
```

### Phase 3

只对通过threshold的论文执行：

```python
generate_analysis()
```

---

# 五、必须保留AI缓存

已有完整AI结果的论文不要重新调用LLM。

类似：

```text
analysis_status == ready
```

并且：

```text
summary_one_sentence != Pending
```

应该直接复用。

最终必须满足：

```text
历史论文 + 已有AI结果
→0次LLM调用

新论文 + score >= threshold
→调用LLM

新论文 + score < threshold
→不调用LLM

历史论文 + Pending
→允许重新尝试
```

不要因为重构pipeline破坏已有AI结果。

---

# 六、任务C：增加LLM临时错误重试

重点修改：

```text
scripts/radar/ai.py
```

目前曾出现：

```text
The read operation timed out
```

后直接：

```text
AI analysis skipped
```

请增加合理重试。

---

## C1. 最多3次请求

例如：

```text
第一次请求
↓
timeout
↓
等待5秒左右
↓
第二次
↓
再次临时错误
↓
等待15秒左右
↓
第三次
↓
仍失败
↓
Pending
```

建议：

```text
exponential backoff + jitter
```

---

## C2. 只重试可能恢复的错误

建议重试：

```text
timeout
URLError
HTTP 408
HTTP 429
HTTP 500
HTTP 502
HTTP 503
HTTP 504
```

原则上不要重试：

```text
HTTP 400
HTTP 401
HTTP 402
HTTP 403
model not found
明显非法请求
```

尤其：

```text
402 Payment Required
```

不应该连续请求3次。

---

## C3. timeout可配置

可以增加：

```text
LLM_TIMEOUT_SECONDS
```

默认保持：

```text
90
```

无需用户手动配置也应可以正常运行。

---

# 七、任务D：同一论文被多个query命中时合并topic

重点检查：

```text
scripts/radar/arxiv_fetcher.py
```

例如同一篇论文：

第一次由：

```text
vision-force
```

命中。

第二次又由：

```text
failure-recovery
```

命中。

最终不应该保存两篇重复论文。

但是应该合并：

```json
"research_topics": [
  "vision-force",
  "failure-recovery"
]
```

而不是只保留第一次query的信息。

要求：

- 按arXiv ID优先去重
- 无arXiv ID时使用现有paper ID/title逻辑
- research_topics合并
- 去重
- 不覆盖已有更完整元数据
- 如当前代码有source query provenance结构，可以合理保留多个来源

---

# 八、任务E：“最近加入雷达”按日期分组

这是本次唯一的明显UI调整。

视觉效果参考：

```text
2026-08-12                                      6篇
──────────────────────────────────────────────────

[Card]       [Card]       [Card]
[Card]       [Card]       [Card]


2026-08-11                                     11篇
──────────────────────────────────────────────────

[Card]       [Card]       [Card]
...
```

重点修改：

```text
web/assets/app.js
web/assets/style.css
```

必要时才修改：

```text
web/index.html
```

---

# 九、日期数据来源

优先使用：

```text
published_date
```

分组。

如果检查schema后发现已经有**真实可靠的首次加入雷达时间字段**：

可以评估是否更适合。

但是：

**禁止伪造加入日期。**

如果没有真实加入时间：

本次直接使用：

```text
published_date
```

---

# 十、日期分组逻辑

当前`renderList()`获得：

```javascript
const papers = getFiltered();
```

之后：

不要再直接：

```javascript
papers.map(renderCard)
```

平铺。

应该：

```text
getFiltered()
↓
按published_date分组
↓
日期降序
↓
每一天生成date group
↓
组内调用现有renderCard()
```

非常重要：

**必须使用筛选后的papers分组。**

例如原本：

```text
2026-08-12  6篇
```

用户筛选后只剩：

```text
2篇
```

必须显示：

```text
2026-08-12  2篇
```

不能仍显示6篇。

---

# 十一、建议DOM结构

可以参考：

```html
<section class="date-group">

  <div class="date-group-header">

    <span class="date-group-title">
      2026-08-12
    </span>

    <div class="date-group-divider"></div>

    <span class="date-group-count">
      6篇
    </span>

  </div>

  <div class="date-paper-grid">

    <!-- current renderCard() output -->

  </div>

</section>
```

不要求逐字照抄。

根据当前DOM采用最小侵入实现。

---

# 十二、不要重写paper card

尽量继续使用现有：

```javascript
renderCard(p)
```

保留：

- title
- authors
- venue
- date
- score
- stars
- AI summary
- tags
- research relationship
- code标记
- 点击进入详情

日期组只是：

**paper card外面增加一层日期组织结构。**

---

# 十三、日期UI样式

保持当前Embodied Research Radar设计语言：

- 科研工具感
- 克制
- 浅灰背景
- 青绿色accent
- 细border
- 小圆角
- mono metadata
- 不使用夸张渐变
- 不重新设计整个页面

建议：

```text
日期：
13–15px
font-weight:600
color:var(--ink)

分隔线：
background/border:var(--line)

数量：
“6篇”
使用轻量pill
background:var(--surface-2)
color:var(--muted)
```

必须优先使用现有CSS变量。

---

# 十四、Dark Mode必须继续正常

不要硬编码：

```text
#fff
#000
```

到新增日期group。

优先使用：

```text
var(--bg)
var(--surface)
var(--surface-2)
var(--ink)
var(--muted)
var(--faint)
var(--line)
```

检查Dark Mode。

---

# 十五、响应式必须正常

保持现有卡片布局逻辑：

```text
Desktop：3列
Tablet：现有规则
Mobile：1列
```

新增：

```text
.date-paper-grid
```

必须适配原来的media queries。

不要出现：

- 横向滚动
- 日期header溢出
- 数量pill错位
- 手机端卡片宽度异常

---

# 十六、不要破坏详情页

当前：

```text
#paper-grid
```

可能同时用于列表和detail。

因此不能简单把整个：

```text
.paper-grid
```

改成日期分组样式。

推荐：

```text
paper-grid
└── date-group
    └── date-paper-grid
        └── paper-card
```

详情页继续使用原来的：

```text
paper-detail
```

布局。

重点测试：

```text
打开paper detail
返回Radar
再次筛选
```

---

# 十七、空状态必须保持正常

筛选结果为0时：

继续显示当前empty state。

不要生成空的：

```text
date-group
```

---

# 十八、不要进行这些无关修改

本次禁止：

- 换LLM模型
- 改研究方向
- 改论文评分权重
- 删除query
- React/Vue重构
- 增加数据库
- 增加后端
- 更换GitHub Pages
- 重做整个UI
- 大面积重写CSS
- 修改无关README内容
- 擅自升级所有依赖
- 删除现有测试
- 修改Secrets
- 输出API Key

---

# 十九、本地测试

修改完成以后，必须首先在本地验证。

至少执行：

```bash
python -m unittest discover -s tests -v
```

然后：

```bash
python -m py_compile scripts/radar/*.py scripts/*.py
```

然后：

```bash
python scripts/build_site.py
```

---

# 二十、增加针对本次修改的测试

尽可能新增单元测试。

禁止测试时真正大量调用：

```text
arXiv API
LLM API
```

使用mock。

至少覆盖：

### Test 1

低于threshold：

```text
score < threshold
```

验证：

```text
generate_analysis()
```

调用次数：

```text
0
```

---

### Test 2

已有ready AI结果：

```text
analysis_status=ready
```

验证：

```text
LLM调用=0
```

---

### Test 3

新高分Pending论文：

```text
score >= threshold
```

验证：

```text
LLM被调用
```

---

### Test 4

arXiv返回：

```text
429
```

验证：

- 会backoff
- 会重试
- 次数有上限
- 不无限循环

测试中mock：

```python
time.sleep
```

不要真的等待几十秒。

---

### Test 5

LLM返回：

```text
HTTP 402
```

验证：

不会无意义重试3次。

---

### Test 6

第一次：

```text
timeout
```

第二次：

```text
success
```

验证最终：

```text
analysis_status=ready
```

---

### Test 7

同一个arXiv ID：

```text
vision-force
+
failure-recovery
```

最终：

```text
只有一个paper
```

同时：

```json
"research_topics": [
  "vision-force",
  "failure-recovery"
]
```

---

# 二十一、本地前端验证

生成：

```text
site/
```

以后检查：

```text
site/assets/data.json
site/index.html
site/assets/app.js
site/assets/style.css
```

如果环境允许启动本地静态服务器：

例如：

```bash
python -m http.server 8000 -d site
```

则验证页面：

```text
首页
最近加入雷达
搜索
topic筛选
year筛选
score筛选
code-only
论文详情
返回列表
Dark Mode
```

重点确认：

```text
最近加入雷达
```

已经显示成：

```text
日期
分割线
当天论文数量
卡片
```

不要因为本地服务器需要人工交互而无限等待。

---

# 二十二、提交前必须检查diff

完成本地验证之后执行：

```bash
git status
git diff
```

如果文件已经stage：

同时检查：

```bash
git diff --cached
```

逐项确认：

- 没有API Key
- 没有Secret
- 没有临时debug输出
- 没有测试垃圾文件
- 没有无关大面积格式化
- 没有无关文件被删除
- 当前模型没有被修改

确认以后再提交。

---

# 二十三、Git提交

只提交本次任务相关文件。

使用清晰commit message，例如：

```text
fix: stabilize radar updates and group papers by date
```

如果本地原来存在用户未提交修改：

不要未经判断把所有内容：

```bash
git add .
```

一次性混进本次commit。

应该明确stage本次真正修改的文件。

---

# 二十四、push GitHub

确认：

```bash
git status
```

干净或符合预期以后：

push到当前项目实际使用的远程分支。

当前项目主要分支如果是：

```text
main
```

则正常：

```bash
git push origin main
```

不要force push。

禁止：

```bash
git push --force
```

---

# 二十五、GitHub Actions线上验证

push以后：

当前仓库的workflow应该自动触发：

```text
Radar update and GitHub Pages deploy
```

不要push后立刻宣布完成。

需要继续观察workflow。

如果环境有GitHub CLI，可以使用：

```bash
gh run list
```

找到刚刚push产生的最新workflow。

然后：

```bash
gh run watch <run-id>
```

或等价方式检查。

如果没有`gh`，使用当前智能体可用的GitHub能力检查workflow。

---

# 二十六、不能只检查绿色Success

即使workflow显示：

```text
Success
```

也必须查看：

```text
Fetch, score and enrich radar
```

日志。

检查是否仍然存在大量：

```text
HTTP Error 429
```

以及：

```text
AI analysis skipped
The read operation timed out
```

重点记录：

```text
Fetch, score and enrich radar运行时间
```

目标不是承诺“永远没有429”。

因为arXiv是外部服务，429无法100%杜绝。

真正目标是：

> 即使429出现，也不能再把整个workflow拖到一小时。

---

# 二十七、判断arXiv修复是否成功

成功标准不是：

```text
0个429
```

而是：

```text
少量429可以接受
+
正确backoff
+
不会无限等待
+
不会清空历史数据
+
workflow能在合理时间完成
```

如果线上仍出现：

```text
几十次连续429
```

或：

```text
运行时间仍接近1小时
```

继续分析本次修改是否有效。

不要直接宣布完成。

---

# 二十八、检查LLM行为

线上日志要确认：

已有AI结果的论文没有被全部重新分析。

检查：

```text
AI analysis skipped
```

是否仅发生在真正的失败项目。

不能出现：

```text
80篇论文每次workflow全部重新调用LLM
```

如果发现：

```text
低相关论文
```

仍然先调用LLM再被threshold删除，

继续修复pipeline。

---

# 二十九、检查GitHub Pages线上UI

workflow部署成功以后：

打开实际GitHub Pages页面。

确认：

**最近加入雷达**

已经按照日期显示。

例如：

```text
2026-08-13                                  X篇
────────────────────────────────────────────

cards


2026-08-12                                  X篇
────────────────────────────────────────────

cards
```

检查：

- 日期降序
- 数量正确
- 三列布局正常
- 筛选后数量动态变化
- 搜索正常
- 点击卡片正常
- 详情页正常
- 返回正常
- Dark Mode正常
- 移动端至少通过代码/CSS检查，没有明显破坏

---

# 三十、如果线上验证发现问题

如果问题明显由本次修改导致：

不要停在：

```text
workflow failed
```

或：

```text
页面有bug
```

应该：

```text
定位
↓
修改本地
↓
重新测试
↓
commit
↓
push
↓
再次观察workflow
↓
再次验证线上
```

直到：

- 本地测试通过
- workflow通过
- 页面正常

或者遇到明确无法继续的外部限制。

---

# 三十一、不要无限修复外部服务

如果问题来自：

```text
arXiv持续限流
SiliconFlow平台故障
GitHub服务异常
```

并且确认不是本次代码造成：

不要无限循环重跑。

记录证据并明确说明：

```text
代码逻辑正常
外部服务当前异常
```

---

# 三十二、最终报告

全部结束以后给我一份结构化报告。

必须包含：

## 1. 修改文件

例如：

```text
scripts/radar/arxiv_fetcher.py
scripts/radar/pipeline.py
scripts/radar/ai.py
web/assets/app.js
web/assets/style.css
tests/...
```

---

## 2. 每个文件具体修改

不要只说：

```text
优化了稳定性
```

要说明实现。

---

## 3. arXiv 429

说明：

### 修改前

什么逻辑。

### 修改后

- Retry-After
- backoff
- jitter
- retries
- fail-safe

分别如何处理。

---

## 4. LLM成本优化

说明最终流程是否已经成为：

```text
score
→threshold
→AI
```

而不是：

```text
score
→AI
→threshold
```

---

## 5. AI重试

说明：

- timeout
- 429
- 5xx
- 402

分别如何处理。

---

## 6. 多query标签

说明同一论文如何合并：

```text
research_topics
```

---

## 7. 日期分组

说明：

- 使用哪个日期字段
- 如何分组
- 如何排序
- 如何计算X篇
- 如何兼容筛选
- 如何兼容Dark Mode和响应式

---

## 8. 本地测试

列出实际执行的命令和结果。

例如：

```text
python -m unittest discover -s tests -v
PASS

python -m py_compile ...
PASS

python scripts/build_site.py
PASS
```

不要编造。

---

## 9. Git信息

告诉我：

```text
branch
commit SHA
commit message
push结果
```

---

## 10. GitHub Actions

告诉我：

```text
workflow run ID
最终状态
总运行时间
Fetch, score and enrich radar运行时间
```

并说明：

```text
429还有多少/是否出现
AI timeout是否出现
```

如果日志不能精确统计，就明确说明观察结果，不要猜数字。

---

## 11. GitHub Pages

确认线上：

```text
日期分组
搜索
筛选
详情
```

是否实际验证成功。

---

## 12. 剩余风险

明确区分：

### 已解决

代码问题。

### 仍不可完全控制

例如：

```text
arXiv外部限流
LLM服务临时timeout
GitHub Actions网络波动
```

不要宣称这些外部问题已经“100%消失”。

---

# 最终目标

本次最终状态应该是：

```text
本地修改
↓
本地测试通过
↓
Git diff确认
↓
commit
↓
push
↓
GitHub Actions自动触发
↓
线上workflow验证
↓
GitHub Pages部署
↓
网页日期分组验证
```

最终Radar数据流程应尽量接近：

```text
读取已有papers.json
↓
arXiv查询
↓
429智能退避
↓
新旧论文合并
↓
去重
↓
合并query topics
↓
规则评分
↓
threshold筛选
↓
低分论文不调用LLM
↓
高分论文
↓
已有AI结果？
├─Yes →直接复用
└─No  →调用LLM
          ↓
       临时错误重试
          ↓
       ready/Pending
↓
保存papers.json
↓
构建站点
↓
部署GitHub Pages
```

前端：

```text
最近加入雷达

2026-08-13                                  X篇
────────────────────────────────────────────
[Card] [Card] [Card]

2026-08-12                                  X篇
────────────────────────────────────────────
[Card] [Card] [Card]
```

**直接开始检查当前本地工作区并执行，不需要重新询问项目路径。**