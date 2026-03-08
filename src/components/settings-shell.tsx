'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { getConversationPolicyLabel } from '@/lib/presentation'

interface SettingsForm {
  cpamcBaseUrl: string
  cpamcApiKey: string
  defaultTaskModel: string
  scoreThreshold: number
  judgePassCount: number
  maxRounds: number
  noImprovementLimit: number
  workerConcurrency: number
  conversationPolicy: 'stateless' | 'pooled-3x'
}

interface ModelOption {
  id: string
  label: string
}

const DEFAULT_FORM: SettingsForm = {
  cpamcBaseUrl: '',
  cpamcApiKey: '',
  defaultTaskModel: '',
  scoreThreshold: 95,
  judgePassCount: 3,
  maxRounds: 8,
  noImprovementLimit: 2,
  workerConcurrency: 1,
  conversationPolicy: 'stateless',
}

export function SettingsShell() {
  const [form, setForm] = useState<SettingsForm>(DEFAULT_FORM)
  const [models, setModels] = useState<ModelOption[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [settingsResponse, modelsResponse] = await Promise.all([
          fetch('/api/settings', { cache: 'no-store' }),
          fetch('/api/settings/models', { cache: 'no-store' }),
        ])
        const settingsPayload = await settingsResponse.json()
        const modelsPayload = await modelsResponse.json()

        if (!settingsResponse.ok) {
          throw new Error(settingsPayload.error ?? 'Failed to load settings.')
        }

        if (!cancelled) {
          setForm({
            cpamcBaseUrl: settingsPayload.settings.cpamcBaseUrl,
            cpamcApiKey: settingsPayload.settings.cpamcApiKey,
            defaultTaskModel: settingsPayload.settings.defaultOptimizerModel,
            scoreThreshold: settingsPayload.settings.scoreThreshold,
            judgePassCount: settingsPayload.settings.judgePassCount,
            maxRounds: settingsPayload.settings.maxRounds,
            noImprovementLimit: settingsPayload.settings.noImprovementLimit,
            workerConcurrency: settingsPayload.settings.workerConcurrency,
            conversationPolicy: settingsPayload.settings.conversationPolicy,
          })
          setModels(modelsResponse.ok ? modelsPayload.models : [])
          setError(modelsResponse.ok ? null : modelsPayload.error ?? null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load settings.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function save() {
    setSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpamcBaseUrl: form.cpamcBaseUrl,
          cpamcApiKey: form.cpamcApiKey,
          defaultOptimizerModel: form.defaultTaskModel,
          defaultJudgeModel: form.defaultTaskModel,
          scoreThreshold: form.scoreThreshold,
          judgePassCount: form.judgePassCount,
          maxRounds: form.maxRounds,
          noImprovementLimit: form.noImprovementLimit,
          workerConcurrency: form.workerConcurrency,
          conversationPolicy: form.conversationPolicy,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to save settings.')
      }
      setForm((current) => ({
        ...current,
        defaultTaskModel: payload.settings.defaultOptimizerModel,
      }))
      setMessage('设置已保存。')
      setError(null)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save settings.')
      setMessage(null)
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    setTesting(true)
    try {
      const response = await fetch('/api/settings/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpamcBaseUrl: form.cpamcBaseUrl,
          cpamcApiKey: form.cpamcApiKey,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error ?? 'Connection test failed.')
      }
      setModels(payload.models ?? [])
      setMessage(payload.message ?? '连接测试通过。')
      setError(null)
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'Connection test failed.')
      setMessage(null)
    } finally {
      setTesting(false)
    }
  }

  async function refreshModels() {
    setLoadingModels(true)
    try {
      const response = await fetch('/api/settings/models', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to fetch models.')
      }
      setModels(payload.models)
      setMessage(`已刷新 ${payload.models.length} 个模型别名。`)
      setError(null)
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Failed to fetch models.')
      setMessage(null)
    } finally {
      setLoadingModels(false)
    }
  }

  return (
    <main>
      <div className="shell">
        <section className="hero">
          <div className="nav-row">
            <span className="pill pending">CPAMC 设置</span>
            <Link href="/" className="link">返回队列</Link>
          </div>
          <div className="hero-grid">
            <div>
              <h1>只选一个任务模型别名。</h1>
            </div>
            <div>
              <p>
                这里保存的是默认任务模型别名。你选 `gpt-5.2`，优化器和裁判都会自动用它，provider 路由全部交给 `CPAMC`。
              </p>
            </div>
          </div>
        </section>

        <section className="panel">
          {loading ? <div className="notice">正在加载设置...</div> : null}
          <div className="form-grid">
            <label className="label">
              CPAMC Base URL
              <input className="input" value={form.cpamcBaseUrl} onChange={(event) => setForm((current) => ({ ...current, cpamcBaseUrl: event.target.value }))} placeholder="http://localhost:8317/v1" />
            </label>
            <label className="label">
              API Key
              <input className="input" type="password" value={form.cpamcApiKey} onChange={(event) => setForm((current) => ({ ...current, cpamcApiKey: event.target.value }))} placeholder="sk-..." />
            </label>
            <label className="label">
              默认任务模型别名
              <input className="input" list="cpamc-models" value={form.defaultTaskModel} onChange={(event) => setForm((current) => ({ ...current, defaultTaskModel: event.target.value }))} placeholder="例如：gpt-5.2" />
            </label>
            <label className="label">
              分数阈值
              <input className="input" type="number" value={form.scoreThreshold} onChange={(event) => setForm((current) => ({ ...current, scoreThreshold: Number(event.target.value) }))} />
            </label>
            <label className="label">
              裁判数量
              <input className="input" type="number" value={form.judgePassCount} onChange={(event) => setForm((current) => ({ ...current, judgePassCount: Number(event.target.value) }))} />
            </label>
            <label className="label">
              最大轮数
              <input className="input" type="number" value={form.maxRounds} onChange={(event) => setForm((current) => ({ ...current, maxRounds: Number(event.target.value) }))} />
            </label>
            <label className="label">
              无提升上限
              <input className="input" type="number" value={form.noImprovementLimit} onChange={(event) => setForm((current) => ({ ...current, noImprovementLimit: Number(event.target.value) }))} />
            </label>
            <label className="label">
              并发数
              <input className="input" type="number" value={form.workerConcurrency} onChange={(event) => setForm((current) => ({ ...current, workerConcurrency: Number(event.target.value) }))} />
            </label>
            <label className="label">
              会话策略
              <select className="select" value={form.conversationPolicy} onChange={(event) => setForm((current) => ({ ...current, conversationPolicy: event.target.value as SettingsForm['conversationPolicy'] }))}>
                <option value="stateless">{getConversationPolicyLabel('stateless')}</option>
                <option value="pooled-3x">{getConversationPolicyLabel('pooled-3x')}</option>
              </select>
            </label>
          </div>
          <datalist id="cpamc-models">
            {models.map((model) => <option key={model.id} value={model.id} />)}
          </datalist>
          <div className="button-row">
            <button className="button ghost" type="button" onClick={refreshModels} disabled={loadingModels}>
              {loadingModels ? '刷新中...' : '刷新模型别名'}
            </button>
            <button className="button secondary" type="button" onClick={testConnection} disabled={testing}>
              {testing ? '测试中...' : '测试连接'}
            </button>
            <button className="button" type="button" onClick={save} disabled={saving}>
              {saving ? '保存中...' : '保存设置'}
            </button>
          </div>
          <div className="panel-grid">
            <div className="notice">
              当前可用模型别名：{models.length > 0 ? `${models.length} 个` : '尚未拉到，仍可手动输入别名。'}
            </div>
            <div className="notice">
              默认任务模型只影响新任务，不会改动旧任务快照。当前会话策略：{getConversationPolicyLabel(form.conversationPolicy)}
            </div>
          </div>
          {models.length > 0 ? (
            <div className="inline-actions">
              {models.map((model) => <span key={model.id} className="pill pending">{model.label}</span>)}
            </div>
          ) : null}
          {message ? <div className="notice success">{message}</div> : null}
          {error ? <div className="notice error">{error}</div> : null}
        </section>
      </div>
    </main>
  )
}
