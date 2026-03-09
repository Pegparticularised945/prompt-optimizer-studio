import type { ConversationPolicy } from '@/lib/engine/conversation-policy'
import { resolveRuntimeEnv } from '@/lib/server/runtime-env'

export const PROMPT_SKILL_DIR = '/Users/road/.codex/skills/prompt-optimizer'

export function resolveDatabasePath() {
  return resolveRuntimeEnv().databasePath
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
