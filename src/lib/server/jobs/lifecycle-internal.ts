import { getDb } from '@/lib/server/db/index'
import { compactFeedback } from '@/lib/server/prompting'
import { getSettings } from '@/lib/server/settings/index'
import type { JobRunMode, JobRecord, JudgeRunRecord, SteeringItem } from '@/lib/contracts'

import { requireJob } from '@/lib/server/jobs/queries-internal'
import { insertCandidateAndJudgments, selectLatestCandidateId } from '@/lib/server/jobs/repository'
import { assertFiniteScore, resolveEffectiveMaxRounds } from '@/lib/server/jobs/shared-internal'

function resumeJob(jobId: string, runMode: JobRunMode) {
  const job = requireJob(jobId)

  if (job.status === 'running') {
    throw new Error('任务正在运行中，无需重复继续。')
  }

  if (job.status === 'completed') {
    throw new Error('已完成任务不能继续运行。')
  }

  if (job.status === 'cancelled') {
    throw new Error('已取消任务不能继续运行。')
  }

  const effectiveMaxRounds = resolveEffectiveMaxRounds(job, getSettings().maxRounds)
  if (job.currentRound >= effectiveMaxRounds) {
    throw new Error('请先提高任务级最大轮数后再继续运行。')
  }

  getDb().prepare(`
    UPDATE jobs
    SET status = 'pending',
        run_mode = ?,
        active_worker_id = NULL,
        worker_heartbeat_at = NULL,
        cancel_requested_at = NULL,
        pause_requested_at = NULL,
        error_message = NULL,
        updated_at = ?
    WHERE id = ?
  `).run(runMode, new Date().toISOString(), jobId)

  return requireJob(jobId)
}

export function pauseJob(jobId: string) {
  const job = requireJob(jobId)
  const db = getDb()
  const now = new Date().toISOString()

  if (job.status === 'completed') {
    throw new Error('已完成任务不能暂停。')
  }

  if (job.status === 'cancelled') {
    throw new Error('已取消任务不能暂停。')
  }

  if (job.status === 'paused') {
    return job
  }

  if (job.status === 'running') {
    db.prepare(`
      UPDATE jobs
      SET pause_requested_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(now, now, jobId)
    return requireJob(jobId)
  }

  db.prepare(`
    UPDATE jobs
    SET status = 'paused',
        active_worker_id = NULL,
        worker_heartbeat_at = NULL,
        pause_requested_at = NULL,
        updated_at = ?
    WHERE id = ?
  `).run(now, jobId)

  return requireJob(jobId)
}

export function resumeJobStep(jobId: string) {
  return resumeJob(jobId, 'step')
}

export function resumeJobAuto(jobId: string) {
  return resumeJob(jobId, 'auto')
}

export function cancelJob(jobId: string) {
  const job = requireJob(jobId)
  const db = getDb()
  const now = new Date().toISOString()

  if (job.status === 'completed') {
    throw new Error('已完成任务不能取消。')
  }

  if (job.status === 'cancelled') {
    return job
  }

  if (job.status === 'running') {
    db.prepare(`
      UPDATE jobs
      SET cancel_requested_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(now, now, jobId)
    return requireJob(jobId)
  }

  db.prepare(`
    UPDATE jobs
    SET status = 'cancelled',
        active_worker_id = NULL,
        worker_heartbeat_at = NULL,
        cancel_requested_at = NULL,
        pause_requested_at = NULL,
        error_message = '任务已取消。',
        updated_at = ?
    WHERE id = ?
  `).run(now, jobId)

  return requireJob(jobId)
}

export function finalizeCancelledJob(jobId: string) {
  getDb().prepare(`
    UPDATE jobs
    SET status = 'cancelled',
        active_worker_id = NULL,
        worker_heartbeat_at = NULL,
        cancel_requested_at = NULL,
        pause_requested_at = NULL,
        error_message = '任务已取消。',
        updated_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), jobId)

  return requireJob(jobId)
}

export function completeJob(jobId: string) {
  const job = requireJob(jobId)

  if (job.status === 'completed') {
    return job
  }

  if (job.status === 'running') {
    throw new Error('运行中的任务不能手动完成，请先暂停后再完成。')
  }

  if (job.status === 'pending') {
    throw new Error('任务还未开始运行，无法完成。请先跑至少一轮或取消任务。')
  }

  if (job.status === 'cancelled') {
    throw new Error('已取消任务不能完成。')
  }

  if (job.status !== 'paused' && job.status !== 'manual_review' && job.status !== 'failed') {
    throw new Error('当前状态不支持手动完成任务。')
  }

  const latestCandidate = selectLatestCandidateId(jobId)
  if (!latestCandidate?.id) {
    throw new Error('请先跑至少一轮生成候选稿；如果只是想归档，请直接取消任务。')
  }

  const now = new Date().toISOString()
  getDb().prepare(`
    UPDATE jobs
    SET status = 'completed',
        final_candidate_id = ?,
        pending_optimizer_model = NULL,
        pending_judge_model = NULL,
        pending_optimizer_reasoning_effort = NULL,
        pending_judge_reasoning_effort = NULL,
        active_worker_id = NULL,
        worker_heartbeat_at = NULL,
        cancel_requested_at = NULL,
        pause_requested_at = NULL,
        error_message = NULL,
        updated_at = ?
    WHERE id = ?
  `).run(String(latestCandidate.id), now, jobId)

  return requireJob(jobId)
}

export function applyPendingJobModels(jobId: string) {
  const job = requireJob(jobId)
  if (
    !job.pendingOptimizerModel
    && !job.pendingJudgeModel
    && job.pendingOptimizerReasoningEffort === null
    && job.pendingJudgeReasoningEffort === null
  ) {
    return job
  }

  getDb().prepare(`
    UPDATE jobs
    SET optimizer_model = COALESCE(NULLIF(pending_optimizer_model, ''), optimizer_model),
        judge_model = COALESCE(NULLIF(pending_judge_model, ''), judge_model),
        optimizer_reasoning_effort = COALESCE(NULLIF(pending_optimizer_reasoning_effort, ''), optimizer_reasoning_effort),
        judge_reasoning_effort = COALESCE(NULLIF(pending_judge_reasoning_effort, ''), judge_reasoning_effort),
        pending_optimizer_model = NULL,
        pending_judge_model = NULL,
        pending_optimizer_reasoning_effort = NULL,
        pending_judge_reasoning_effort = NULL,
        updated_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), jobId)

  return requireJob(jobId)
}

