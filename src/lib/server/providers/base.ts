import type { ApiProtocol, AppSettings, ModelCatalogItem } from '@/lib/contracts'
import { type ReasoningEffort } from '@/lib/reasoning-effort'

export type { ApiProtocol } from '@/lib/contracts'

export interface ProviderJsonRequest {
  model: string
  system: string
  user: string
  timeoutMs: number
  maxAttempts?: number
  attemptTimeoutCapMs?: number
  reasoningEffort?: ReasoningEffort
}

export interface ProviderAdapter {
  protocol: Exclude<ApiProtocol, 'auto'>
  requestJson(input: ProviderJsonRequest): Promise<Record<string, unknown>>
  listModels(): Promise<ModelCatalogItem[]>
}

export type ProviderConnectionSettings = Pick<AppSettings, 'cpamcBaseUrl' | 'cpamcApiKey'> & Partial<Pick<AppSettings, 'apiProtocol'>>

export const DEFAULT_MODEL_REQUEST_ATTEMPT_TIMEOUT_CAP_MS = 60_000
export const DEFAULT_MODEL_REQUEST_MAX_ATTEMPTS = 2

export interface OpenAiModelListResponse {
  data?: Array<{ id?: string }>
}

export interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>
    }
  }>
  error?: { message?: string }
}

export interface OpenAiResponsesResponse {
  output?: Array<{
    type?: string
    role?: string
    content?: Array<{
      type?: string
      text?: string
    }>
  }>
  error?: { message?: string }
}

export interface AnthropicMessagesResponse {
  content?: Array<{
    type?: string
    text?: string
  }>
  error?: { message?: string }
}

export interface AnthropicModelListResponse {
  data?: Array<{ id?: string }>
}

export interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  promptFeedback?: { blockReason?: string }
  error?: { message?: string }
}

export interface GeminiModelListResponse {
  models?: Array<{
    name?: string
    supportedGenerationMethods?: string[]
  }>
}

export interface CohereChatResponse {
  message?: {
    content?: Array<{
      type?: string
      text?: string
    }>
  }
  error?: { message?: string }
}

export interface CohereModelListResponse {
  models?: Array<{ name?: string }>
}
