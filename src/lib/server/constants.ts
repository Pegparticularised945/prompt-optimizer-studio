import path from 'node:path'

import type { ConversationPolicy } from '@/lib/engine/conversation-policy'

export const PROMPT_SKILL_DIR = '/Users/road/.codex/skills/prompt-optimizer'

export function resolveDatabasePath() {
  return process.env.PROMPT_OPTIMIZER_DB_PATH ?? path.join(process.cwd(), 'data', 'prompt-optimizer.db')
}

export const DEFAULT_SETTINGS = {
  cpamcBaseUrl: '',
  cpamcApiKey: '',
  defaultOptimizerModel: '',
  defaultJudgeModel: '',
  scoreThreshold: 95,
  judgePassCount: 3,
  maxRounds: 8,
  noImprovementLimit: 2,
  workerConcurrency: 1,
  conversationPolicy: 'stateless' as ConversationPolicy,
}

export const TERMINAL_JOB_STATUSES = new Set(['completed', 'failed', 'manual_review', 'cancelled'])
