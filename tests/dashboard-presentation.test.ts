import assert from 'node:assert/strict'
import test from 'node:test'

import { focusDashboardJobs, partitionDashboardJobs, prioritizeActiveDashboardJobs } from '../src/lib/presentation'

test('dashboard partitions active, queued, recent completed, and history jobs', () => {
  const grouped = partitionDashboardJobs([
    makeJob('active-running', 'running', '2026-03-08T10:00:00.000Z'),
    makeJob('active-paused', 'paused', '2026-03-08T09:00:00.000Z'),
    makeJob('active-manual', 'manual_review', '2026-03-08T08:00:00.000Z'),
    makeJob('queued', 'pending', '2026-03-08T07:00:00.000Z'),
    makeJob('completed-1', 'completed', '2026-03-08T06:00:00.000Z'),
    makeJob('completed-2', 'completed', '2026-03-08T05:00:00.000Z'),
    makeJob('completed-3', 'completed', '2026-03-08T04:00:00.000Z'),
    makeJob('completed-4', 'completed', '2026-03-08T03:00:00.000Z'),
    makeJob('failed', 'failed', '2026-03-08T02:00:00.000Z'),
    makeJob('cancelled', 'cancelled', '2026-03-08T01:00:00.000Z'),
  ])

  assert.deepEqual(grouped.active.map((job) => job.id), [
    'active-manual',
    'active-paused',
    'active-running',
  ])
  assert.deepEqual(grouped.queued.map((job) => job.id), ['queued'])
  assert.deepEqual(grouped.recentCompleted.map((job) => job.id), [
    'completed-1',
    'completed-2',
    'completed-3',
  ])
  assert.deepEqual(grouped.history.map((job) => job.id), [
    'completed-4',
    'failed',
    'cancelled',
  ])
})

test('active jobs are prioritized as manual review, paused, then running', () => {
  const prioritized = prioritizeActiveDashboardJobs([
    makeJob('running-a', 'running', '2026-03-08T10:00:00.000Z'),
    makeJob('manual', 'manual_review', '2026-03-08T09:00:00.000Z'),
    makeJob('paused', 'paused', '2026-03-08T08:00:00.000Z'),
    makeJob('running-b', 'running', '2026-03-08T07:00:00.000Z'),
  ])

  assert.deepEqual(prioritized.map((job) => job.id), [
    'manual',
    'paused',
    'running-a',
    'running-b',
  ])
})

test('action focus view keeps only active jobs and hides queued, recent completed, and history', () => {
  const grouped = partitionDashboardJobs([
    makeJob('running', 'running', '2026-03-08T10:00:00.000Z'),
    makeJob('queued', 'pending', '2026-03-08T09:00:00.000Z'),
    makeJob('completed', 'completed', '2026-03-08T08:00:00.000Z'),
    makeJob('failed', 'failed', '2026-03-08T07:00:00.000Z'),
  ])

  const focused = focusDashboardJobs(grouped, true)

  assert.deepEqual(focused.active.map((job) => job.id), ['running'])
  assert.deepEqual(focused.queued, [])
  assert.deepEqual(focused.recentCompleted, [])
  assert.deepEqual(focused.history, [])
})

function makeJob(id: string, status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'manual_review' | 'cancelled', createdAt: string) {
  return {
    id,
    title: id,
    status,
    currentRound: 1,
    bestAverageScore: 90,
    errorMessage: null,
    createdAt,
    conversationPolicy: 'stateless' as const,
    optimizerModel: 'gpt-5.2',
    judgeModel: 'gpt-5.2',
  }
}
