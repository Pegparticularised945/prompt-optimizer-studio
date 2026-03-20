import { createProviderAdapter } from '@/lib/server/providers/index'
import { validateCpamcConnection } from '@/lib/server/settings/index'
import type { AppSettings, ModelCatalogItem } from '@/lib/contracts'

interface OpenAiModelListResponse {
  data?: Array<{
    id?: string
  }>
}

export function normalizeModelCatalog(payload: OpenAiModelListResponse): string[] {
  const seen = new Set<string>()
  const models: string[] = []

  for (const rawId of payload.data?.map((item) => item.id) ?? []) {
    if (typeof rawId !== 'string') {
      continue
    }

    const trimmed = rawId.trim().replace(/^models\//i, '')
    const alias = trimmed.split('/').filter(Boolean).at(-1)?.trim()
    if (!alias || seen.has(alias)) {
      continue
    }

    seen.add(alias)
    models.push(alias)
  }

  return models
}

export async function fetchCpamcModels(
  settings: Pick<AppSettings, 'cpamcBaseUrl' | 'cpamcApiKey'> & Partial<Pick<AppSettings, 'apiProtocol'>>,
): Promise<ModelCatalogItem[]> {
  validateCpamcConnection(settings)
  return createProviderAdapter(settings).listModels()
}
