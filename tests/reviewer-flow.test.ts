import assert from 'node:assert/strict'
import test from 'node:test'

import {
  nextPassStreak,
  shouldFinalizeAfterReview,
  summarizeJudgments,
  type RoundJudgment,
} from '../src/lib/engine/optimization-cycle'

function makeJudgment(score: number, hasMaterialIssues = false, findings: string[] = [], suggestedChanges: string[] = []): RoundJudgment {
  return {
    score,
    hasMaterialIssues,
    summary: 'review',
    findings,
    suggestedChanges,
  }
}

test('reviewer summary uses only the single current review result', () => {
  const summary = summarizeJudgments([
    makeJudgment(96, false, ['issue A'], ['patch A']),
  ], 95)

  assert.equal(summary.passCount, 1)
  assert.equal(summary.averageScore, 96)
  assert.deepEqual(summary.aggregatedIssues, ['issue A', 'patch A'])
})

test('pass streak increments only when current review fully passes', () => {
  assert.equal(nextPassStreak(0, makeJudgment(95, false)), 1)
  assert.equal(nextPassStreak(1, makeJudgment(96, false)), 2)
  assert.equal(nextPassStreak(2, makeJudgment(94, true, ['issue'])), 0)
})

test('job finalizes only after three consecutive passing reviews', () => {
  assert.equal(shouldFinalizeAfterReview(2, makeJudgment(95, false), 95), true)
  assert.equal(shouldFinalizeAfterReview(1, makeJudgment(95, false), 95), false)
  assert.equal(shouldFinalizeAfterReview(2, makeJudgment(95, true, ['issue']), 95), false)
})
