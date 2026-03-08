# Goal Anchor Explanation Design

**Context**

`goalAnchor` 现在已经成为防漂移硬门槛，但用户仍然需要快速判断：“系统这次提炼的核心目标到底对不对？” 如果锚点提炼错了，reviewer 的强约束只会把一个错误理解执行得更稳定。

**Goal**

在任务详情页新增一张轻量的“提炼解释卡”，把系统如何从原始输入理解出当前 `goalAnchor` 讲清楚，帮助用户更快判断并修正锚点。

**Product Rules**

- 解释层不参与优化控制，只用于帮助用户理解
- `goalAnchor` 仍然是控制层硬约束
- `GoalAnchorExplanation` 跟随任务创建时一并生成
- 若模型辅助生成失败，则 explanation 也要有本地回退版本
- 用户如果编辑 `goalAnchor`，解释卡仍展示“系统最初是怎么理解的”，不自动改写

**Shape**

```ts
type GoalAnchorExplanation = {
  sourceSummary: string
  rationale: string[]
}
```

- `sourceSummary`: 系统从原始 prompt 抓出的核心任务摘要
- `rationale`: 2-4 条“为什么这样提炼”的简短理由

**UI**

在详情页 `核心目标锚点` 区块下方新增一张 `提炼解释` 卡：

- 原始任务摘要
- 系统理解理由

要求：

- 默认直接可见
- 信息短、可扫读
- 不和 `goalAnchor` 编辑区抢主次

**Generation Strategy**

- 创建任务时，如果模型辅助生成 `goalAnchor` 成功，同时生成 explanation
- 如果失败，则本地回退：
  - `sourceSummary` 取原始 prompt 高密度摘要
  - `rationale` 用保守规则生成

**Non-Goals**

- 不让 explanation 参与 optimizer/reviewer 打分
- 不额外增加新的模型阶段
- 不在首页展示 explanation
