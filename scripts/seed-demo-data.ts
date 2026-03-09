import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { resetDbForTests, getDb } from '../src/lib/server/db'
import {
  addPendingSteeringItem,
  cancelJob,
  createCandidateWithJudges,
  createJobs,
  updateJobMaxRoundsOverride,
  updateJobProgress,
  updateJobReviewState,
} from '../src/lib/server/jobs'
import { saveSettings } from '../src/lib/server/settings'
import type { JudgeRunRecord } from '../src/lib/server/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const defaultDbPath = path.join(repoRoot, 'data', 'readme-demo.db')
const manifestPath = path.join(repoRoot, 'docs', 'screenshots', 'demo-manifest.json')

const targetDbPath = path.resolve(process.env.PROMPT_OPTIMIZER_DB_PATH?.trim() || defaultDbPath)
process.env.PROMPT_OPTIMIZER_DB_PATH = targetDbPath
process.chdir(repoRoot)

for (const suffix of ['', '-shm', '-wal']) {
  fs.rmSync(`${targetDbPath}${suffix}`, { force: true })
}

resetDbForTests()

const originalFetch = global.fetch

global.fetch = (async () => {
  throw new Error('demo seed uses local goal-anchor fallback')
}) as typeof fetch

async function main() {
  saveSettings({
    cpamcBaseUrl: 'https://demo.invalid/v1',
    cpamcApiKey: 'demo-local-only',
    defaultOptimizerModel: 'gpt-5.2',
    defaultJudgeModel: 'gpt-5.2',
    scoreThreshold: 95,
    maxRounds: 8,
  })

  const [detailJob] = await createJobs([
    {
      title: '问问老中医',
      rawPrompt: [
        '我想做一个“问问老中医”提示词。',
        '它应该根据用户描述的症状、作息、饮食和情绪状态，给出像老中医一样的辨证判断、调理建议和就医提醒。',
        '不要最后只剩通用安全建议，也不要丢掉老中医式的判断口吻。',
        '最终一定要给我可以一键复制的完整提示词。',
      ].join('\n'),
      optimizerModel: 'claude-sonnet-4',
      judgeModel: 'claude-sonnet-4',
    },
  ])

  const [manualReviewJob, runningJob, pendingJob, completedA, completedB, completedC, historyCompleted, historyFailed, historyCancelled] = await createJobs([
    {
      title: '短视频直播脚本',
      rawPrompt: '把产品卖点改成更像真人主播自然会说的话，但别变成夸张叫卖。',
      optimizerModel: 'gpt-5.2',
      judgeModel: 'gpt-5.2',
    },
    {
      title: '宠物陪伴人设',
      rawPrompt: '优化一个陪伴型聊天提示词，让语气稳定、温柔，但不要过度说教。',
      optimizerModel: 'gemini-2.5-pro',
      judgeModel: 'gemini-2.5-pro',
    },
    {
      title: '播客开场白',
      rawPrompt: '把播客开场白优化得更有节奏感，但不要过度营销。',
      optimizerModel: 'gpt-5.2',
      judgeModel: 'gpt-5.2',
    },
    {
      title: '电商客服回复',
      rawPrompt: '优化一段售后客服提示词，既要安抚情绪，也要可执行。',
      optimizerModel: 'claude-sonnet-4',
      judgeModel: 'claude-sonnet-4',
    },
    {
      title: '旅行行程助理',
      rawPrompt: '优化一个旅行路线规划提示词，让输出更清晰、更像真实顾问。',
      optimizerModel: 'gpt-5.2',
      judgeModel: 'gpt-5.2',
    },
    {
      title: '知识卡片提炼',
      rawPrompt: '优化一个知识卡片提炼提示词，让结构稳定，适合批量处理。',
      optimizerModel: 'gemini-2.5-pro',
      judgeModel: 'gemini-2.5-pro',
    },
    {
      title: '问问老中医',
      rawPrompt: '旧版老中医提示词，需要保持辨证论治语气。',
      optimizerModel: 'claude-sonnet-4',
      judgeModel: 'claude-sonnet-4',
    },
    {
      title: '问问老中医',
      rawPrompt: '另一版老中医提示词，当前存在明显跑题。',
      optimizerModel: 'gpt-5.2',
      judgeModel: 'gpt-5.2',
    },
    {
      title: '问问老中医',
      rawPrompt: '取消的老中医任务。',
      optimizerModel: 'gpt-5.2',
      judgeModel: 'gpt-5.2',
    },
  ])

  await buildDetailPausedJob(detailJob.id)
  await buildManualReviewJob(manualReviewJob.id)
  await buildRunningJob(runningJob.id)
  await buildCompletedJob(completedA.id, {
    roundNumber: 3,
    score: 98,
    titlePrompt: completedPrompt('电商客服回复', '先安抚用户，再给出退款 / 补发条件，最后附上下一步动作。'),
    summary: '信息层次清晰，可以直接落地。',
  })
  await buildCompletedJob(completedB.id, {
    roundNumber: 2,
    score: 97,
    titlePrompt: completedPrompt('旅行行程助理', '输出按日期拆分，并提供备选方案和预算提醒。'),
    summary: '结果完整，顾问感明确。',
  })
  await buildCompletedJob(completedC.id, {
    roundNumber: 2,
    score: 96,
    titlePrompt: completedPrompt('知识卡片提炼', '卡片结构统一，适合批量复制。'),
    summary: '结构稳定，适合生产。',
  })
  await buildCompletedJob(historyCompleted.id, {
    roundNumber: 4,
    score: 94,
    titlePrompt: completedPrompt('问问老中医', '强调辨证、调理和需要线下就医的边界。'),
    summary: '已能用，但风格还不够稳。',
  })
  await buildFailedJob(historyFailed.id)
  cancelJob(historyCancelled.id)

  applyTimestamps([
    { jobId: detailJob.id, createdAt: '2026-03-09T09:30:00.000Z' },
    { jobId: manualReviewJob.id, createdAt: '2026-03-09T09:10:00.000Z' },
    { jobId: runningJob.id, createdAt: '2026-03-09T08:50:00.000Z' },
    { jobId: pendingJob.id, createdAt: '2026-03-09T08:30:00.000Z' },
    { jobId: completedA.id, createdAt: '2026-03-09T08:10:00.000Z' },
    { jobId: completedB.id, createdAt: '2026-03-09T07:50:00.000Z' },
    { jobId: completedC.id, createdAt: '2026-03-09T07:30:00.000Z' },
    { jobId: historyCompleted.id, createdAt: '2026-03-08T22:40:00.000Z' },
    { jobId: historyFailed.id, createdAt: '2026-03-08T21:15:00.000Z' },
    { jobId: historyCancelled.id, createdAt: '2026-03-08T20:00:00.000Z' },
  ])

  saveSettings({
    cpamcBaseUrl: '',
    cpamcApiKey: '',
    defaultOptimizerModel: '',
    defaultJudgeModel: '',
  })

  const manifest = {
    generatedAt: new Date().toISOString(),
    dbPath: targetDbPath,
    dashboardFeaturedJobId: detailJob.id,
    detailScreenshotJobId: detailJob.id,
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Demo database ready: ${targetDbPath}`)
  console.log(`Detail screenshot job: ${detailJob.id}`)
  console.log(`Manifest written: ${manifestPath}`)
}

async function buildDetailPausedJob(jobId: string) {
  const round1 = createCandidateWithJudges(jobId, {
    roundNumber: 1,
    optimizedPrompt: [
      '你是一位会先归纳症状、再给建议的健康顾问。',
      '请根据用户描述给出饮食和作息建议。',
      '避免做医学诊断。',
    ].join('\n'),
    strategy: 'rebuild',
    scoreBefore: 64,
    averageScore: 78,
    majorChanges: ['补了输出结构', '增加调理建议'],
    mve: '验证是否还能保持老中医判断口吻。',
    deadEndSignals: ['过度抽象', '老中医语气不明显'],
    aggregatedIssues: ['太像通用健康科普', '没有辨证逻辑'],
    judgments: [makeJudge(jobId, 78, {
      summary: '结构有了，但风格仍偏通用。',
      driftLabels: ['风格偏移'],
      driftExplanation: '已经开始给建议，但不像老中医在辨证。',
      findings: ['缺少主判断', '语气太像平台科普'],
      suggestedChanges: ['恢复辨证步骤', '输出里先给一句总判断'],
      createdAt: '2026-03-09T09:31:00.000Z',
    })],
  })

  const round2 = createCandidateWithJudges(jobId, {
    roundNumber: 2,
    optimizedPrompt: [
      '你是一位表达克制、判断清楚的老中医顾问。',
      '面对用户描述的症状、作息、饮食与情绪状态时，请先辨证，再给调理方向。',
      '',
      '输出顺序：',
      '1. 一句话主判断',
      '2. 可能证型与依据',
      '3. 调理建议（饮食 / 作息 / 情绪）',
      '4. 需要线下就医的情况',
    ].join('\n'),
    strategy: 'preserve',
    scoreBefore: 78,
    averageScore: 85,
    majorChanges: ['恢复老中医角色', '加入主判断'],
    mve: '验证是否保留了辨证论治的口吻。',
    deadEndSignals: ['就医提醒仍然抢戏'],
    aggregatedIssues: ['辨证感增强，但还不够像一个成型提示词'],
    judgments: [makeJudge(jobId, 85, {
      summary: '方向对了，但结果还不够完整。',
      driftLabels: ['风险规避过重'],
      driftExplanation: '最后部分的风险提醒比核心输出更显眼。',
      findings: ['完整提示词还不够可复制', '风险提示权重偏高'],
      suggestedChanges: ['把输出要求写完整', '减少安全条款的篇幅'],
      createdAt: '2026-03-09T09:34:00.000Z',
    })],
  })

  const round3 = createCandidateWithJudges(jobId, {
    roundNumber: 3,
    optimizedPrompt: detailPrompt(),
    strategy: 'preserve',
    scoreBefore: 85,
    averageScore: 91,
    majorChanges: ['补齐完整复制版 prompt', '把调理建议改成更像老中医会说的话'],
    mve: '找一个湿热夹脾虚案例，确认是否还能稳定输出辨证 + 建议 + 就医边界。',
    deadEndSignals: ['若再继续优化，可能重新滑向安全模板'],
    aggregatedIssues: ['整体已经可用，只剩语气和边界权重微调'],
    judgments: [makeJudge(jobId, 91, {
      summary: '已经接近可交付，但还需要人工把关风格边界。',
      driftLabels: ['风格边缘漂移'],
      driftExplanation: '主体正确，但如果继续自动优化，可能再次被风险规避牵着走。',
      findings: ['语气仍可再稳一点', '“请及时就医”句式略显抢戏'],
      suggestedChanges: ['保持辨证感', '让最终结果继续是完整可复制提示词'],
      createdAt: '2026-03-09T09:38:00.000Z',
    })],
  })

  updateJobReviewState(jobId, {
    passStreak: 1,
    bestAverageScore: 91,
    lastReviewScore: 91,
    lastReviewPatch: ['保留老中医判断语气', '不要让风险规避压过主体结论'],
    currentRound: 3,
    finalCandidateId: round3,
    status: 'paused',
    errorMessage: null,
  })

  updateJobMaxRoundsOverride(jobId, 10)
  addPendingSteeringItem(jobId, '保留老中医式判断，不要把主体结论稀释成通用安全提示。')
  addPendingSteeringItem(jobId, '最终给我的仍然必须是可以一键复制的完整提示词，而不是改动说明。')

  const db = getDb()
  db.prepare(`
    UPDATE jobs
    SET run_mode = 'step'
    WHERE id = ?
  `).run(jobId)

  updateCandidateTimestamps(round1, '2026-03-09T09:31:00.000Z')
  updateCandidateTimestamps(round2, '2026-03-09T09:34:00.000Z')
  updateCandidateTimestamps(round3, '2026-03-09T09:38:00.000Z')
}

async function buildManualReviewJob(jobId: string) {
  const candidateId = createCandidateWithJudges(jobId, {
    roundNumber: 4,
    optimizedPrompt: [
      '你是一位自然但不油腻的直播脚本优化师。',
      '把卖点翻成主播真正会说的话，句子要短、口头感强。',
      '保留信任感，不要夸张冲销量。',
    ].join('\n'),
    strategy: 'rebuild',
    scoreBefore: 80,
    averageScore: 89,
    majorChanges: ['压缩句子长度', '增强口语感'],
    mve: '拿一个护肤品直播脚本做单轮抽查。',
    deadEndSignals: ['如果再继续自动化，可能开始过度营销'],
    aggregatedIssues: ['卖点口头化还不够自然'],
    judgments: [makeJudge(jobId, 89, {
      summary: '结果可用，但还不到自动完结标准。',
      driftLabels: ['营销腔上升'],
      driftExplanation: '再推几轮可能会变得更像叫卖。',
      findings: ['一句里塞了太多卖点', '人设还不够像真实主播'],
      suggestedChanges: ['保留停顿感', '减少绝对化表达'],
      createdAt: '2026-03-09T09:12:00.000Z',
    })],
  })

  updateJobReviewState(jobId, {
    passStreak: 0,
    bestAverageScore: 89,
    lastReviewScore: 89,
    lastReviewPatch: ['减少过度营销感', '主播人设再真实一点'],
    currentRound: 4,
    finalCandidateId: candidateId,
    status: 'manual_review',
    errorMessage: null,
  })

  updateCandidateTimestamps(candidateId, '2026-03-09T09:12:00.000Z')
}

async function buildRunningJob(jobId: string) {
  const candidateId = createCandidateWithJudges(jobId, {
    roundNumber: 2,
    optimizedPrompt: [
      '你是一个稳定温柔、记忆感强的宠物陪伴角色。',
      '回答要有安全感，但不要像客服。',
      '多用短句回应情绪，再给轻度引导。',
    ].join('\n'),
    strategy: 'preserve',
    scoreBefore: 79,
    averageScore: 86,
    majorChanges: ['增强陪伴语气'],
    mve: '用“主人焦虑加班”场景做抽查。',
    deadEndSignals: ['可能继续变得太安抚、缺少互动'],
    aggregatedIssues: ['互动张力还不足'],
    judgments: [makeJudge(jobId, 86, {
      summary: '正在向更稳定的陪伴语气收敛。',
      driftLabels: [],
      driftExplanation: '',
      findings: ['互动追问还不够'],
      suggestedChanges: ['增加一句自然追问'],
      createdAt: '2026-03-09T08:51:00.000Z',
    })],
  })

  updateJobProgress(jobId, {
    status: 'running',
    currentRound: 2,
    bestAverageScore: 86,
    finalCandidateId: candidateId,
    errorMessage: null,
  })

  updateCandidateTimestamps(candidateId, '2026-03-09T08:51:00.000Z')
}

async function buildCompletedJob(jobId: string, input: {
  roundNumber: number
  score: number
  titlePrompt: string
  summary: string
}) {
  const candidateId = createCandidateWithJudges(jobId, {
    roundNumber: input.roundNumber,
    optimizedPrompt: input.titlePrompt,
    strategy: 'preserve',
    scoreBefore: input.score - 4,
    averageScore: input.score,
    majorChanges: ['结果结构稳定', '压缩无关说明'],
    mve: '做一次真实输入回放即可。',
    deadEndSignals: [],
    aggregatedIssues: [],
    judgments: [makeJudge(jobId, input.score, {
      summary: input.summary,
      driftLabels: [],
      driftExplanation: '',
      findings: [],
      suggestedChanges: [],
    })],
  })

  updateJobReviewState(jobId, {
    passStreak: 3,
    bestAverageScore: input.score,
    lastReviewScore: input.score,
    lastReviewPatch: [],
    currentRound: input.roundNumber,
    finalCandidateId: candidateId,
    status: 'completed',
    errorMessage: null,
  })
}

async function buildFailedJob(jobId: string) {
  const candidateId = createCandidateWithJudges(jobId, {
    roundNumber: 2,
    optimizedPrompt: [
      '你是一位中医辨证助手。',
      '请根据症状给出判断。',
      '输出过于简化，未形成完整可复制提示词。',
    ].join('\n'),
    strategy: 'rebuild',
    scoreBefore: 70,
    averageScore: 74,
    majorChanges: ['尝试恢复辨证步骤'],
    mve: '验证是否能回到完整提示词模式。',
    deadEndSignals: ['结果太短'],
    aggregatedIssues: ['最终没有形成完整提示词'],
    judgments: [makeJudge(jobId, 74, {
      summary: '本轮失败，中断在半成品状态。',
      driftLabels: ['输出形态丢失'],
      driftExplanation: '返回了修改方向，却没有返回完整提示词。',
      findings: ['只剩说明，没有最终 prompt'],
      suggestedChanges: ['恢复完整提示词主交付'],
      createdAt: '2026-03-08T21:20:00.000Z',
    })],
  })

  updateJobProgress(jobId, {
    status: 'failed',
    currentRound: 2,
    bestAverageScore: 74,
    finalCandidateId: candidateId,
    errorMessage: '模型中断，未返回完整 JSON。',
  })

  updateCandidateTimestamps(candidateId, '2026-03-08T21:20:00.000Z')
}

function makeJudge(jobId: string, score: number, input: {
  summary: string
  driftLabels?: string[]
  driftExplanation?: string
  findings?: string[]
  suggestedChanges?: string[]
  createdAt?: string
}): JudgeRunRecord {
  return {
    id: crypto.randomUUID(),
    jobId,
    candidateId: '',
    judgeIndex: 0,
    score,
    hasMaterialIssues: score < 95,
    summary: input.summary,
    driftLabels: input.driftLabels ?? [],
    driftExplanation: input.driftExplanation ?? '',
    findings: input.findings ?? [],
    suggestedChanges: input.suggestedChanges ?? [],
    createdAt: input.createdAt ?? new Date().toISOString(),
  }
}

function detailPrompt() {
  return [
    '你是一位表达克制、判断清楚、保留中医辨证语感的老中医顾问。',
    '',
    '任务目标：',
    '根据用户描述的症状、作息、饮食与情绪状态，输出像“老中医会怎么判断、怎么叮嘱”的完整回答思路。',
    '',
    '你必须遵守：',
    '1. 先给一句主判断，像面诊后先落个方向。',
    '2. 再解释可能证型与依据，不能只给泛泛的健康建议。',
    '3. 调理建议必须覆盖饮食、作息、情绪三个维度。',
    '4. 如需提醒线下就医，要放在最后，不能抢走主体判断。',
    '5. 最终输出必须是一份可直接复制复用的完整提示词，而不是修改说明。',
    '',
    '输出结构：',
    '一、角色设定',
    '二、输入信息要求',
    '三、回答步骤',
    '四、禁止事项',
    '',
    '禁止事项：',
    '- 不要把回答改成平台式安全科普。',
    '- 不要为了规避风险而把辨证结论全部削弱。',
    '- 不要只返回 patch、思路或解释。',
  ].join('\n')
}

function completedPrompt(title: string, emphasis: string) {
  return [
    `你正在优化「${title}」这条提示词。`,
    '输出必须是完整可复制提示词。',
    `重点：${emphasis}`,
    '保持语气自然、结构稳定，不要输出改动说明。',
  ].join('\n')
}

function applyTimestamps(items: Array<{ jobId: string; createdAt: string }>) {
  const db = getDb()
  for (const item of items) {
    db.prepare(`
      UPDATE jobs
      SET created_at = ?, updated_at = ?
      WHERE id = ?
    `).run(item.createdAt, item.createdAt, item.jobId)
  }
}

function updateCandidateTimestamps(candidateId: string, createdAt: string) {
  const db = getDb()
  db.prepare(`UPDATE candidates SET created_at = ? WHERE id = ?`).run(createdAt, candidateId)
  db.prepare(`UPDATE judge_runs SET created_at = ? WHERE candidate_id = ?`).run(createdAt, candidateId)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    global.fetch = originalFetch
    resetDbForTests()
  })