export function updateJobReviewState(jobId: string, input: {
  passStreak: number
  bestAverageScore: number
  lastReviewScore: number
  lastReviewPatch: string[]
  currentRound: number
  finalCandidateId?: string | null
  status: JobRecord['status']
  errorMessage?: string | null
}) {
  getDb().prepare(`
    UPDATE jobs
    SET pass_streak = ?,
        best_average_score = ?,
        last_review_score = ?,
        last_review_patch_json = ?,
        current_round = ?,
        final_candidate_id = ?,
        status = ?,
        active_worker_id = CASE WHEN ? = 'running' THEN active_worker_id ELSE NULL END,
        worker_heartbeat_at = CASE WHEN ? = 'running' THEN ? ELSE NULL END,
        pause_requested_at = NULL,
        error_message = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    input.passStreak,
    input.bestAverageScore,
    input.lastReviewScore,
    JSON.stringify(compactFeedback(input.lastReviewPatch, { maxItems: 5, maxItemLength: 180 })),
    input.currentRound,
    input.finalCandidateId ?? null,
    input.status,
    input.status,
    input.status,
    new Date().toISOString(),
    input.errorMessage ?? null,
    new Date().toISOString(),
    jobId,
  )
}

export function resetJobForRetry(id: string) {
  const job = requireJob(id)
  if (job.status === 'running') {
    throw new Error('运行中的任务请先取消，或等待当前轮结束。')
  }
  if (job.status === 'completed') {
    throw new Error('已完成任务不能直接重新开始。')
  }

  applyPendingJobModels(id)
  const db = getDb()
  db.prepare('DELETE FROM judge_runs WHERE job_id = ?').run(id)
  db.prepare('DELETE FROM candidates WHERE job_id = ?').run(id)
  db.prepare(`
    UPDATE jobs
    SET status = 'pending',
        run_mode = 'auto',
        active_worker_id = NULL,
        worker_heartbeat_at = NULL,
        current_round = 0,
        best_average_score = 0,
        next_round_instruction = NULL,
        next_round_instruction_updated_at = NULL,
        pending_steering_json = '[]',
        pass_streak = 0,
        last_review_score = 0,
        last_review_patch_json = '[]',
        final_candidate_id = NULL,
        cancel_requested_at = NULL,
        pause_requested_at = NULL,
        error_message = NULL,
        updated_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), id)

  return requireJob(id)
}

