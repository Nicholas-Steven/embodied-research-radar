# Embodied Research Radar论文卡片UI终版返工指令

请直接修改当前`Embodied Research Radar`项目中的论文展示页面。

这次不是重新设计整个网站，也不是只给建议，而是**直接修改现有前端代码并完成可运行版本**。

当前页面存在一个非常明显的问题：

> 论文卡片过窄、过高，变成了细长的竖条，一行有效内容太少，与我期望的论文雷达卡片墙差距很大。

请以我此前提供的参考网站/参考截图中的论文卡片布局为主要视觉参考进行返工。

核心原则：

# 桌面端一行3～4张宽卡片，而不是大量细长卡片。

---

# 一、必须修复的核心问题

当前页面类似：

```text
| 窄卡 | 窄卡 |       | 窄卡 | 窄卡 |
|      |      |       |      |      |
|      |      |       |      |      |
|      |      |       |      |      |
```

导致：

- 标题大量换行；
- 一篇论文标题可能占七八行；
- 卡片高度异常；
- 图片呈现得像手机长图；
- 页面横向空间浪费严重；
- 不同日期区域出现大片留白；
- 页面不像科研论文雷达，更像多列窄新闻流。

请改造成：

```text
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│   Paper    │ │   Paper    │ │   Paper    │ │   Paper    │
│   Image    │ │   Image    │ │   Image    │ │   Image    │
│            │ │            │ │            │ │            │
│ Title...   │ │ Title...   │ │ Title...   │ │ Title...   │
│ Summary... │ │ Summary... │ │ Summary... │ │ Summary... │
└────────────┘ └────────────┘ └────────────┘ └────────────┘
```

即：

> **宽卡片+规则网格+紧凑信息。**

---

# 二、桌面端布局要求

论文列表区域必须使用真正的Grid布局。

目标：

## 超宽屏幕

例如：

`≥1500px`

显示：

**4列**

---

## 普通桌面

例如：

`1100px～1499px`

显示：

**3列**

如果实际容器足够宽，也可以4列，但不能压缩卡片宽度。

---

## 平板

例如：

`700px～1099px`

显示：

**2列**

---

## 手机

例如：

`<700px`

显示：

**1列**

---

重点不是机械执行上述具体断点数字，而是必须满足：

> 卡片不能为了塞更多列而被压缩成窄长条。

---

# 三、卡片宽度

建议桌面卡片实际宽度：

**280px～380px**

理想值：

约`300～340px`

不要让正常桌面环境下的论文卡片宽度跌到：

`100～180px`

这种尺寸。

如果使用CSS Grid，可以参考：

```css
grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
```

但不要机械照抄。

如果`auto-fit`导致某些场景布局异常，应直接使用媒体查询：

```css
4 columns
→
3 columns
→
2 columns
→
1 column
```

最终以实际效果为准。

---

# 四、页面内容最大宽度

不要让论文区域无限拉伸，也不要过窄。

建议主内容区域：

```css
max-width: 1500px;
margin: 0 auto;
```

实际可根据现有Sidebar和Header调整。

目标是：

1440p或常见1080p显示器下，页面能够自然展示：

**3～4张宽论文卡片。**

---

# 五、论文卡片整体比例

论文卡片不要再设计成长条。

建议视觉比例接近：

**宽 : 高≈0.65～0.85**

例如：

约：

`320 × 440px`

或：

`340 × 450px`

但不要强行固定到完全相同尺寸。

允许内容存在小幅高度变化。

优先：

**宽、紧凑、信息清晰。**

不要：

**窄、长、标题逐字换行。**

---

# 六、图片区域必须重新设计

当前论文图片区域太窄、太高。

改成统一的横向或近横向缩略图区域。

推荐：

```css
aspect-ratio: 4 / 3;
```

或者：

```css
aspect-ratio: 16 / 10;
```

推荐第一版使用：

**4:3**

图片：

```css
width: 100%;
height: 100%;
object-fit: contain;
```

如果论文Figure本身很长：

不要让Figure撑高整个卡片。

应该：

- 固定图片区域高度；
- `object-fit: contain`；
- 保持完整Figure；
- 背景使用浅色；
- 居中显示。

---

# 七、标题显示

