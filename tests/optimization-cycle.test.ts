import assert from 'node:assert/strict'
import test from 'node:test'

import {
  runOptimizationCycle,
  type ModelAdapter,
  type OptimizationResult,
  type RoundJudgment,
} from '../src/lib/engine/optimization-cycle'

class FakeAdapter implements ModelAdapter {
  optimizeCalls: Array<{ currentPrompt: string }> = []
  judgeCalls: string[] = []

  constructor(
    private readonly optimizedPrompt: string,
    private readonly judgment: RoundJudgment,
    private readonly options: {
      optimizeDelayMs?: number
      judgeDelayMs?: number
      optimizeError?: Error
      judgeError?: Error
    } = {},
  ) {}

  async optimizePrompt(input: { currentPrompt: string }): Promise<OptimizationResult> {
    this.optimizeCalls.push({ currentPrompt: input.currentPrompt })
    if (this.options.optimizeDelayMs) {
      await delay(this.options.optimizeDelayMs)
    }
    if (this.options.optimizeError) {
      throw this.options.optimizeError
    }
    return {
      optimizedPrompt: this.optimizedPrompt,
      strategy: 'rebuild',
      scoreBefore: 61,
      majorChanges: ['tightened output contract'],
      mve: 'Run one judge-only dry check.',
      deadEndSignals: ['missing variables'],
    }
  }

  async judgePrompt(prompt: string): Promise<RoundJudgment> {
    this.judgeCalls.push(prompt)
    if (this.options.judgeDelayMs) {
      await delay(this.options.judgeDelayMs)
    }
    if (this.options.judgeError) {
      throw this.options.judgeError
    }
    return this.judgment
  }
}

test('judges the current input prompt while generating the next prompt in parallel', async () => {
  const adapter = new FakeAdapter('final prompt', {
    score: 97,
    hasMaterialIssues: false,
    summary: 'strong',
    driftLabels: [],
    driftExplanation: '',
    findings: [],
    suggestedChanges: [],
  }, {
    optimizeDelayMs: 30,
    judgeDelayMs: 30,
  })

  const result = await runOptimizationCycle({
    adapter,
    currentPrompt: 'draft prompt',
    goalAnchor: {
      goal: 'Keep the original task.',
      deliverable: 'Return the requested output.',
      driftGuard: ['Do not drift away from the original task.'],
    },
    threshold: 95,
  })

  assert.equal(adapter.optimizeCalls[0]?.currentPrompt, 'draft prompt')
  assert.deepEqual(adapter.judgeCalls, ['draft prompt'])
  assert.equal(result.inputReview?.score, 97)
  assert.equal(result.optimization?.optimizedPrompt, 'final prompt')
  assert.deepEqual(result.aggregatedIssues, [])
  assert.equal(result.reviewError, null)
  assert.equal(result.optimizationError, null)
  assert.ok(
    (adapter.judgeCalls.length > 0 && adapter.optimizeCalls.length > 0),
    'judge and optimizer should both be invoked in the same round',
  )
})

test('can serialize optimizer before judge for runtime hotfix mode', async () => {
  const events: string[] = []
  const adapter: ModelAdapter = {
    async optimizePrompt(input) {
      events.push(`optimize:start:${input.currentPrompt}`)
      await delay(20)
      events.push('optimize:end')
      return {
        optimizedPrompt: 'final prompt',
        strategy: 'rebuild',
        scoreBefore: 61,
        majorChanges: ['tightened output contract'],
        mve: 'Run one judge-only dry check.',
        deadEndSignals: ['missing variables'],
      }
    },
    async judgePrompt(prompt) {
      events.push(`judge:start:${prompt}`)
      await delay(1)
      events.push('judge:end')
      return {
        score: 97,
        hasMaterialIssues: false,
        summary: 'strong',
        driftLabels: [],
        driftExplanation: '',
        findings: [],
        suggestedChanges: [],
      }
    },
  }

  await runOptimizationCycle({
    adapter,
    currentPrompt: 'draft prompt',
    goalAnchor: {
      goal: 'Keep the original task.',
      deliverable: 'Return the requested output.',
      driftGuard: ['Do not drift away from the original task.'],
    },
    threshold: 95,
    executionMode: 'sequential',
  })

  assert.deepEqual(events, [
    'optimize:start:draft prompt',
    'optimize:end',
    'judge:start:draft prompt',
    'judge:end',
  ])
})

