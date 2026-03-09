import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  BrainCircuit,
  ClipboardList,
  Copy,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  WandSparkles,
} from 'lucide-react'

import { JobRoundCard, type RoundCandidateView } from '@/components/job-round-card'
import type { SteeringItem } from '@/lib/server/types'
import { getConversationPolicyLabel, getJobDisplayError, getJobStatusLabel } from '@/lib/presentation'

export type JobDetailViewModel = {
  jobId: string
  title: string
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'manual_review' | 'cancelled'
  conversationPolicy: 'stateless' | 'pooled-3x'
  optimizerModel: string
  judgeModel: string
  pendingOptimizerModel: string | null
  pendingJudgeModel: string | null
  cancelRequestedAt: string | null
  pauseRequestedAt: string | null
  pendingSteeringItems: SteeringItem[]
  goalAnchor: {
    goal: string
    deliverable: string
    driftGuard: string[]
  }
  goalAnchorExplanation: {
    sourceSummary: string
    rationale: string[]
  }
  runMode: 'auto' | 'step'
  currentRound: number
  bestAverageScore: number
  maxRoundsOverride: number | null
  passStreak: number
  lastReviewScore: number
  errorMessage: string | null
  latestFullPrompt: string
  modelsLabel: string
  effectiveMaxRounds: number
  candidates: RoundCandidateView[]
}

