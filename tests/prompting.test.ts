import assert from 'node:assert/strict'
import test from 'node:test'

import { buildGoalAnchorPrompts, buildJudgePrompts, buildOptimizerPrompts, compactFeedback } from '../src/lib/server/prompting'

test('compactFeedback keeps only unique high-signal items', () => {
  const result = compactFeedback([
    'a'.repeat(40),
    'b'.repeat(40),
    'a'.repeat(40),
    'c'.repeat(40),
    'd'.repeat(40),
    'e'.repeat(40),
    'f'.repeat(40),
    'g'.repeat(40),
    'h'.repeat(40),
  ], { maxItems: 4, maxItemLength: 20 })

  assert.deepEqual(result, [
    'aaaaaaaaaaaaaaaaaaaa...',
    'bbbbbbbbbbbbbbbbbbbb...',
    'cccccccccccccccccccc...',
    'dddddddddddddddddddd...',
  ])
})

test('optimizer prompt includes all pending steering items in stable order', () => {
  const prompts = buildOptimizerPrompts({
    pack: {
      id: 'pack-1',
      hash: 'hash',
      skillMd: 'skill',
      rubricMd: 'rubric',
      templateMd: 'template',
      createdAt: '2026-03-08T00:00:00.000Z',
    },
    currentPrompt: 'draft prompt',
    previousFeedback: ['tighten output schema'],
    pendingSteeringItems: [
      {
        id: 'steer-1',
        text: 'Keep the wording warmer and reduce compliance jargon.',
        createdAt: '2026-03-09T10:00:00.000Z',
      },
      {
        id: 'steer-2',
        text: 'Keep the 老中医 judgment style, but do not change the final deliverable.',
        createdAt: '2026-03-09T10:01:00.000Z',
      },
    ],
    goalAnchor: {
      goal: 'Keep the original triage task.',
      deliverable: 'Return a structured triage decision.',
      driftGuard: ['Do not turn the task into generic safety advice.'],
    },
    threshold: 95,
  })

  assert.match(prompts.user, /1\. Keep the wording warmer and reduce compliance jargon\./)
  assert.match(prompts.user, /2\. Keep the 老中医 judgment style, but do not change the final deliverable\./)
  assert.match(prompts.user, /Keep the original triage task\./)
  assert.match(prompts.user, /High-signal feedback from the previous round:/)
})

test('judge prompt remains isolated from pending steering raw text', () => {
  const prompts = buildJudgePrompts({
    pack: {
      id: 'pack-1',
      hash: 'hash',
      skillMd: 'skill',
      rubricMd: 'rubric',
      templateMd: 'template',
      createdAt: '2026-03-08T00:00:00.000Z',
    },
    candidatePrompt: 'candidate prompt',
    goalAnchor: {
      goal: 'Keep the original triage task.',
      deliverable: 'Return a structured triage decision.',
      driftGuard: ['Do not turn the task into generic safety advice.'],
    },
    threshold: 95,
    judgeIndex: 0,
  })

  assert.match(prompts.system, /Goal fidelity is a hard gate/i)
  assert.match(prompts.system, /goal_changed/i)
  assert.match(prompts.system, /deliverable_missing/i)
  assert.match(prompts.system, /over_safety_generalization/i)
  assert.match(prompts.user, /Return a structured triage decision\./)
  assert.doesNotMatch(prompts.system, /pending steering/i)
  assert.doesNotMatch(prompts.user, /Keep the wording warmer/)
  assert.doesNotMatch(prompts.user, /Keep the 老中医 judgment style/)
})

test('goal anchor generation prompt preserves the task and forbids generic safety drift', () => {
  const prompts = buildGoalAnchorPrompts({
    rawPrompt: '请优化一个医疗分诊提示词，要求输出结构化分诊结论与风险等级。',
  })

  assert.match(prompts.system, /do not rewrite the task into a safer but more generic goal/i)
  assert.match(prompts.system, /goal, deliverable, driftGuard, sourceSummary, rationale/i)
  assert.match(prompts.user, /医疗分诊提示词/)
})
