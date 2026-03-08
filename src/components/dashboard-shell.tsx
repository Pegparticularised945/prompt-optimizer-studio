'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import {
  focusDashboardJobs,
  getConversationPolicyLabel,
  getJobDisplayError,
  getJobStatusLabel,
  getPromptPreview,
  partitionDashboardJobs,
} from '@/lib/presentation'

type JobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'manual_review' | 'cancelled'

interface JobRecord {
  id: string
  title: string
  status: JobStatus
  currentRound: number
  bestAverageScore: number
  latestPrompt: string
  errorMessage: string | null
  createdAt: string
  conversationPolicy: 'stateless' | 'pooled-3x'
  optimizerModel: string
  judgeModel: string
}

interface ModelOption {
  id: string
  label: string
}

interface DraftJob {
  id: string
  title: string
  rawPrompt: string
  optimizerModel: string
  judgeModel: string
}

interface SettingsPayload {
  defaultOptimizerModel: string
  defaultJudgeModel: string
  conversationPolicy: 'stateless' | 'pooled-3x'
}

function createEmptyDraft(defaults?: SettingsPayload): DraftJob {
  return {
    id: crypto.randomUUID(),
    title: '',
    rawPrompt: '',
    optimizerModel: defaults?.defaultOptimizerModel ?? '',
    judgeModel: defaults?.defaultJudgeModel ?? '',
  }
}