export function JobDetailControlRoom({
  model,
  models,
  ui,
  form,
  handlers,
}: {
  model: JobDetailViewModel
  models: Array<{ id: string; label: string }>
  ui: {
    loading: boolean
    error: string | null
    actionMessage: string | null
    savingModels: boolean
    savingMaxRounds: boolean
    savingSteering: boolean
    generatingGoalAnchorDraft: boolean
    savingGoalAnchor: boolean
    retrying: boolean
    cancelling: boolean
    pausing: boolean
    resumingStep: boolean
    resumingAuto: boolean
    copyingPrompt: boolean
    expandedRounds: Record<string, boolean>
  }
  form: {
    taskModel: string
    maxRoundsOverrideValue: string
    pendingSteeringInput: string
    goalAnchorGoal: string
    goalAnchorDeliverable: string
    goalAnchorDriftGuardText: string
    goalAnchorDraftReady: boolean
  }
  handlers: {
    onRetry: () => void
    onSaveModel: () => void
    onSaveMaxRoundsOverride: () => void
    onAddPendingSteering: () => void
    onRemovePendingSteeringItem: (itemId: string) => void
    onClearPendingSteering: () => void
    onGenerateGoalAnchorDraft: () => void
    onSaveGoalAnchor: () => void
    onPauseTask: () => void
    onResumeStep: () => void
    onResumeAuto: () => void
    onCancelTask: () => void
    onCopyLatestPrompt: () => void
    onToggleRound: (candidateId: string) => void
    onTaskModelChange: (value: string) => void
    onMaxRoundsOverrideChange: (value: string) => void
    onPendingSteeringInputChange: (value: string) => void
    onGoalAnchorGoalChange: (value: string) => void
    onGoalAnchorDeliverableChange: (value: string) => void
    onGoalAnchorDriftGuardChange: (value: string) => void
  }
}) {
  const canEdit = model.status !== 'completed'
  const canSteer = !['completed', 'cancelled'].includes(model.status)
  const canRestart = ['pending', 'paused', 'failed', 'manual_review', 'cancelled'].includes(model.status)
  const canCancel = !['completed', 'cancelled'].includes(model.status)
  const canPause = !['completed', 'cancelled', 'paused'].includes(model.status)
  const canResume = !['completed', 'cancelled', 'running'].includes(model.status)
  const hasPendingSteering = model.pendingSteeringItems.length > 0

  return (
    <div className="detail-control-room">
      <section className="detail-hero">
        <div className="nav-row">
          <Link href="/" className="link nav-chip"><ArrowLeft size={16} /> 返回控制室</Link>
          <Link href="/settings" className="link nav-chip"><Settings2 size={16} /> 设置</Link>
        </div>
        <div className="detail-hero-grid">
          <div>
            <span className="eyebrow"><Sparkles size={16} /> 结果台</span>
            <h1>{model.title}</h1>
            <p className="hero-lead">先确认最终结果，再检查目标理解，最后决定是否继续推进任务。</p>
          </div>
          <div className="summary-cluster">
            <SummaryBadge label="状态" value={getJobStatusLabel(model.status)} tone={model.status} />
            <SummaryBadge label="任务模型" value={model.modelsLabel} />
            <SummaryBadge label="运行模式" value={model.runMode === 'step' ? '单步' : '自动'} />
            <SummaryBadge label="轮数上限" value={String(model.effectiveMaxRounds)} />
            <SummaryBadge label="最佳分数" value={model.bestAverageScore.toFixed(2)} />
            <SummaryBadge label="会话" value={getConversationPolicyLabel(model.conversationPolicy)} />
          </div>
        </div>
      </section>

      <AnimatePresence>
        {getDetailNoticeItems({
          loading: ui.loading,
          actionMessage: ui.actionMessage,
          error: ui.error,
          displayError: getJobDisplayError(model.errorMessage),
        }).map((notice) => (
          <motion.div
            key={notice.key}
            initial={{ opacity: 0, y: notice.tone === 'info' ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={`notice${notice.tone === 'success' ? ' success' : notice.tone === 'error' ? ' error' : ''}`}
          >
            {notice.text}
          </motion.div>
        ))}
      </AnimatePresence>

      <section className="result-stage">
        <div className="section-head">
          <div>
            <span className="eyebrow"><Copy size={16} /> 结果优先</span>
            <h2 className="section-title">当前最新完整提示词</h2>
            <p className="small">这是你现在最应该复制和判断的版本。后续所有诊断都只是为这个结果服务。</p>
          </div>
          <button className="button primary-action" type="button" onClick={handlers.onCopyLatestPrompt} disabled={ui.copyingPrompt}>
            {ui.copyingPrompt ? '复制中...' : '复制完整提示词'}
          </button>
        </div>
        <pre className="pre result-pre">{model.latestFullPrompt}</pre>
      </section>

      <section className="understanding-stage">
        <div className="understanding-grid">
          <div className="panel understanding-panel">
            <div className="section-head">
              <div>
                <span className="eyebrow"><ShieldCheck size={16} /> 目标理解层</span>
                <h2 className="section-title">{hasPendingSteering ? '当前有效目标视图' : '核心目标锚点'}</h2>
                <p className="small">
                  {hasPendingSteering
                    ? '稳定锚点保持不变，待生效引导会作为下一轮的一次性补充。'
                    : '这里定义任务不能漂移的核心目标与关键交付物。'}
                </p>
              </div>
            </div>
            <div className="active-goal-grid">
              <ReadonlyGoalField
                label="稳定目标"
                value={model.goalAnchor.goal}
                hint="这是长期稳定约束，不会因为临时人工引导而被自动改写。"
              />
              <ReadonlyGoalField
                label="稳定交付物"
                value={model.goalAnchor.deliverable}
                hint="后续轮次必须继续产出这类最终结果。"
              />
              <ReadonlyGoalField
                label="稳定边界"
                value={model.goalAnchor.driftGuard.join('\n')}
                hint="这些防漂移条款持续生效，直到你主动保存新的稳定锚点。"
              />
            </div>
            {hasPendingSteering ? (
              <div className="pending-steering-stack">
                <div className="section-head compact-head">
                  <div>
                    <strong>待生效引导</strong>
                    <p className="small">这些引导会按当前顺序进入下一轮 optimizer，但不会直接改写稳定锚点字段。</p>
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {model.pendingSteeringItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      className="steering-card"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0, y: -6 }}
                    >
                      <div className="steering-card-head">
                        <span className="pill pending">待生效 {index + 1}</span>
                        <span className="small">下一轮消费</span>
                      </div>
                      <p>{item.text}</p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : null}

            <details className="anchor-editor-drawer">
              <summary>{canEdit ? '编辑稳定锚点' : '查看稳定锚点'}</summary>
              <div className="anchor-editor-body">
                <div className="section-head compact-head">
                  <div>
                    <strong>稳定锚点编辑区</strong>
                    <p className="small">只有你确认保存后，新的长期规则才会生效。临时引导不会自动写进这里。</p>
                  </div>
                  {canEdit ? (
                    <button className="button ghost" type="button" onClick={handlers.onSaveGoalAnchor} disabled={ui.savingGoalAnchor}>
                      {ui.savingGoalAnchor ? '保存中...' : '保存稳定锚点'}
                    </button>
                  ) : null}
                </div>
                <div className="form-grid anchor-editor-grid">
                  <label className="label">
                    核心目标
                    <textarea className="textarea" value={form.goalAnchorGoal} onChange={(event) => handlers.onGoalAnchorGoalChange(event.target.value)} disabled={!canEdit} />
                  </label>
                  <label className="label">
                    关键交付物
                    <textarea className="textarea" value={form.goalAnchorDeliverable} onChange={(event) => handlers.onGoalAnchorDeliverableChange(event.target.value)} disabled={!canEdit} />
                  </label>
                  <label className="label">
                    防漂移条款
                    <textarea className="textarea" value={form.goalAnchorDriftGuardText} onChange={(event) => handlers.onGoalAnchorDriftGuardChange(event.target.value)} disabled={!canEdit} />
                  </label>
                </div>
                {form.goalAnchorDraftReady ? (
                  <div className="goal-anchor-draft-note">
                    <strong>已生成合并草案</strong>
                    <p className="small">保存后，这一组待生效引导会被吸收进稳定锚点并从待办列表清空。</p>
                  </div>
                ) : null}
              </div>
            </details>
          </div>

          <div className="panel explanation-panel">
            <div className="section-head">
              <div>
                <span className="eyebrow"><BrainCircuit size={16} /> 辅助判断</span>
                <h2 className="section-title">提炼解释</h2>
                <p className="small">先看稳定解释，再看这组临时引导会怎样改变下一轮。</p>
              </div>
            </div>
            <div className="explanation-card">
              <strong>稳定解释</strong>
              <p className="small"><strong>原始任务摘要：</strong>{model.goalAnchorExplanation.sourceSummary}</p>
              <ul className="list compact-list">
                {model.goalAnchorExplanation.rationale.map((item, index) => (
                  <li key={`goal-rationale-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
            {hasPendingSteering ? (
              <div className="explanation-card steering-impact-card">
                <strong>当前这组引导会怎样影响下一轮</strong>
                <ul className="list compact-list">
                  {model.pendingSteeringItems.map((item) => (
                    <li key={`impact-${item.id}`}>{item.text}</li>
                  ))}
                  <li>optimizer 会按当前顺序吸收这组引导，再基于完整提示词做最小必要改动。</li>
                  <li>reviewer 不会看到这些引导原文，只会看到下一轮产出的候选提示词。</li>
                  <li>如果下一轮把其中内容写进完整提示词，后续轮次会继续受影响。</li>
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="control-stage">
        <div className="section-head">
          <div>
            <span className="eyebrow"><SlidersHorizontal size={16} /> 操作面板</span>
            <h2 className="section-title">任务控制</h2>
            <p className="small">只保留会影响下一步决策的控制项，避免控制和诊断混杂。</p>
          </div>
        </div>
        <datalist id="job-model-aliases">
          {models.map((modelOption) => <option key={modelOption.id} value={modelOption.id} />)}
        </datalist>
        <div className="control-form-layout">
          <div className="compact-control-grid">
            <label className="label compact-control-field">
              任务模型别名
              <input className="input" list="job-model-aliases" value={form.taskModel} onChange={(event) => handlers.onTaskModelChange(event.target.value)} disabled={!canEdit} />
            </label>
            <label className="label compact-control-field">
              任务级最大轮数
              <input className="input" type="number" min={1} max={99} value={form.maxRoundsOverrideValue} onChange={(event) => handlers.onMaxRoundsOverrideChange(event.target.value)} disabled={!canEdit} />
            </label>
          </div>
          <div className="steering-control-stack" id="next-round-steering">
            <label className="label steering-control-field">
              下一轮人工引导
              <textarea className="textarea" value={form.pendingSteeringInput} onChange={(event) => handlers.onPendingSteeringInputChange(event.target.value)} disabled={!canSteer} />
              <span className="small field-note">添加后进入待生效列表。运行中的任务会在下一轮消费它，不影响当前这一轮。</span>
            </label>
            <div className="button-row compact-actions">
              {canSteer ? (
                <button className="button ghost" type="button" onClick={handlers.onAddPendingSteering} disabled={ui.savingSteering}>
                  <Plus size={16} /> {ui.savingSteering ? '保存中...' : '加入待生效列表'}
                </button>
              ) : null}
              {canEdit ? (
                <button className="button ghost" type="button" onClick={handlers.onGenerateGoalAnchorDraft} disabled={!hasPendingSteering || ui.generatingGoalAnchorDraft}>
                  <WandSparkles size={16} /> {ui.generatingGoalAnchorDraft ? '生成中...' : '写入稳定锚点'}
                </button>
              ) : null}
              {canSteer && hasPendingSteering ? (
                <button className="button ghost" type="button" onClick={handlers.onClearPendingSteering} disabled={ui.savingSteering}>
                  <Trash2 size={16} /> 清空待生效引导
                </button>
              ) : null}
            </div>
            {hasPendingSteering ? (
              <div className="pending-steering-stack control-pending-list">
                <div className="section-head compact-head">
                  <div>
                    <strong>待生效引导卡片</strong>
                    <p className="small">可以逐条删除；不想长期生效的内容，就让它只影响下一轮。</p>
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {model.pendingSteeringItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      layout
                      className="steering-card steering-card-actionable"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0, y: -6 }}
                    >
                      <div className="steering-card-head">
                        <span className="pill paused">待生效 {index + 1}</span>
                        {canSteer ? (
                          <button className="icon-button" type="button" aria-label={`删除待生效引导 ${index + 1}`} onClick={() => handlers.onRemovePendingSteeringItem(item.id)} disabled={ui.savingSteering}>
                            <Trash2 size={16} />
                          </button>
                        ) : null}
                      </div>
                      <p>{item.text}</p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="empty-inline-state">
                <span className="small">当前没有待生效引导。要临时纠偏时，先在上面添加一条。</span>
              </div>
            )}
          </div>
        </div>
        <div className="button-row">
          {canEdit ? <button className="button" type="button" onClick={handlers.onSaveModel} disabled={ui.savingModels}>{ui.savingModels ? '保存中...' : '保存任务模型'}</button> : null}
          {canEdit ? <button className="button ghost" type="button" onClick={handlers.onSaveMaxRoundsOverride} disabled={ui.savingMaxRounds}>{ui.savingMaxRounds ? '保存中...' : '保存任务级轮数'}</button> : null}
          {canPause ? <button className="button secondary" type="button" onClick={handlers.onPauseTask} disabled={ui.pausing}>{ui.pausing ? '处理中...' : model.status === 'running' ? '暂停（本轮后）' : '暂停'}</button> : null}
          {canResume ? <button className="button secondary" type="button" onClick={handlers.onResumeStep} disabled={ui.resumingStep}><PlayCircle size={16} /> {ui.resumingStep ? '处理中...' : '继续一轮'}</button> : null}
          {canResume ? <button className="button secondary" type="button" onClick={handlers.onResumeAuto} disabled={ui.resumingAuto}><PlayCircle size={16} /> {ui.resumingAuto ? '处理中...' : '恢复自动运行'}</button> : null}
          {canRestart ? <button className="button ghost" type="button" onClick={handlers.onRetry} disabled={ui.retrying}><RefreshCcw size={16} /> {ui.retrying ? '处理中...' : '重新开始'}</button> : null}
          {canCancel ? <button className="button danger" type="button" onClick={handlers.onCancelTask} disabled={ui.cancelling}><PauseCircle size={16} /> {ui.cancelling ? '处理中...' : '取消任务'}</button> : null}
        </div>
      </section>

      <section className="diagnostic-stage">
        <div className="section-head">
          <div>
            <span className="eyebrow"><ClipboardList size={16} /> 深入诊断</span>
            <h2 className="section-title">优化过程诊断</h2>
            <p className="small">默认只露摘要。需要时再展开每一轮的完整诊断和复核细节。</p>
          </div>
        </div>
        {model.candidates.length === 0 ? <div className="notice">还没有产出候选稿。</div> : null}
        <motion.div layout className="shell">
          {model.candidates.map((candidate) => (
            <JobRoundCard
              key={candidate.id}
              candidate={candidate}
              expanded={Boolean(ui.expandedRounds[candidate.id])}
              onToggle={() => handlers.onToggleRound(candidate.id)}
            />
          ))}
        </motion.div>
      </section>
    </div>
  )
}

export function getDetailNoticeItems(input: {
  loading: boolean
  actionMessage: string | null
  error: string | null
  displayError: string | null
}) {
  const notices: Array<{ key: string; tone: 'info' | 'success' | 'error'; text: string }> = []

  if (input.loading) {
    notices.push({ key: 'loading', tone: 'info', text: '正在读取任务详情...' })
  }
  if (input.actionMessage) {
    notices.push({ key: 'action-message', tone: 'success', text: input.actionMessage })
  }
  if (input.error) {
    notices.push({ key: 'ui-error', tone: 'error', text: input.error })
  }
  if (input.displayError) {
    notices.push({ key: 'display-error', tone: 'error', text: input.displayError })
  }

  return notices
}

function SummaryBadge({
  label,
  value,
  tone = 'pending',
}: {
  label: string
  value: string
  tone?: JobDetailViewModel['status'] | 'pending'
}) {
  return (
    <div className={`summary-card tone-${tone}`}>
      <div className="small">{label}</div>
      <div className="summary-value">{value}</div>
    </div>
  )
}

function ReadonlyGoalField({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="active-goal-card">
      <div className="label">{label}</div>
      <div className="active-goal-value">{value}</div>
      <p className="small active-goal-hint">{hint}</p>
    </div>
  )
}
