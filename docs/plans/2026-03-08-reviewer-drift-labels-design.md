# Reviewer Drift Labels Design

**Context**

现在 reviewer 已经把目标忠实度当成硬门槛，但当一轮提示词偏题时，反馈仍然主要是自然语言摘要与建议。用户需要更清晰地知道：这次到底是“改目标了”、还是“丢交付物了”、还是“过度安全化了”。

**Goal**

为 reviewer 增加一组固定的偏题原因标签，并保留简短解释文本，让失败反馈更可操作、更利于人工判断下一步动作。

**Product Rules**

- 使用固定标签 + 简短解释 + 原有自由文本
- 如果未偏题：
  - `driftLabels = []`
  - `driftExplanation = ''`
- 如果偏题：
  - `driftLabels` 至少包含 1 个标签
  - `driftExplanation` 必须解释偏在哪
  - `hasMaterialIssues` 必须为 `true`

**Fixed Labels**

- `goal_changed`
- `deliverable_missing`
- `over_safety_generalization`
- `constraint_loss`
- `focus_shift`

**Output Shape**

```ts
type RoundJudgment = {
  score: number
  hasMaterialIssues: boolean
  summary: string
  driftLabels: string[]
  driftExplanation: string
  findings: string[]
  suggestedChanges: string[]
}
```

**UI**

任务详情页的 reviewer 区块增加：
- 偏题标签 pills
- 一段偏题解释

如果没有偏题标签，则不显示这块。

**Testing**

- 偏题时必须返回标签
- 未偏题时标签为空
- 标签与解释会被持久化并正确展示

**Non-Goals**

- 不在首页展示偏题标签
- 不引入第二个 reviewer