论文标题是卡片核心信息，但不能无限向下延伸。

标题：

**最多3行。**

使用类似：

```css
display: -webkit-box;
-webkit-line-clamp: 3;
-webkit-box-orient: vertical;
overflow: hidden;
```

正常情况下：

2～3行。

超过：

显示省略效果。

完整标题在：

**Paper Detail详情页**

展示。

不要为了显示完整标题破坏论文墙布局。

---

# 八、作者显示

作者只显示：

**1行。**

例如：

```text
Jia Ren, Zhihao...
```

完整作者进入详情页查看。

不要在列表页堆所有作者。

---

# 九、中文摘要

卡片中只显示：

**一句话总结**

或者：

**最多2～3行中文摘要。**

推荐：

```text
提出一种利用RGB-D和六维力觉进行接触状态估计的方法，可用于机器人操作过程中的失败检测。
```

禁止在卡片里展示长段落。

完整：

- 中文摘要
- Method
- Contribution
- Experiments
- Limitations

都放到：

**Paper Detail**

---

# 十、论文卡片信息层级

每张论文卡建议严格按照以下顺序：

## 第一层

论文Figure缩略图

---

## 第二层

元信息：

```text
2026 · arXiv · ★★★★★ 87
```

或者：

```text
2026-08-07    arXiv    87 ★★★★★
```

要求紧凑。

---

## 第三层

论文标题

最多3行。

---

## 第四层

作者

最多1行。

---

## 第五层

一句话中文总结

最多2～3行。

---

## 第六层

标签

最多显示：

**3个**

例如：

```text
Vision-Force
Contact State
Failure Detection
```

如果还有更多：

```text
+3
```

不要把所有标签全部铺开。

---

## 第七层

操作区：

```text
详细分析    论文    PDF
```

有Code：

```text
详细分析    论文    PDF    Code
```

按钮紧凑。

---

# 十一、不要把深度研究信息全部塞进卡片

以下内容原则上不要完整显示在列表卡：

- Core Contribution
- Method Summary
- Experimental Setup
- Key Results
- Limitations
- Why Relevant
- Recommended Reading
- Reproduction Value
- Literature Category解释
- 完整中文摘要
- 完整作者
- 所有Method标签

这些应该进入：

# Paper Detail

列表页主要负责：

> 快速浏览→判断是否值得点进去。

---

# 十二、日期分组布局

当前页面日期分组存在严重的大块横向空白。

例如：

某天只有1～2篇论文时，后面大片空间空着；

下一个日期又重新开始一组。

这会严重破坏论文墙的连续性。

请重新检查日期分组结构。

建议：

日期作为一条横跨整个Grid的Section Header：

```text
2026-08-07                                          2篇
────────────────────────────────────────────────────────
[Paper] [Paper]
```

下一日期：

```text
2026-08-06                                          3篇
────────────────────────────────────────────────────────
[Paper] [Paper] [Paper]
```

而不是让多个日期Group横向并排。

即：

# 日期纵向排列

每个日期下面：

# 论文横向Grid排列

这是非常重要的结构要求。

---

# 十三、明确禁止当前这种结构

不要出现类似：

```text
2026-08-07       2026-08-06       2026-08-04
[卡] [卡]       [卡] [卡]       [卡]
```

这会导致：

- 每个日期占独立列；
- 日期区域被压缩；
- 卡片被迫变窄；
- 页面产生大量留白。

正确方式：

```text
2026-08-07
[卡] [卡] [卡] [卡]

2026-08-06
[卡] [卡] [卡]

2026-08-04
[卡] [卡] [卡] [卡]
```

---

# 十四、卡片高度统一策略

不要求所有卡片像素级完全一样。

但同一行应尽量整齐。

建议使用：

```css
display: flex;
flex-direction: column;
```

卡片内部：

图片固定区域；

文本区使用固定Clamp；

按钮：

```css
margin-top: auto;
```

让按钮统一靠近卡片底部。

这样同一行卡片的Footer能够基本对齐。

---

# 十五、评分显示

目前类似：

```text
81 ★★★★☆
```

可以保留。

但是面积要小。

不要让评分单独占很大空间。

建议放在：

日期/Venue元信息行右侧。

例如：