export function DashboardShell() {
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [models, setModels] = useState<ModelOption[]>([])
  const [settings, setSettings] = useState<SettingsPayload>({
    defaultOptimizerModel: '',
    defaultJudgeModel: '',
    conversationPolicy: 'stateless',
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [actionableOnly, setActionableOnly] = useState(false)
  const [actionInFlight, setActionInFlight] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<DraftJob[]>([createEmptyDraft()])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [jobsResponse, settingsResponse, modelsResponse] = await Promise.all([
          fetch('/api/jobs', { cache: 'no-store' }),
          fetch('/api/settings', { cache: 'no-store' }),
          fetch('/api/settings/models', { cache: 'no-store' }),
        ])
        const jobsPayload = await jobsResponse.json()
        const settingsPayload = await settingsResponse.json()
        const modelsPayload = await modelsResponse.json()

        if (!jobsResponse.ok) {
          throw new Error(jobsPayload.error ?? 'Failed to load jobs.')
        }
        if (!settingsResponse.ok) {
          throw new Error(settingsPayload.error ?? 'Failed to load settings.')
        }

        if (!cancelled) {
          const nextDefaults = {
            defaultOptimizerModel: settingsPayload.settings.defaultOptimizerModel,
            defaultJudgeModel: settingsPayload.settings.defaultJudgeModel,
            conversationPolicy: settingsPayload.settings.conversationPolicy,
          }
          setJobs(jobsPayload.jobs)
          setSettings(nextDefaults)
          setModels(modelsResponse.ok ? modelsPayload.models : [])
          setDrafts((current) => current.map((draft, index) => (
            index === 0 && !draft.optimizerModel && !draft.judgeModel && !draft.rawPrompt && !draft.title
              ? createEmptyDraft(nextDefaults)
              : draft
          )))
          setError(modelsResponse.ok ? null : modelsPayload.error ?? null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load dashboard.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    const timer = setInterval(() => {
      void load()
    }, 3000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const groupedJobs = useMemo(() => partitionDashboardJobs(jobs), [jobs])
  const visibleGroups = useMemo(() => focusDashboardJobs(groupedJobs, actionableOnly), [groupedJobs, actionableOnly])
  const stats = useMemo(() => {
    return {
      active: groupedJobs.active.length,
      queued: groupedJobs.queued.length,
      recentCompleted: groupedJobs.recentCompleted.length,
      history: groupedJobs.history.length,
    }
  }, [groupedJobs])

  async function submitJobs() {
    const payload = drafts
      .map((draft) => ({
        title: draft.title.trim(),
        rawPrompt: draft.rawPrompt.trim(),
        optimizerModel: draft.optimizerModel.trim(),
        judgeModel: draft.judgeModel.trim(),
      }))
      .filter((draft) => draft.rawPrompt)

    if (payload.length === 0) {
      setError('至少填写一个初版提示词。')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs: payload }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error ?? 'Failed to create jobs.')
      }
      setDrafts([createEmptyDraft(settings)])
      setJobs((current) => [...result.jobs, ...current])
      setError(null)
      setActionMessage(null)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create jobs.')
    } finally {
      setSubmitting(false)
    }
  }

  async function copyLatestPrompt(job: JobRecord) {
    try {
      await writeClipboard(job.latestPrompt)
      setActionMessage(`已复制「${job.title}」的最新提示词。`)
      setError(null)
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : '复制失败。')
      setActionMessage(null)
    }
  }

  async function resumeStep(job: JobRecord) {
    setActionInFlight(`${job.id}:step`)
    try {
      const response = await fetch(`/api/jobs/${job.id}/resume-step`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error ?? 'Resume step failed.')
      }
      setJobs((current) => current.map((item) => (item.id === job.id ? payload.job : item)))
      setActionMessage(`「${job.title}」将继续一轮，完成后会自动回到暂停。`)
      setError(null)
    } catch (resumeError) {
      setError(resumeError instanceof Error ? resumeError.message : 'Resume step failed.')
      setActionMessage(null)
    } finally {
      setActionInFlight(null)
    }
  }

  async function resumeAuto(job: JobRecord) {
    setActionInFlight(`${job.id}:auto`)
    try {
      const response = await fetch(`/api/jobs/${job.id}/resume-auto`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error ?? 'Resume auto failed.')
      }
      setJobs((current) => current.map((item) => (item.id === job.id ? payload.job : item)))
      setActionMessage(`「${job.title}」已恢复自动运行。`)
      setError(null)
    } catch (resumeError) {
      setError(resumeError instanceof Error ? resumeError.message : 'Resume auto failed.')
      setActionMessage(null)
    } finally {
      setActionInFlight(null)
    }
  }

  return (
    <main>
      <div className="shell">
        <section className="hero">
          <div className="nav-row">
            <span className="pill running">Prompt Optimizer Studio</span>
            <Link href="/settings" className="link">设置 CPAMC</Link>
          </div>
          <div className="hero-grid">
            <div>
              <h1>按模型别名工作，不看 provider 路径。</h1>
            </div>
            <div>
              <p>
                现在只展示 `gpt-5.2`、`gpt-5.4` 这类模型别名。具体 provider 路由完全交给 `CPAMC` 自己处理。
              </p>
            </div>
          </div>
          <div className="stats-grid">
            <StatCard label="活跃任务" value={String(stats.active)} />
            <StatCard label="排队中" value={String(stats.queued)} />
            <StatCard label="最近完成" value={String(stats.recentCompleted)} />
            <StatCard label="历史任务" value={String(stats.history)} />
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="section-title">批量投递</h2>
              <p className="small">每张卡片都可以指定自己的优化模型别名和裁判模型别名。</p>
            </div>
            <div className="button-row">
              <button className="button ghost" type="button" onClick={() => setDrafts((current) => [...current, createEmptyDraft(settings)])}>
                新增一条
              </button>
              <button className="button" type="button" onClick={submitJobs} disabled={submitting}>
                {submitting ? '提交中...' : '提交到队列'}
              </button>
            </div>
          </div>
          <datalist id="cpamc-model-aliases">
            {models.map((model) => <option key={model.id} value={model.id} />)}
          </datalist>
          <div className="panel-grid">
            {drafts.map((draft, index) => (
              <div className="draft-card" key={draft.id}>
                <div className="card-header">
                  <strong>草稿 {index + 1}</strong>
                  {drafts.length > 1 ? (
                    <button className="button ghost" type="button" onClick={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))}>
                      删除
                    </button>
                  ) : null}
                </div>
                <label className="label">
                  标题
                  <input
                    className="input"
                    value={draft.title}
                    onChange={(event) => updateDraft(setDrafts, draft.id, 'title', event.target.value)}
                    placeholder="例如：Vibe Coding 计划审查器"
                  />
                </label>
                <label className="label">
                  优化模型别名
                  <input
                    className="input"
                    list="cpamc-model-aliases"
                    value={draft.optimizerModel}
                    onChange={(event) => updateDraft(setDrafts, draft.id, 'optimizerModel', event.target.value)}
                    placeholder={settings.defaultOptimizerModel || '例如：gpt-5.2'}
                  />
                </label>
                <label className="label">
                  裁判模型别名
                  <input
                    className="input"
                    list="cpamc-model-aliases"
                    value={draft.judgeModel}
                    onChange={(event) => updateDraft(setDrafts, draft.id, 'judgeModel', event.target.value)}
                    placeholder={settings.defaultJudgeModel || '例如：gpt-5.2'}
                  />
                </label>
                <label className="label">
                  初版提示词
                  <textarea
                    className="textarea"
                    value={draft.rawPrompt}
                    onChange={(event) => updateDraft(setDrafts, draft.id, 'rawPrompt', event.target.value)}
                    placeholder="贴入一句话需求、初版 prompt，或待优化长提示词。"
                  />
                </label>
              </div>
            ))}
          </div>
          <div className="panel-grid">
            <div className="notice">
              {models.length > 0 ? `已发现 ${models.length} 个模型别名，可直接选择。` : '模型别名列表暂时不可用，仍可手动输入别名。'}
            </div>
            <div className="notice">
              默认优化模型：{settings.defaultOptimizerModel || '未配置'} | 默认裁判模型：{settings.defaultJudgeModel || '未配置'} | 会话策略：{getConversationPolicyLabel(settings.conversationPolicy)}
            </div>
          </div>
          {actionMessage ? <div className="notice success">{actionMessage}</div> : null}
          {error ? <div className="notice error">{error}</div> : null}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="section-title">任务看板</h2>
              <p className="small">
                {actionableOnly
                  ? '当前仅显示你现在要处理的任务，并按优先级排序：人工复核、已暂停、运行中。'
                  : '页面会自动轮询。首页只强调现在该处理的任务和最新完成结果，其余历史任务收起。'}
              </p>
            </div>
            <div className="button-row">
              <button
                className={`button ghost dashboard-toggle${actionableOnly ? ' active' : ''}`}
                type="button"
                onClick={() => setActionableOnly((current) => !current)}
              >
                {actionableOnly ? '恢复完整看板' : '只看我现在要处理的'}
              </button>
            </div>
          </div>

          {loading ? <div className="notice">正在读取任务列表...</div> : null}
          {!loading && jobs.length === 0 ? (
            <div className="notice">队列还是空的，先在上面投递几条提示词。</div>
          ) : null}

          {!loading && jobs.length > 0 ? (
            <div className="shell">
              <DashboardJobSection
                title="活跃任务"
                description={actionableOnly ? '这里只显示需要你立即关注的任务。' : '优先处理正在运行、已暂停和待人工复核的任务。'}
                jobs={visibleGroups.active}
                emptyMessage="当前没有需要立即处理的活跃任务。"
                actionInFlight={actionInFlight}
                onCopyPrompt={copyLatestPrompt}
                onResumeAuto={resumeAuto}
                onResumeStep={resumeStep}
              />
              {!actionableOnly ? (
                <DashboardJobSection
                  title="排队中"
                  description="这些任务已经入队，等待进入优化流程。"
                  jobs={visibleGroups.queued}
                  emptyMessage="当前没有排队中的任务。"
                  actionInFlight={actionInFlight}
                  onCopyPrompt={copyLatestPrompt}
                  onResumeAuto={resumeAuto}
                  onResumeStep={resumeStep}
                />
              ) : null}
              {!actionableOnly ? (
                <DashboardJobSection
                  title="最近完成"
                  description="这里只保留最近 3 条完成任务，方便你快速回到最新结果。"
                  jobs={visibleGroups.recentCompleted}
                  emptyMessage="最近还没有完成的任务。"
                  actionInFlight={actionInFlight}
                  onCopyPrompt={copyLatestPrompt}
                  onResumeAuto={resumeAuto}
                  onResumeStep={resumeStep}
                />
              ) : null}
              {!actionableOnly ? (
                <details className="history-panel">
                  <summary>历史任务（{visibleGroups.history.length}）</summary>
                  <p className="small">这里收纳较旧的完成任务，以及失败或取消的任务，默认不打扰主视图。</p>
                  {visibleGroups.history.length === 0 ? (
                    <div className="notice">暂无历史任务。</div>
                  ) : (
                    <div className="job-grid history-grid">
                      {visibleGroups.history.map((job) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          subdued
                          actionInFlight={actionInFlight}
                          onCopyPrompt={copyLatestPrompt}
                          onResumeAuto={resumeAuto}
                          onResumeStep={resumeStep}
                        />
                      ))}
                    </div>
                  )}
                </details>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}

async function writeClipboard(text: string) {
  await navigator.clipboard.writeText(text)
}

function updateDraft(
  setDrafts: React.Dispatch<React.SetStateAction<DraftJob[]>>,
  draftId: string,
  field: keyof Omit<DraftJob, 'id'>,
  value: string,
) {
  setDrafts((current) => current.map((draft) => (draft.id === draftId ? { ...draft, [field]: value } : draft)))
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="small">{label}</div>
      <div className="section-title">{value}</div>
    </div>
  )
}

function DashboardJobSection({
  title,
  description,
  jobs,
  emptyMessage,
  actionInFlight,
  onCopyPrompt,
  onResumeAuto,
  onResumeStep,
}: {
  title: string
  description: string
  jobs: JobRecord[]
  emptyMessage: string
  actionInFlight: string | null
  onCopyPrompt: (job: JobRecord) => Promise<void>
  onResumeAuto: (job: JobRecord) => Promise<void>
  onResumeStep: (job: JobRecord) => Promise<void>
}) {
  return (
    <section className="dashboard-section">
      <div className="panel-header">
        <div>
          <h3 className="section-title">{title}</h3>
          <p className="small">{description}</p>
        </div>
      </div>
      {jobs.length === 0 ? (
        <div className="notice">{emptyMessage}</div>
      ) : (
        <div className="job-grid">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              actionInFlight={actionInFlight}
              onCopyPrompt={onCopyPrompt}
              onResumeAuto={onResumeAuto}
              onResumeStep={onResumeStep}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function JobCard({
  job,
  subdued = false,
  actionInFlight,
  onCopyPrompt,
  onResumeAuto,
  onResumeStep,
}: {
  job: JobRecord
  subdued?: boolean
  actionInFlight: string | null
  onCopyPrompt: (job: JobRecord) => Promise<void>
  onResumeAuto: (job: JobRecord) => Promise<void>
  onResumeStep: (job: JobRecord) => Promise<void>
}) {
  const canAct = job.status === 'manual_review' || job.status === 'paused'
  const preview = getPromptPreview(job.latestPrompt, 120)

  return (
    <article className={`job-card${subdued ? ' subdued' : ''}${subdued ? '' : ` priority-${job.status}`}`}>
      <div className="card-header">
        <strong>{job.title}</strong>
        <span className={`status ${job.status}`}>{getJobStatusLabel(job.status)}</span>
      </div>
      <div className="stat-line meta">
        <span>轮次 {job.currentRound}</span>
        <span>最佳均分 {job.bestAverageScore.toFixed(2)}</span>
      </div>
      <div className="stat-line meta">
        <span>优化：{job.optimizerModel}</span>
        <span>裁判：{job.judgeModel}</span>
      </div>
      <div className="stat-line meta">
        <span>会话：{getConversationPolicyLabel(job.conversationPolicy)}</span>
        <span>{formatDate(job.createdAt)}</span>
      </div>
      <div className="prompt-preview-block">
        <strong>最新提示词摘要</strong>
        <p className="small prompt-preview-text">{preview}</p>
      </div>
      <div className="button-row">
        <button className="button ghost" type="button" onClick={() => void onCopyPrompt(job)}>
          复制最新提示词
        </button>
        {canAct ? (
          <button
            className="button secondary"
            type="button"
            onClick={() => void onResumeStep(job)}
            disabled={actionInFlight === `${job.id}:step`}
          >
            {actionInFlight === `${job.id}:step` ? '处理中...' : '继续一轮'}
          </button>
        ) : null}
        {canAct ? (
          <button
            className="button secondary"
            type="button"
            onClick={() => void onResumeAuto(job)}
            disabled={actionInFlight === `${job.id}:auto`}
          >
            {actionInFlight === `${job.id}:auto` ? '处理中...' : '恢复自动运行'}
          </button>
        ) : null}
        <Link href={`/jobs/${job.id}${canAct ? '#next-round-steering' : ''}`} className="button ghost">
          {canAct ? '打开详情并编辑引导' : '打开详情'}
        </Link>
      </div>
      {getJobDisplayError(job.errorMessage) ? <div className="notice error">{getJobDisplayError(job.errorMessage)}</div> : null}
    </article>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
