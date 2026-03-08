# Goal Anchor Assisted Generation Design

**Context**

当前系统已经有 `goalAnchor` 硬门槛，能防止多轮优化为了安全或高分逐步偏题。但第一版 `goalAnchor` 采用本地保守生成，虽然稳定，却不够“专业提炼”。用户已确认希望系统能细化和优化需求，因此初始锚点本身也应更像一次专业需求澄清。

**Goal**

在创建任务时，增加一次“模型辅助 goalAnchor 提炼”，让系统从第一轮开始就拥有更高质量的目标锚点；同时保留失败回退，保证任务创建不会因为这一步失败而不可用。

**Product Rules**

- 创建任务时尝试调用模型生成 `goalAnchor`
- 生成成功：保存模型提炼版
- 生成失败：回退到当前本地保守生成版
- 无论成功或失败，都不阻塞任务创建
- 保存后的 `goalAnchor` 仍允许用户在详情页继续编辑
- 创建完成后，系统不会自动改写该锚点

**Architecture**

复用现有 CPAMC 连接能力，新增一个轻量的 `goalAnchor` 生成调用。为避免引入新的高耦合，这次调用不走 worker，而是在 `createJobs()` 内同步尝试执行。若调用异常、输出不合法或内容为空，则直接使用现有 `deriveGoalAnchor()` 回退。

模型生成输出结构保持现有形态：

```ts
type GoalAnchor = {
  goal: string
  deliverable: string
  driftGuard: string[]
}
```

**Prompting Rules**

生成 `goalAnchor` 的模型提示词必须强调：

- 这是“提炼原任务目标”，不是“改写任务”
- 不得为了安全或规范而泛化任务
- 不得删除关键交付物
- `driftGuard` 要具体说明什么叫偏题

**Failure Strategy**

- 网络失败：回退
- JSON 提取失败：回退
- 输出字段为空：归一化后仍为空则回退
- 任意异常：回退

**Testing**

- 成功路径：模型输出被解析并保存
- 失败路径：异常时回退到 `deriveGoalAnchor()`
- 归一化路径：脏输出仍被清洗
- 回归点：现有任务创建、详情页编辑、optimizer/reviewer 注入都不受破坏

**Non-Goals**

- 不新增独立后台任务
- 不给创建页增加新的表单字段
- 不改动 worker 阶段控制
