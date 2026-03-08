import assert from 'node:assert/strict'
import test from 'node:test'

import { resolvePostReviewStatus } from '../src/lib/server/worker'

test('step mode pauses after exactly one completed round', () => {
  assert.equal(resolvePostReviewStatus({
    shouldComplete: false,
    roundNumber: 4,
    maxRounds: 8,
    runMode: 'step',
    pauseRequestedAt: null,
  }), 'paused')
})

test('cooperative pause wins after the current round finishes', () => {
  assert.equal(resolvePostReviewStatus({
    shouldComplete: false,
    roundNumber: 4,
    maxRounds: 8,
    runMode: 'auto',
    pauseRequestedAt: '2026-03-08T10:00:00.000Z',
  }), 'paused')
})

test('auto mode falls back to manual review once the effective max round is reached', () => {
  assert.equal(resolvePostReviewStatus({
    shouldComplete: false,
    roundNumber: 8,
    maxRounds: 8,
    runMode: 'auto',
    pauseRequestedAt: null,
  }), 'manual_review')
})

test('completion still wins over step or pause controls', () => {
  assert.equal(resolvePostReviewStatus({
    shouldComplete: true,
    roundNumber: 8,
    maxRounds: 8,
    runMode: 'step',
    pauseRequestedAt: '2026-03-08T10:00:00.000Z',
  }), 'completed')
})
