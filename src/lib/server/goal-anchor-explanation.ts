import type { GoalAnchor, GoalAnchorExplanation } from '@/lib/server/types'

export function deriveGoalAnchorExplanation(rawPrompt: string, goalAnchor: GoalAnchor): GoalAnchorExplanation {
  const sourceSummary = summarizeSource(rawPrompt)
  return normalizeGoalAnchorExplanation({
    sourceSummary,
    rationale: [
      `系统把任务理解为：${goalAnchor.goal}`,
      `关键交付物被提炼为：${goalAnchor.deliverable}`,
      '防漂移条款用于防止优化过程把任务改写成更泛化、更安全但不再忠实原始意图的版本。',
    ],
  })
}

export function normalizeGoalAnchorExplanation(input: Partial<GoalAnchorExplanation>): GoalAnchorExplanation {
  const sourceSummary = normalizeText(input.sourceSummary ?? '') || '系统保留了原始任务中最核心的目标描述。'
  const rationale = Array.isArray(input.rationale)
    ? input.rationale.map((item) => normalizeText(item)).filter(Boolean)
    : []

  return {
    sourceSummary,
    rationale: rationale.length > 0 ? rationale : [
      '系统优先保留原始任务目标。',
      '系统明确保留关键交付物，避免多轮优化后偏题。',
    ],
  }
}

export function serializeGoalAnchorExplanation(explanation: Partial<GoalAnchorExplanation>) {
  return JSON.stringify(normalizeGoalAnchorExplanation(explanation))
}

export function parseGoalAnchorExplanation(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return normalizeGoalAnchorExplanation({})
  }

  try {
    return normalizeGoalAnchorExplanation(JSON.parse(value) as Partial<GoalAnchorExplanation>)
  } catch {
    return normalizeGoalAnchorExplanation({})
  }
}

function summarizeSource(rawPrompt: string) {
  const normalized = normalizeText(rawPrompt)
  if (normalized.length <= 160) {
    return normalized
  }
  return `${normalized.slice(0, 160).trimEnd()}...`
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}