```text
arXiv · 2026                         87 ★★★★★
```

---

# 十六、标签视觉

Research Tags应使用小型Chip。

例如：

```text
Vision-Force
6D F/T
Contact
```

限制：

最多3个。

颜色不要过多。

整个网站的Accent Color控制在：

1～2种主色。

不要每个Tag使用随机颜色。

---

# 十七、视觉风格

目标：

# 学术科研工具

而不是：

- 商业Landing Page
- 企业官网
- 数据大屏
- 科幻控制台
- 花哨卡片网站
- Pinterest瀑布流

关键词：

**简洁**

**学术**

**克制**

**高信息密度**

**易扫读**

**适合每天使用**

---

# 十八、卡片Hover

允许轻微：

```text
阴影增强
边框变化
上移1～2px
```

禁止：

```text
强烈缩放
3D旋转
大面积发光
复杂动画
```

科研网站不需要视觉炫技。

---

# 十九、卡片边框

推荐：

轻微圆角。

例如：

```css
border-radius: 10px;
```

或者：

`8～12px`

浅边框。

轻微阴影。

不要大圆角。

不要像手机App。

---

# 二十、信息密度

卡片内部上下Padding不要过大。

建议：

`12～18px`

元素间距：

`6～12px`

目标是：

一屏能够看到较多论文；

同时每张论文仍然容易阅读。

---

# 二十一、Vision-Force页面

Vision-Force Fusion页面必须使用同样的宽卡片Grid。

不要首页一种Card；

Vision-Force页面另一种Card。

应该复用：

`PaperCard`

组件。

---

# 二十二、Core Papers页面

Core Papers也使用同一基础Paper Card。

但可以额外增加：

```text
CORE
```

或：

```text
必读
```

Badge。

不要重新造一套布局。

---

# 二十三、Search页面

Search结果继续使用同一套Paper Card。

即：

Home

Vision-Force

Search

Core Papers

都共享：

# PaperCard Component

保证设计一致。

---

# 二十四、响应式设计

至少测试：

### Desktop

1920×1080

1440×900

1366×768

---

### Tablet

1024×768

---

### Mobile

390×844

---

尤其检查：

# 1366×768

这是常见笔记本尺寸。

必须确保：

论文卡片不会重新变成细长条。

---

# 二十五、建议桌面目标

对于常见：

`1366px`

屏幕：

正文区域至少能够舒服地显示：

**3张论文卡片。**

对于：

`1920px`

屏幕：

显示：

**4张**

不要无脑显示5～6张导致卡片重新变窄。

---

# 二十六、Sidebar影响

如果当前网站存在Sidebar：

请计算真实内容区域。

例如：

屏幕：

`1440px`

Sidebar：

`220px`

内容区域实际只有：

约`1200px`

此时：

3列很可能比4列更合理。

不要简单根据整个Viewport宽度决定列数。

---

# 二十七、参考CSS思想

可以参考：

```css
.paper-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

@media (max-width: 1500px) {
  .paper-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1000px) {
  .paper-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .paper-grid {
    grid-template-columns: 1fr;
  }
}
```

注意：

这只是思路。

请根据当前项目Sidebar和Container真实宽度进行调整。

---

# 二十八、PaperCard建议结构

可以类似：

```text
PaperCard

├── Figure
│
├── Meta
│   ├── Date/Venue
│   └── Score
│
├── Title
│
├── Authors
│
├── Summary
│
├── Tags
│
└── Actions
```

---

# 二十九、图片不是必须填满

论文Figure通常比例差异巨大。

因此：

不要：

```css
object-fit: cover
```

把科研图裁掉。

推荐：

```css
object-fit: contain
```

Figure区域可以使用：

浅灰/浅白背景。

---

# 三十、图片加载失败

如果论文没有Figure：

显示统一Placeholder：

```text
Embodied
Research
Radar
```

或者简洁论文图标。

不要显示Broken Image。

---

# 三十一、日期标题样式

日期Section建议：

左：

```text
2026-08-07
```

右：

```text
2篇
```

中间可以有浅色Divider。

日期不要设计成单独大卡片。

---

# 三十二、优先级

本轮不要继续增加新功能。

优先级严格如下：

## P0

修复Grid布局。

## P0

