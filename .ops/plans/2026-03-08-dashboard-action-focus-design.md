# Dashboard Action Focus Design

**Context**

首页已经按“活跃任务 / 排队中 / 最近完成 / 历史任务”分组，但用户还希望进一步收噪：一键切到“只看我现在要处理的”，同时让 `manual_review` 和 `paused` 比 `running` 更显眼。

**Goal**

在首页增加一个轻量快捷切换，让用户可以只看 `manual_review / paused / running` 三类任务，并通过卡片权重进一步强调“需要人工介入”的状态。

**Confirmed Product Decisions**

- 新增快捷切换：`只看我现在要处理的`
- 开启后仅显示：
  - `manual_review`
  - `paused`
  - `running`
- 隐藏：
  - `pending`
  - `recent completed`
  - `history`
- 活跃任务排序：
  - `manual_review`
  - `paused`
  - `running`

**Architecture**

继续保持纯展示层改动，不改接口和后端。把活跃任务优先级排序与快捷切换视图都下沉为纯函数，保证测试可锁定行为。Dashboard 组件只负责：

- 维护一个本地 `actionableOnly` 状态
- 调用纯函数得到排序后的活跃任务与最终可见分组
- 根据状态给卡片加视觉优先级类名

**Presentation**

- 快捷切换放在首页看板区顶部，不抢批量投递区。
- `manual_review` 卡片：最高强调
- `paused` 卡片：次级强调
- `running` 卡片：保持当前强调
- 切换开启时，活跃任务区文案改成“当前仅显示需要你处理的任务”

**Testing**

- 纯函数测试锁定：
  - 活跃任务优先级排序正确
  - 开启 `actionableOnly` 后只保留活跃任务，其它分组清空

**Non-Goals**

- 不增加后端筛选参数
- 不做多标签筛选系统
- 不调整详情页或 worker 逻辑
