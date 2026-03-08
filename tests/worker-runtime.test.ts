import assert from 'node:assert/strict'
import test from 'node:test'

import { createWorkerRuntimeState, shouldReplaceWorkerRuntime } from '../src/lib/server/worker-runtime'

test('replaces worker runtime when owner changes', () => {
  const existing = createWorkerRuntimeState('owner-a')
  assert.equal(shouldReplaceWorkerRuntime(existing, 'owner-b'), true)
})

test('keeps worker runtime when owner is unchanged', () => {
  const existing = createWorkerRuntimeState('owner-a')
  assert.equal(shouldReplaceWorkerRuntime(existing, 'owner-a'), false)
})
