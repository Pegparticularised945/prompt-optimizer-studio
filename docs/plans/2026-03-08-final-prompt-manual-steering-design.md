# Final Prompt And Manual Steering Design

**Context**

当前详情页仍偏工程调试视角：用户首先看到的是轮次、修改摘要与 patch，而不是可直接复制使用的完整提示词。同时，虽然已经支持暂停/继续一轮/恢复自动运行，但还不支持用户在运行中或暂停时加入“人工引导”，让下一轮沿着指定方向优化。

**Goal**

把任务详情页改成“交付最终完整提示词优先”的产品形态，并支持用户在运行中写入一次性的下一轮人工引导。该引导只作用于下一轮 optimizer，不直接拼入提示词正文；之后的影响通过下一轮生成的完整提示词自然传递。

**Confirmed Product Decisions**

- 详情页顶部固定显示“当前最新完整提示词”，支持一键复制。
- 如果已有候选稿，顶部显示最新一轮的 `optimizedPrompt`；否则回退到任务 `rawPrompt`。
- 人工引导可在运行中编辑并保存到下一轮，也可在暂停时编辑。
- 人工引导只作为“下一轮优化指令”输入给 optimizer。
- reviewer 不得看到人工引导，也不得看到历史聚合问题。
- optimizer 继续只接收：
  - 当前完整提示词
  - 上一轮精简 patch
  - 下一轮一次性人工引导

**Architecture**

后端在任务表增加一次性引导字段，并由 worker 在每轮开始时读取。为避免“运行中编辑的新引导被上一轮结束时误清空”，引导字段同时保存更新时间；worker 只在“当前数据库里的更新时间仍等于本轮消费时的更新时间”时清空该字段。这样可以保证：

- 本轮真正消费过的引导只生效一次
- 若用户在本轮进行中再次编辑，下一个版本不会被误删

前端方面，详情页在摘要区下方新增“当前最新完整提示词”卡片和“人工引导”输入区。现有轮次卡片保留，但降级为辅助诊断信息，不再承担主交付角色。

**Data Flow**

1. 用户在详情页输入人工引导并点击“保存到下一轮”。
2. 前端通过 `PATCH /api/jobs/:id` 保存 `nextRoundInstruction`。
3. worker 下一轮开始时读取任务：
   - 当前完整提示词
   - 上一轮精简 patch
   - `nextRoundInstruction`
4. optimizer prompt 构造时加入 `User steering for next round` 段落。
5. 该轮结束后，worker 依据 `next_round_instruction_updated_at` 条件性清空已消费引导。
6. reviewer 仍仅接收当前候选完整提示词与评分规则。

**Error Handling**

- 若人工引导为空，则视为清空，不传给 optimizer。
- 若任务完成或已取消，则仍允许查看顶部完整提示词，但不允许继续写入引导。
- 若用户在运行中保存人工引导，页面提示“将在下一轮生效”。
- 若用户在暂停中保存人工引导，页面提示“已保存，等待继续运行时生效”。

**Testing**

- `tests/prompting.test.ts`
  - optimizer prompt 会带上一次性人工引导
  - judge prompt 不会带上人工引导
- `tests/task-controls.test.ts`
  - 任务可保存/清空 `nextRoundInstruction`
  - worker 消费后清空一次性引导
  - 若运行中用户再次改写引导，新值不会被误清空
- `tests/presentation.test.ts`
  - 最新完整提示词优先取最新 candidate，否则回退 raw prompt

**Non-Goals**

- 不改回多 judge 并行
- 不暴露 provider 路径
- 不把人工引导直接写进最终提示词正文
- 不重构无关 worker/详情页结构