test('keeps the generated output when judge fails', async () => {
  const adapter = new FakeAdapter('better prompt', {
    score: 94,
    hasMaterialIssues: true,
    summary: 'still weak',
    driftLabels: ['focus_shift'],
    driftExplanation: 'The prompt drifted away from the original task center.',
    findings: ['missing boundary test'],
    suggestedChanges: ['add edge case'],
  }, {
    judgeError: new Error('judge unavailable'),
  })

  const result = await runOptimizationCycle({
    adapter,
    currentPrompt: 'draft prompt',
    goalAnchor: {
      goal: 'Keep the original task.',
      deliverable: 'Return the requested output.',
      driftGuard: ['Do not drift away from the original task.'],
    },
    threshold: 95,
  })

  assert.equal(result.optimization?.optimizedPrompt, 'better prompt')
  assert.equal(result.inputReview, null)
  assert.match(String(result.reviewError), /judge unavailable/)
  assert.deepEqual(result.aggregatedIssues, [])
})

test('keeps the review result when optimizer fails', async () => {
  const adapter = new FakeAdapter('unused prompt', {
    score: 94,
    hasMaterialIssues: true,
    summary: 'still weak',
    driftLabels: ['focus_shift'],
    driftExplanation: 'The prompt drifted away from the original task center.',
    findings: ['missing boundary test'],
    suggestedChanges: ['add edge case'],
  }, {
    optimizeError: new Error('optimizer unavailable'),
  })

  const result = await runOptimizationCycle({
    adapter,
    currentPrompt: 'draft prompt',
    goalAnchor: {
      goal: 'Keep the original task.',
      deliverable: 'Return the requested output.',
      driftGuard: ['Do not drift away from the original task.'],
    },
    threshold: 95,
  })

  assert.equal(result.optimization, null)
  assert.equal(result.inputReview?.score, 94)
  assert.match(String(result.optimizationError), /optimizer unavailable/)
  assert.deepEqual(result.aggregatedIssues, ['missing boundary test', 'add edge case'])
})

test('preserves request telemetry from both success and failure branches', async () => {
  const reviewTelemetry = [{
    kind: 'attempt_succeeded',
    requestLabel: 'judge',
    protocol: 'openai-compatible',
    endpointKind: 'responses',
    endpoint: 'http://localhost:8317/v1/responses',
    attempt: 1,
    maxAttempts: 2,
    timeoutMs: 240_000,
    elapsedMs: 5_200,
    status: 200,
    retriable: false,
    message: 'ok',
    at: '2026-03-20T00:00:00.000Z',
  }]
  const optimizationTelemetry = [{
    kind: 'attempt_failed',
    requestLabel: 'optimizer',
    protocol: 'openai-compatible',
    endpointKind: 'responses',
    endpoint: 'http://localhost:8317/v1/responses',
    attempt: 1,
    maxAttempts: 2,
    timeoutMs: 240_000,
    elapsedMs: 119_490,
    status: 408,
    retriable: true,
    message: 'request timeout',
    at: '2026-03-20T00:00:10.000Z',
  }]
  const optimizeError = Object.assign(new Error('optimizer unavailable'), {
    requestTelemetry: optimizationTelemetry,
  })
  const adapter = new FakeAdapter('unused prompt', {
    score: 96,
    hasMaterialIssues: false,
    summary: 'strong',
    driftLabels: [],
    driftExplanation: '',
    findings: [],
    suggestedChanges: [],
    requestTelemetry: reviewTelemetry,
  } as RoundJudgment & { requestTelemetry: typeof reviewTelemetry }, {
    optimizeError,
  })

  const result = await runOptimizationCycle({
    adapter,
    currentPrompt: 'draft prompt',
    goalAnchor: {
      goal: 'Keep the original task.',
      deliverable: 'Return the requested output.',
      driftGuard: ['Do not drift away from the original task.'],
    },
    threshold: 95,
  })

  assert.deepEqual(result.reviewTelemetry, reviewTelemetry)
  assert.deepEqual(result.optimizationTelemetry, optimizationTelemetry)
})

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
