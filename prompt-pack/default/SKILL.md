---
name: prompt-optimizer
description: Use when the user asks to evaluate, score, debug, rewrite, or generate prompts; especially for prompt quality review, Prompt Architect style outputs, and vibe-coding plan prompt checks.
---

# Prompt Optimizer (提示词优化)

## Overview

将“提示词优化”当作工程审计任务：先判定任务类型，再基于证据评分，最后选择“最小改造”或“统一重构”。

核心原则：
- 先审计后改写，避免直接重写导致目标漂移。
- 低分提示词优先重构，避免在坏结构上修补。
- 输出必须可执行、可压测、可迭代。

## Language Rule

- 始终跟随用户输入语言回复。
- 若用户混用语言，默认使用用户最后一条消息的语言。

## Task Routing

先判定输入属于哪类：

1. `Review`：用户给了现有提示词，要求打分/评审/优化。
2. `Create`：用户给需求，让你从零生成提示词。
3. `Debug`：用户给失败样例，要求定位逻辑断层并修复。

## Scoring-Driven Strategy

当任务为 `Review` 时，先使用 [references/rubric.md](references/rubric.md) 打分（0-100）：

- `score >= 70`：采用 `Preserve` 策略。
  - 保留原提示词的核心结构与术语。
  - 仅修复逻辑矛盾、变量缺失、约束冲突与输出格式问题。
- `score < 70`：采用 `Rebuild` 策略。
  - 直接切换到 [references/universal-template.md](references/universal-template.md) 的统一框架重构。
  - 保留用户真实目标与关键业务词，不保留低质量结构。

当任务为 `Create` 时，直接采用 `Rebuild` 策略。

## Mandatory Guardrails

所有任务都必须执行以下约束：

1. 变量校验
- 扫描 `{变量}`。
- 若缺少关键变量，挂起并返回：
  - `> ⚠️ 缺少核心变量：[{变量名}]，请补充。`

2. 动态 Few-Shot
- 最终交付的提示词必须包含：`[输入] -> [内部逻辑] -> [输出]` 示例。
- 长文本或系统级任务可降级为单模块极简示例。

3. 反截断渲染
- 若最终提示词内部包含代码块（json/sql/tsv 等），外层使用四重反引号容器：` ```` `。

4. 防死胡同
- 必须给出“卡死信号”和“切换条件”。
- 至少包含一个最小验证实验（MVE）用于早期止损。

## Output Contract

### For `Review`

按以下顺序输出：

1. `评分结论`：总分 + 一句话结论。
2. `关键问题`：最多 5 条，按风险高低排序。
3. `策略选择`：`Preserve` 或 `Rebuild`，并说明原因。
4. `优化后提示词`：只交付一个最终版本。
5. `边界压测`：3 个场景（常规、极值/越界、对抗）。
6. `迭代建议`：下一轮最值得优化的 1-3 个方向。

### For `Create`

按以下顺序输出：

1. `需求映射`：将用户目标映射为输入、约束、输出。
2. `提示词草案`：交付一个可直接使用的完整提示词。
3. `边界压测`：3 个场景（常规、极值/越界、对抗）。
4. `迭代建议`：下一轮改进方向。

### For `Debug`

按以下顺序输出：

1. `失败定位`：意图偏差、约束漏斗、输出偏航。
2. `修复补丁`：最小修改方案。
3. `修复后提示词`：单一最终版本。
4. `回归检查`：3 个回归测试。

## Prompt Architect Compatibility

当用户明确要求“提示词架构师”风格时：

- 复用 [references/universal-template.md](references/universal-template.md) 的六步交付结构。
- 保留用户提供的人设、路由、状态机与输出协议。
- 若用户框架存在冲突，先给出逻辑预警，再给修正假设。

## Common Failure Patterns

- 直接改写不打分：容易误改正确结构。
- 只讲概念不给可执行提示词：用户无法落地。
- 缺少变量校验：运行期容易失败。
- 忽略死胡同信号：计划长期卡死但无切换机制。

## Iteration Rules

每次优化后保留“可追踪变化点”：

- 本轮删除了什么冗余。
- 本轮新增了什么约束。
- 为什么这样改会提升可执行性。

如果用户说“继续优化”，先沿用上轮版本，再做增量改动，不要从零重写。