修复日期Section结构。

## P0

修复Card宽度。

## P0

修复Figure比例。

## P0

限制标题/摘要行数。

## P1

统一Card高度。

## P1

按钮与标签。

## P2

Hover和细节美化。

不要在主要布局还错误时：

去做动画、图表、Dashboard等。

---

# 三十三、验收标准

完成以后必须满足：

### 1

1920px桌面：

一行约4张论文卡。

### 2

1366～1440px桌面：

一行约3张论文卡。

### 3

卡片明显比当前版本宽。

### 4

论文标题不再逐词向下堆叠。

### 5

标题最多3行。

### 6

摘要最多2～3行。

### 7

Figure不再把Card拉成长条。

### 8

不同日期按照纵向Section排列。

### 9

页面中不再出现因为日期横向分组造成的大面积空白。

### 10

Home、Vision-Force、Search、Core Papers尽量复用同一个PaperCard组件。

### 11

移动端正常显示。

### 12

production build通过。

---

# 三十四、必须实际检查页面

完成代码修改以后：

请实际启动项目。

然后至少检查：

- 首页；
- Vision-Force Fusion；
- Search；
- Core Papers。

如果有浏览器预览、截图或视觉检查能力：

请实际检查。

不能仅凭：

“CSS理论上应该正常”

就宣布完成。

---

# 三十五、必须修复发现的问题

如果实际预览后发现：

- 仍然过窄；
- 标题仍然过长；
- 图片过高；
- Grid数量异常；
- 日期出现大片空白；
- 卡片高度失控；
- 手机端横向溢出；

继续修改。

直到达到要求。

---

# 三十六、不要破坏已有功能

本轮是UI返工。

请保留：

- 论文数据；
- Search；
- Filter；
- Paper Detail；
- Vision-Force分类；
- Relevance Score；
- AI分析；
- GitHub Actions；
- 数据管线。

不要为了改UI把已有功能删掉。

---

# 三十七、最终效果关键词

最终页面应该让我第一眼看到：

> 这是一个规整的论文卡片墙。

而不是：

> 这是几十条细长的信息柱。

理想视觉：

```text
2026-08-07                                         4篇
──────────────────────────────────────────────────────

┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Figure  │ │ Figure  │ │ Figure  │ │ Figure  │
│         │ │         │ │         │ │         │
│ Title   │ │ Title   │ │ Title   │ │ Title   │
│ Author  │ │ Author  │ │ Author  │ │ Author  │
│ 摘要    │ │ 摘要    │ │ 摘要    │ │ 摘要    │
│ Tags    │ │ Tags    │ │ Tags    │ │ Tags    │
│ Actions │ │ Actions │ │ Actions │ │ Actions │
└─────────┘ └─────────┘ └─────────┘ └─────────┘


2026-08-06                                         3篇
──────────────────────────────────────────────────────

┌─────────┐ ┌─────────┐ ┌─────────┐
│ Paper   │ │ Paper   │ │ Paper   │
└─────────┘ └─────────┘ └─────────┘
```

---

# 三十八、不要机械复制参考站

参考站只是提供：

**卡片墙布局和浏览体验参考。**

`Embodied Research Radar`仍然需要保留自己的功能：

- Relevance Score
- Research Topic
- My Research
- Core Paper
- Vision-Force分类
- AI科研分析

因此：

**复制布局逻辑，不复制整个网站。**

---

# 三十九、本轮不要修改研究方向架构

继续保持：

Embodied Research Radar

作为总平台。

当前重点分支：

Vision-Force Fusion。

其他预留：

- Failure Understanding
- Failure Recovery
- VLA & Manipulation
- Generative Policy
- Research Map

不要因为UI返工改变整个产品结构。

---

# 四十、最终汇报

完成以后只需要告诉我：

1.修改了哪些组件；
2.Grid现在桌面/平板/手机分别几列；
3.PaperCard最终宽度策略；
4.Figure最终比例；
5.标题和摘要分别限制几行；
6.是否解决日期区域大片留白；
7.测试了哪些Viewport；
8.`npm run build`或对应production build是否通过；
9.给出最终页面截图或预览结果。

不要再给我一篇长篇UI设计建议。

**我要的是实际修改后的项目。**