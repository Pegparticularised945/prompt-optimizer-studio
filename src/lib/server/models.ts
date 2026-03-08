import type { AppSettings, ModelCatalogItem } from '@/lib/server/types'
import { validateCpamcConnection } from '@/lib/server/settings'

interface ModelListResponse {
  data?: Array<{
    id?: string
    owned_by?: string
  }>
}

export function normalizeModelCatalog(payload: ModelListResponse): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const item of payload.data ?? []) {
    const id = String(item.id ?? '').trim()
    if (!id || id.includes('/') || seen.has(id)) {
      continue
    }
    seen.add(id)
    result.push(id)
  }

  return result
}

export async function fetchCpamcModels(settings: Pick<AppSettings, 'cpamcBaseUrl' | 'cpamcApiKey'>): Promise<ModelCatalogItem[]> {
  validateCpamcConnection(settings)

  const endpoint = `${settings.cpamcBaseUrl.replace(/\/$/, '')}/models`
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${settings.cpamcApiKey}`,
    },
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`拉取模型列表失败 (${response.status}): ${text.slice(0, 300)}`)
  }

  const payload = await response.json() as ModelListResponse
  return normalizeModelCatalog(payload).map((id) => ({ id, label: id }))
}
