# Dashboard Card Actions Design

**Context**

首页已经能按优先级聚焦待处理任务，但用户仍需要频繁进入详情页才能完成两类高频动作：

- 复制最新完整提示词
- 推进 `manual_review / paused` 任务继续运行

**Goal**

让首页卡片直接承担两类高频操作：

- 复制最新完整提示词
- 对 `manual_review / paused` 任务执行“继续一轮 / 恢复自动运行”

同时保持首页简洁，不把人工引导输入框直接搬到首页。

**Confirmed Product Decisions**

- 首页卡片显示“最新完整提示词摘要”
- 提供 `复制最新提示词`
- `manual_review` 与 `paused` 都提供：
  - `继续一轮`
  - `恢复自动运行`
  - `打开详情并编辑引导`
- `running` 卡片保持只读，不加推进按钮
- 人工引导输入仍留在详情页

**Architecture**

继续保持展示层主导，不重构后端。首页卡片需要两类新数据：

- 最新完整提示词正文：可直接从 `/api/jobs/:id` 拿到，但首页列表接口目前没有 candidate 内容
- 最新完整提示词摘要：最好由首页列表接口直接提供，避免每张卡再额外请求

因此本轮最稳的做法是：

- 为 `listJobs()` 增加轻量字段 `latestPrompt`
  - 优先取该任务最新 candidate 的 `optimized_prompt`
  - 否则回退 `raw_prompt`
- 前端卡片对 `latestPrompt` 做摘要展示
- 复制按钮直接复制 `latestPrompt`
- 快捷动作复用现有 `/resume-step` 与 `/resume-auto`

**Presentation**

- 卡片新增“最新提示词摘要”区域，只显示 2-3 行
- 卡片按钮区根据状态渲染：
  - `manual_review / paused`: 完整快捷动作
  - 其他状态：仅保留进入详情
- “打开详情并编辑引导”跳到任务详情页并定位到人工引导区

**Testing**

- 纯函数测试：
  - 最新提示词摘要优先取最新 candidate，否则回退 raw prompt
- 控制逻辑测试：
  - `manual_review / paused` 显示快捷动作
  - 其它状态不显示推进按钮

**Non-Goals**

- 不在首页直接编辑人工引导
- 不在首页显示完整长提示词全文
- 不修改 worker 状态机