function validateCandidateWriteInput(input: {
  scoreBefore: number
  averageScore: number
  judgments: JudgeRunRecord[]
}) {
  assertFiniteScore(input.scoreBefore, 'scoreBefore')
  assertFiniteScore(input.averageScore, 'averageScore')
  for (const judgment of input.judgments) {
    assertFiniteScore(judgment.score, `judgments[${judgment.judgeIndex}].score`)
  }
}

export function createCandidateWithJudges(jobId: string, input: {
  roundNumber: number
  optimizedPrompt: string
  strategy: 'preserve' | 'rebuild'
  scoreBefore: number
  averageScore: number
  majorChanges: string[]
  mve: string
  deadEndSignals: string[]
  aggregatedIssues: string[]
  appliedSteeringItems?: SteeringItem[]
  judgments: JudgeRunRecord[]
}) {
  validateCandidateWriteInput(input)

  const db = getDb()
  const candidateId = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  insertCandidateAndJudgments(db, jobId, candidateId, input.roundNumber, input, createdAt)
  return candidateId
}

export function createCandidateWithJudgesForActiveWorker(jobId: string, workerOwnerId: string, input: {
  optimizedPrompt: string
  strategy: 'preserve' | 'rebuild'
  scoreBefore: number
  averageScore: number
  majorChanges: string[]
  mve: string
  deadEndSignals: string[]
  aggregatedIssues: string[]
  appliedSteeringItems?: SteeringItem[]
  judgments: JudgeRunRecord[]
}) {
  validateCandidateWriteInput(input)

  const db = getDb()
  const candidateId = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  let transactionOpen = false

  try {
    db.exec('BEGIN IMMEDIATE')
    transactionOpen = true

    const jobRow = db.prepare(`
      SELECT status, active_worker_id, current_round
      FROM jobs
      WHERE id = ?
    `).get(jobId) as { status?: string; active_worker_id?: string | null; current_round?: number } | undefined

    if (!jobRow || String(jobRow.status ?? '') !== 'running' || String(jobRow.active_worker_id ?? '') !== workerOwnerId) {
      db.exec('ROLLBACK')
      transactionOpen = false
      return null
    }

    const maxRoundRow = db.prepare(`
      SELECT COALESCE(MAX(round_number), 0) AS max_round
      FROM candidates
      WHERE job_id = ?
    `).get(jobId) as { max_round?: number } | undefined

    const nextRound = Math.max(Number(jobRow.current_round ?? 0), Number(maxRoundRow?.max_round ?? 0)) + 1
    insertCandidateAndJudgments(db, jobId, candidateId, nextRound, input, createdAt)

    db.exec('COMMIT')
    transactionOpen = false
    return { candidateId, roundNumber: nextRound }
  } catch (error) {
    if (transactionOpen) {
      try {
        db.exec('ROLLBACK')
      } catch {
        // Ignore rollback failures after the original write error.
      }
    }
    throw error
  }
}

export function updateJobProgress(jobId: string, input: {
  status: JobRecord['status']
  currentRound: number
  bestAverageScore: number
  finalCandidateId?: string | null
  errorMessage?: string | null
}) {
  getDb().prepare(`
    UPDATE jobs
    SET status = ?,
        current_round = ?,
        best_average_score = ?,
        final_candidate_id = ?,
        active_worker_id = CASE WHEN ? = 'running' THEN active_worker_id ELSE NULL END,
        worker_heartbeat_at = CASE WHEN ? = 'running' THEN worker_heartbeat_at ELSE NULL END,
        pause_requested_at = CASE WHEN ? = 'running' THEN pause_requested_at ELSE NULL END,
        error_message = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    input.status,
    input.currentRound,
    input.bestAverageScore,
    input.finalCandidateId ?? null,
    input.status,
    input.status,
    input.status,
    input.errorMessage ?? null,
    new Date().toISOString(),
    jobId,
  )
}
