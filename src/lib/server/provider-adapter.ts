import { extractJsonObject } from '@/lib/server/json'
import type {
  ProviderEndpointKind,
  ProviderRequestLabel,
  ProviderRequestTelemetryEvent,
} from '@/lib/server/request-telemetry'
import type { ApiProtocol, AppSettings, ModelCatalogItem } from '@/lib/server/types'
import { isGpt5FamilyModel, normalizeReasoningEffort, type ReasoningEffort } from '@/lib/reasoning-effort'

export type { ApiProtocol } from '@/lib/server/types'

export interface ProviderJsonRequest {
  model: string
  system: string
  user: string
  timeoutMs: number
  maxAttempts?: number
  attemptTimeoutCapMs?: number
  reasoningEffort?: ReasoningEffort
  requestLabel?: ProviderRequestLabel
  endpointMode?: 'auto' | 'chat' | 'responses' | 'responses_preferred'
  telemetryCollector?: (event: ProviderRequestTelemetryEvent) => void
}

export interface ProviderAdapter {
  protocol: Exclude<ApiProtocol, 'auto'>
  requestJson(input: ProviderJsonRequest): Promise<Record<string, unknown>>
  listModels(): Promise<ModelCatalogItem[]>
}

type ProviderConnectionSettings = Pick<AppSettings, 'cpamcBaseUrl' | 'cpamcApiKey'> & Partial<Pick<AppSettings, 'apiProtocol'>>

const DEFAULT_MODEL_REQUEST_ATTEMPT_TIMEOUT_CAP_MS = 60_000
const GPT5_MEDIUM_REQUEST_ATTEMPT_TIMEOUT_CAP_MS = 120_000
const GPT5_HIGH_REQUEST_ATTEMPT_TIMEOUT_CAP_MS = 180_000
const GPT5_XHIGH_REQUEST_ATTEMPT_TIMEOUT_CAP_MS = 240_000
const DEFAULT_MODEL_REQUEST_MAX_ATTEMPTS = 2

interface OpenAiModelListResponse {
  data?: Array<{
    id?: string
  }>
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>
    }
  }>
  error?: {
    message?: string
  }
}

interface OpenAiResponsesResponse {
  output?: Array<{
    type?: string
    role?: string
    content?: Array<{
      type?: string
      text?: string
    }>
  }>
  error?: {
    message?: string
  }
}

interface AnthropicMessagesResponse {
  content?: Array<{
    type?: string
    text?: string
  }>
  error?: {
    message?: string
  }
}

interface AnthropicModelListResponse {
  data?: Array<{
    id?: string
  }>
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
  promptFeedback?: {
    blockReason?: string
  }
  error?: {
    message?: string
  }
}

interface GeminiModelListResponse {
  models?: Array<{
    name?: string
    supportedGenerationMethods?: string[]
  }>
}

interface CohereChatResponse {
  message?: {
    content?: Array<{
      type?: string
      text?: string
    }>
  }
  error?: {
    message?: string
  }
}

interface CohereModelListResponse {
  models?: Array<{
    name?: string
  }>
}

export function inferApiProtocol(baseUrl: string): ApiProtocol {
  const trimmed = baseUrl.trim()
  if (!trimmed) {
    return 'openai-compatible'
  }

  try {
    const url = new URL(trimmed)
    const host = url.hostname.toLowerCase()
    const path = url.pathname.toLowerCase()

    if (path.includes('/openai')) {
      return 'openai-compatible'
    }

    if (host === 'api.anthropic.com') {
      return 'anthropic-native'
    }

    if (host === 'generativelanguage.googleapis.com') {
      return 'gemini-native'
    }

    if (host === 'api.mistral.ai') {
      return 'mistral-native'
    }

    if (host === 'api.cohere.com') {
      return 'cohere-native'
    }
  } catch {
    return 'openai-compatible'
  }

  return 'openai-compatible'
}

export function createProviderAdapter(
  settings: ProviderConnectionSettings,
): ProviderAdapter {
  const protocol = settings.apiProtocol && settings.apiProtocol !== 'auto'
    ? settings.apiProtocol
    : inferApiProtocol(settings.cpamcBaseUrl)

  switch (protocol) {
    case 'anthropic-native':
      return new AnthropicNativeProviderAdapter(settings)
    case 'gemini-native':
      return new GeminiNativeProviderAdapter(settings)
    case 'mistral-native':
      return new MistralNativeProviderAdapter(settings)
    case 'cohere-native':
      return new CohereNativeProviderAdapter(settings)
    case 'openai-compatible':
    default:
      return new OpenAiCompatibleProviderAdapter(settings)
  }
}

export function normalizeProviderModelCatalog(protocol: ApiProtocol, payload: unknown): ModelCatalogItem[] {
  switch (protocol) {
    case 'anthropic-native':
      return normalizeAnthropicModelCatalog(payload as AnthropicModelListResponse)
    case 'gemini-native':
      return normalizeGeminiModelCatalog(payload as GeminiModelListResponse)
    case 'mistral-native':
      return normalizeOpenAiModelCatalog(payload as OpenAiModelListResponse)
    case 'cohere-native':
      return normalizeCohereModelCatalog(payload as CohereModelListResponse)
    case 'openai-compatible':
    default:
      return normalizeOpenAiModelCatalog(payload as OpenAiModelListResponse)
  }
}

export function resolveDefaultModelRequestAttemptTimeoutCapMs(model: string, reasoningEffort: ReasoningEffort) {
  if (!isGpt5FamilyModel(model)) {
    return DEFAULT_MODEL_REQUEST_ATTEMPT_TIMEOUT_CAP_MS
  }

  switch (reasoningEffort) {
    case 'medium':
      return GPT5_MEDIUM_REQUEST_ATTEMPT_TIMEOUT_CAP_MS
    case 'high':
      return GPT5_HIGH_REQUEST_ATTEMPT_TIMEOUT_CAP_MS
    case 'xhigh':
      return GPT5_XHIGH_REQUEST_ATTEMPT_TIMEOUT_CAP_MS
    default:
      return DEFAULT_MODEL_REQUEST_ATTEMPT_TIMEOUT_CAP_MS
  }
}

class OpenAiStyleProviderAdapter implements ProviderAdapter {
  readonly protocol: 'openai-compatible' | 'mistral-native'

  constructor(
    protected readonly settings: ProviderConnectionSettings,
    protocol: 'openai-compatible' | 'mistral-native',
  ) {
    this.protocol = protocol
  }

  async requestJson(input: ProviderJsonRequest) {
    const reasoningEffort = normalizeReasoningEffort(input.reasoningEffort)
    return this.requestJsonViaChatCompletions(input, reasoningEffort)
  }

  protected async requestJsonViaChatCompletions(
    input: ProviderJsonRequest,
    reasoningEffort: ReasoningEffort,
  ) {
    const endpoint = appendToBasePath(this.settings.cpamcBaseUrl, 'chat/completions')
    const body = {
      model: input.model,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.user },
      ],
      ...(reasoningEffort !== 'default' ? { reasoning_effort: reasoningEffort } : {}),
      ...(shouldSendTemperature(input.model, reasoningEffort) ? { temperature: 0.2 } : {}),
    }

    const response = await requestWithRetry(({ attempt, maxAttempts, attemptTimeoutMs }) => (
      runProviderAttemptWithTelemetry({
        telemetryCollector: input.telemetryCollector,
        requestLabel: input.requestLabel ?? 'optimizer',
        protocol: this.protocol,
        endpointKind: 'chat_completions',
        endpoint,
        attempt,
        maxAttempts,
        timeoutMs: attemptTimeoutMs,
      }, () => runRequestWithTimeout('模型请求', attemptTimeoutMs, async (signal) => {
        const result = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.settings.cpamcApiKey}`,
          },
          body: JSON.stringify(body),
          signal,
        })

        return {
          payload: await parseJsonResponse(result, '模型请求', attemptTimeoutMs) as OpenAiChatCompletionResponse,
          status: result.status,
        }
      }))
    ), {
      maxAttempts: input.maxAttempts ?? DEFAULT_MODEL_REQUEST_MAX_ATTEMPTS,
      attemptTimeoutCapMs: input.attemptTimeoutCapMs ?? resolveDefaultModelRequestAttemptTimeoutCapMs(input.model, reasoningEffort),
      timeoutMs: input.timeoutMs,
      actionLabel: '模型请求',
      onRetry: ({ attempt, maxAttempts, attemptTimeoutMs, delayMs, error }) => {
        emitRequestTelemetry(input.telemetryCollector, {
          kind: 'retry_scheduled',
          requestLabel: input.requestLabel ?? 'optimizer',
          protocol: this.protocol,
          endpointKind: 'chat_completions',
          endpoint,
          attempt,
          maxAttempts,
          timeoutMs: attemptTimeoutMs,
          elapsedMs: null,
          status: getTelemetryStatus(error),
          retriable: getTelemetryRetriable(error),
          message: `retry in ${delayMs}ms: ${getTelemetryMessage(error)}`,
        })
      },
    })

    return extractJsonObject(extractOpenAiResponseText(response)) as Record<string, unknown>
  }

  protected async requestJsonViaResponsesApi(
    input: ProviderJsonRequest,
    reasoningEffort: ReasoningEffort,
  ) {
    const endpoint = appendToBasePath(this.settings.cpamcBaseUrl, 'responses')
    const body = {
      model: input.model,
      instructions: input.system,
      input: input.user,
      ...(reasoningEffort !== 'default' ? { reasoning: { effort: reasoningEffort } } : {}),
      ...(shouldSendTemperature(input.model, reasoningEffort) ? { temperature: 0.2 } : {}),
    }

    const response = await requestWithRetry(({ attempt, maxAttempts, attemptTimeoutMs }) => (
      runProviderAttemptWithTelemetry({
        telemetryCollector: input.telemetryCollector,
        requestLabel: input.requestLabel ?? 'optimizer',
        protocol: this.protocol,
        endpointKind: 'responses',
        endpoint,
        attempt,
        maxAttempts,
        timeoutMs: attemptTimeoutMs,
      }, () => runRequestWithTimeout('模型请求', attemptTimeoutMs, async (signal) => {
        const result = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.settings.cpamcApiKey}`,
          },
          body: JSON.stringify(body),
          signal,
        })

        const payload = await parseOpenAiResponsesResponse(result, '模型请求', attemptTimeoutMs) as OpenAiResponsesResponse
        assertOpenAiResponsesPayloadSucceeded(payload)

        return {
          payload,
          status: result.status,
        }
      }))
    ), {
      maxAttempts: input.maxAttempts ?? DEFAULT_MODEL_REQUEST_MAX_ATTEMPTS,
      attemptTimeoutCapMs: input.attemptTimeoutCapMs ?? resolveDefaultModelRequestAttemptTimeoutCapMs(input.model, reasoningEffort),
      timeoutMs: input.timeoutMs,
      actionLabel: '模型请求',
      onRetry: ({ attempt, maxAttempts, attemptTimeoutMs, delayMs, error }) => {
        emitRequestTelemetry(input.telemetryCollector, {
          kind: 'retry_scheduled',
          requestLabel: input.requestLabel ?? 'optimizer',
          protocol: this.protocol,
          endpointKind: 'responses',
          endpoint,
          attempt,
          maxAttempts,
          timeoutMs: attemptTimeoutMs,
          elapsedMs: null,
          status: getTelemetryStatus(error),
          retriable: getTelemetryRetriable(error),
          message: `retry in ${delayMs}ms: ${getTelemetryMessage(error)}`,
        })
      },
    })

    return extractJsonObject(extractOpenAiResponsesText(response)) as Record<string, unknown>
  }

  async listModels() {
    const endpoint = appendToBasePath(this.settings.cpamcBaseUrl, 'models')
    const payload = await runRequestWithTimeout('拉取模型列表', 30_000, async (signal) => {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${this.settings.cpamcApiKey}`,
        },
        signal,
      })

      if (response.status === 404 && this.protocol === 'openai-compatible') {
        return null
      }

      return parseJsonResponse(response, '拉取模型列表', 30_000) as Promise<OpenAiModelListResponse>
    })

    if (payload === null) {
      return []
    }

    return normalizeProviderModelCatalog(this.protocol, payload)
  }
}

function shouldSendTemperature(model: string, reasoningEffort: ReasoningEffort) {
  if (isGpt5FamilyModel(model) && reasoningEffort !== 'default' && reasoningEffort !== 'none') {
    return false
  }

  return true
}

function shouldPreferResponsesApi(model: string, requestLabel?: ProviderRequestLabel) {
  if (!isGpt5FamilyModel(model)) {
    return false
  }

  return requestLabel === 'judge' || requestLabel === 'goal_anchor'
}

function shouldFallbackOpenAiCompatibleResponsesError(error: unknown) {
  if (isMissingOpenAiCompatibleEndpoint(error)) {
    return true
  }

  const message = getTelemetryMessage(error)
  return /(request timeout|response body timeout|auth_unavailable|internal_error|internal server error|internal_server_error|received from peer|\beof\b)/i.test(message)
}

function resolveOpenAiCompatibleChatFallbackTimeoutMs(
  input: ProviderJsonRequest,
  reasoningEffort: ReasoningEffort,
  error: unknown,
) {
  if (isMissingOpenAiCompatibleEndpoint(error)) {
    return input.timeoutMs
  }

  return Math.min(
    input.timeoutMs,
    input.attemptTimeoutCapMs ?? resolveDefaultModelRequestAttemptTimeoutCapMs(input.model, reasoningEffort),
    Math.max(1, Math.floor(input.timeoutMs / 2)),
  )
}

function createOpenAiCompatibleChatFallbackInput(
  input: ProviderJsonRequest,
  reasoningEffort: ReasoningEffort,
  error: unknown,
): ProviderJsonRequest {
  if (isMissingOpenAiCompatibleEndpoint(error)) {
    return input
  }

  return {
    ...input,
    maxAttempts: 1,
    timeoutMs: resolveOpenAiCompatibleChatFallbackTimeoutMs(input, reasoningEffort, error),
    attemptTimeoutCapMs: resolveDefaultModelRequestAttemptTimeoutCapMs(input.model, reasoningEffort),
  }
}

function createOpenAiCompatibleChatPrimaryInput(
  input: ProviderJsonRequest,
  reasoningEffort: ReasoningEffort,
) {
  if (input.requestLabel !== 'optimizer' || !isGpt5FamilyModel(input.model)) {
    return input
  }

  const attemptTimeoutCapMs = input.attemptTimeoutCapMs
    ?? resolveDefaultModelRequestAttemptTimeoutCapMs(input.model, reasoningEffort)

  return {
    ...input,
    maxAttempts: 1,
    attemptTimeoutCapMs: Math.max(attemptTimeoutCapMs, input.timeoutMs),
  }
}

function createOpenAiCompatibleResponsesPreferredInput(
  input: ProviderJsonRequest,
  reasoningEffort: ReasoningEffort,
) {
  if (input.requestLabel !== 'optimizer' || !isGpt5FamilyModel(input.model)) {
    return input
  }

  const attemptTimeoutCapMs = input.attemptTimeoutCapMs
    ?? resolveDefaultModelRequestAttemptTimeoutCapMs(input.model, reasoningEffort)

  return {
    ...input,
    attemptTimeoutCapMs: Math.max(attemptTimeoutCapMs, input.timeoutMs),
  }
}

function buildOpenAiCompatibleResponsesFallbackMessage(error: unknown) {
  if (isMissingOpenAiCompatibleEndpoint(error)) {
    return getTelemetryMessage(error)
  }

  return `responses request failed; falling back to chat/completions: ${getTelemetryMessage(error)}`
}

function shouldFallbackOpenAiCompatibleResponsesPreferredError(error: unknown) {
  return isMissingOpenAiCompatibleEndpoint(error)
}

function shouldFallbackOpenAiCompatibleChatError(
  input: ProviderJsonRequest,
  error: unknown,
) {
  if (isMissingOpenAiCompatibleEndpoint(error)) {
    return true
  }

  if (input.requestLabel !== 'optimizer' || !isGpt5FamilyModel(input.model)) {
    return false
  }

  if (isOpenAiCompatibleChatCapabilityMismatch(error)) {
    return true
  }

  return false
}

function isOpenAiCompatibleChatCapabilityMismatch(error: unknown) {
  const status = getTelemetryStatus(error)
  if (status !== 400 && status !== 404 && status !== 422) {
    return false
  }

  const message = getTelemetryMessage(error)
  return /(unsupported|not supported|unknown parameter|unknown field|invalid parameter|reasoning[_ ]?effort|capability mismatch|responses api only)/i.test(message)
}

function buildOpenAiCompatibleChatFallbackMessage(error: unknown) {
  if (isMissingOpenAiCompatibleEndpoint(error)) {
    return getTelemetryMessage(error)
  }

  return `chat/completions request failed; falling back to responses: ${getTelemetryMessage(error)}`
}

function resolveOpenAiCompatibleResponsesFallbackTimeoutMs(
  input: ProviderJsonRequest,
  requestStartedAt: number,
) {
  return Math.max(1, resolveRemainingTimeoutMs(requestStartedAt, input.timeoutMs))
}

function createOpenAiCompatibleResponsesFallbackInput(
  input: ProviderJsonRequest,
  requestStartedAt: number,
): ProviderJsonRequest {
  const fallbackTimeoutMs = resolveOpenAiCompatibleResponsesFallbackTimeoutMs(input, requestStartedAt)

  return {
    ...input,
    maxAttempts: 1,
    timeoutMs: fallbackTimeoutMs,
    attemptTimeoutCapMs: fallbackTimeoutMs,
  }
}

class OpenAiCompatibleProviderAdapter extends OpenAiStyleProviderAdapter {
  constructor(settings: ProviderConnectionSettings) {
    super(settings, 'openai-compatible')
  }

  async requestJson(input: ProviderJsonRequest) {
    const reasoningEffort = normalizeReasoningEffort(input.reasoningEffort)
    const requestStartedAt = Date.now()

    if (input.endpointMode === 'responses') {
      return this.requestJsonViaResponsesApi(input, reasoningEffort)
    }

    if (input.endpointMode === 'responses_preferred') {
      const preferredInput = createOpenAiCompatibleResponsesPreferredInput(input, reasoningEffort)
      try {
        return await this.requestJsonViaResponsesApi(preferredInput, reasoningEffort)
      } catch (error) {
        if (!shouldFallbackOpenAiCompatibleResponsesPreferredError(error)) {
          throw error
        }
        emitRequestTelemetry(input.telemetryCollector, {
          kind: 'fallback',
          requestLabel: input.requestLabel ?? 'optimizer',
          protocol: this.protocol,
          endpointKind: 'responses',
          endpoint: appendToBasePath(this.settings.cpamcBaseUrl, 'responses'),
          attempt: null,
          maxAttempts: preferredInput.maxAttempts ?? DEFAULT_MODEL_REQUEST_MAX_ATTEMPTS,
          timeoutMs: resolveOpenAiCompatibleChatFallbackTimeoutMs(preferredInput, reasoningEffort, error),
          elapsedMs: null,
          status: getTelemetryStatus(error),
          retriable: getTelemetryRetriable(error),
          message: buildOpenAiCompatibleResponsesFallbackMessage(error),
          fallbackEndpointKind: 'chat_completions',
        })

        return this.requestJsonViaChatCompletions(
          createOpenAiCompatibleChatFallbackInput(preferredInput, reasoningEffort, error),
          reasoningEffort,
        )
      }
    }

    if (input.endpointMode === 'chat') {
      return this.requestJsonViaChatCompletions(
        createOpenAiCompatibleChatPrimaryInput(input, reasoningEffort),
        reasoningEffort,
      )
    }

    if (shouldPreferResponsesApi(input.model, input.requestLabel)) {
      try {
        return await this.requestJsonViaResponsesApi(input, reasoningEffort)
      } catch (error) {
        if (!shouldFallbackOpenAiCompatibleResponsesError(error)) {
          throw error
        }
        emitRequestTelemetry(input.telemetryCollector, {
          kind: 'fallback',
          requestLabel: input.requestLabel ?? 'optimizer',
          protocol: this.protocol,
          endpointKind: 'responses',
          endpoint: appendToBasePath(this.settings.cpamcBaseUrl, 'responses'),
          attempt: null,
          maxAttempts: input.maxAttempts ?? DEFAULT_MODEL_REQUEST_MAX_ATTEMPTS,
          timeoutMs: resolveOpenAiCompatibleChatFallbackTimeoutMs(input, reasoningEffort, error),
          elapsedMs: null,
          status: getTelemetryStatus(error),
          retriable: getTelemetryRetriable(error),
          message: buildOpenAiCompatibleResponsesFallbackMessage(error),
          fallbackEndpointKind: 'chat_completions',
        })

        return this.requestJsonViaChatCompletions(
          createOpenAiCompatibleChatFallbackInput(input, reasoningEffort, error),
          reasoningEffort,
        )
      }
    }

    try {
      return await this.requestJsonViaChatCompletions(
        createOpenAiCompatibleChatPrimaryInput(input, reasoningEffort),
        reasoningEffort,
      )
    } catch (error) {
      if (!shouldFallbackOpenAiCompatibleChatError(input, error)) {
        throw error
      }
      const fallbackTimeoutMs = resolveOpenAiCompatibleResponsesFallbackTimeoutMs(input, requestStartedAt)
      emitRequestTelemetry(input.telemetryCollector, {
        kind: 'fallback',
        requestLabel: input.requestLabel ?? 'optimizer',
        protocol: this.protocol,
        endpointKind: 'chat_completions',
        endpoint: appendToBasePath(this.settings.cpamcBaseUrl, 'chat/completions'),
        attempt: null,
        maxAttempts: input.maxAttempts ?? DEFAULT_MODEL_REQUEST_MAX_ATTEMPTS,
        timeoutMs: fallbackTimeoutMs,
        elapsedMs: null,
        status: getTelemetryStatus(error),
        retriable: getTelemetryRetriable(error),
        message: buildOpenAiCompatibleChatFallbackMessage(error),
        fallbackEndpointKind: 'responses',
      })

      return this.requestJsonViaResponsesApi(
        createOpenAiCompatibleResponsesFallbackInput(input, requestStartedAt),
        reasoningEffort,
      )
    }
  }
}

class MistralNativeProviderAdapter extends OpenAiStyleProviderAdapter {
  constructor(settings: ProviderConnectionSettings) {
    super(settings, 'mistral-native')
  }
}

class AnthropicNativeProviderAdapter implements ProviderAdapter {
  readonly protocol = 'anthropic-native' as const

  constructor(private readonly settings: ProviderConnectionSettings) {}

  async requestJson(input: ProviderJsonRequest) {
    const endpoint = appendVersionedPath(this.settings.cpamcBaseUrl, 'v1', 'messages')
    const body = {
      model: input.model,
      system: input.system,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: input.user,
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 2_048,
    }

    const response = await requestWithRetry(({ attempt, maxAttempts, attemptTimeoutMs }) => (
      runProviderAttemptWithTelemetry({
        telemetryCollector: input.telemetryCollector,
        requestLabel: input.requestLabel ?? 'optimizer',
        protocol: this.protocol,
        endpointKind: 'anthropic_messages',
        endpoint,
        attempt,
        maxAttempts,
        timeoutMs: attemptTimeoutMs,
      }, () => runRequestWithTimeout('Anthropic 请求', attemptTimeoutMs, async (signal) => {
        const result = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.settings.cpamcApiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body),
          signal,
        })

        return {
          payload: await parseJsonResponse(result, 'Anthropic 请求', attemptTimeoutMs) as AnthropicMessagesResponse,
          status: result.status,
        }
      }))
    ), {
      maxAttempts: input.maxAttempts ?? DEFAULT_MODEL_REQUEST_MAX_ATTEMPTS,
      attemptTimeoutCapMs: input.attemptTimeoutCapMs ?? DEFAULT_MODEL_REQUEST_ATTEMPT_TIMEOUT_CAP_MS,
      timeoutMs: input.timeoutMs,
      actionLabel: 'Anthropic 请求',
      onRetry: ({ attempt, maxAttempts, attemptTimeoutMs, delayMs, error }) => {
        emitRequestTelemetry(input.telemetryCollector, {
          kind: 'retry_scheduled',
          requestLabel: input.requestLabel ?? 'optimizer',
          protocol: this.protocol,
          endpointKind: 'anthropic_messages',
          endpoint,
          attempt,
          maxAttempts,
          timeoutMs: attemptTimeoutMs,
          elapsedMs: null,
          status: getTelemetryStatus(error),
          retriable: getTelemetryRetriable(error),
          message: `retry in ${delayMs}ms: ${getTelemetryMessage(error)}`,
        })
      },
    })

    return extractJsonObject(extractAnthropicResponseText(response)) as Record<string, unknown>
  }

  async listModels() {
    const endpoint = appendVersionedPath(this.settings.cpamcBaseUrl, 'v1', 'models')
    const payload = await runRequestWithTimeout('拉取模型列表', 30_000, async (signal) => {
      const response = await fetch(endpoint, {
        headers: {
          'x-api-key': this.settings.cpamcApiKey,
          'anthropic-version': '2023-06-01',
        },
        signal,
      })

      return parseJsonResponse(response, '拉取模型列表', 30_000) as Promise<AnthropicModelListResponse>
    })
    return normalizeProviderModelCatalog(this.protocol, payload)
  }
}

class GeminiNativeProviderAdapter implements ProviderAdapter {
  readonly protocol = 'gemini-native' as const

  constructor(private readonly settings: ProviderConnectionSettings) {}

  async requestJson(input: ProviderJsonRequest) {
    const modelPath = normalizeGeminiModelPath(input.model)
    const endpoint = appendVersionedPath(
      this.settings.cpamcBaseUrl,
      'v1beta',
      `models/${encodeURIComponent(modelPath)}:generateContent`,
    )
    const body = {
      systemInstruction: {
        parts: [{ text: input.system }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: input.user }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    }

    const response = await requestWithRetry(({ attempt, maxAttempts, attemptTimeoutMs }) => (
      runProviderAttemptWithTelemetry({
        telemetryCollector: input.telemetryCollector,
        requestLabel: input.requestLabel ?? 'optimizer',
        protocol: this.protocol,
        endpointKind: 'gemini_generate_content',
        endpoint,
        attempt,
        maxAttempts,
        timeoutMs: attemptTimeoutMs,
      }, () => runRequestWithTimeout('Gemini 请求', attemptTimeoutMs, async (signal) => {
        const result = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.settings.cpamcApiKey,
          },
          body: JSON.stringify(body),
          signal,
        })

        return {
          payload: await parseJsonResponse(result, 'Gemini 请求', attemptTimeoutMs) as GeminiGenerateContentResponse,
          status: result.status,
        }
      }))
    ), {
      maxAttempts: input.maxAttempts ?? DEFAULT_MODEL_REQUEST_MAX_ATTEMPTS,
      attemptTimeoutCapMs: input.attemptTimeoutCapMs ?? DEFAULT_MODEL_REQUEST_ATTEMPT_TIMEOUT_CAP_MS,
      timeoutMs: input.timeoutMs,
      actionLabel: 'Gemini 请求',
      onRetry: ({ attempt, maxAttempts, attemptTimeoutMs, delayMs, error }) => {
        emitRequestTelemetry(input.telemetryCollector, {
          kind: 'retry_scheduled',
          requestLabel: input.requestLabel ?? 'optimizer',
          protocol: this.protocol,
          endpointKind: 'gemini_generate_content',
          endpoint,
          attempt,
          maxAttempts,
          timeoutMs: attemptTimeoutMs,
          elapsedMs: null,
          status: getTelemetryStatus(error),
          retriable: getTelemetryRetriable(error),
          message: `retry in ${delayMs}ms: ${getTelemetryMessage(error)}`,
        })
      },
    })

    return extractJsonObject(extractGeminiResponseText(response)) as Record<string, unknown>
  }

  async listModels() {
    const endpoint = appendVersionedPath(this.settings.cpamcBaseUrl, 'v1beta', 'models')
    const payload = await runRequestWithTimeout('拉取模型列表', 30_000, async (signal) => {
      const response = await fetch(endpoint, {
        headers: {
          'x-goog-api-key': this.settings.cpamcApiKey,
        },
        signal,
      })

      return parseJsonResponse(response, '拉取模型列表', 30_000) as Promise<GeminiModelListResponse>
    })
    return normalizeProviderModelCatalog(this.protocol, payload)
  }
}

class CohereNativeProviderAdapter implements ProviderAdapter {
  readonly protocol = 'cohere-native' as const

  constructor(private readonly settings: ProviderConnectionSettings) {}

  async requestJson(input: ProviderJsonRequest) {
    const endpoint = appendVersionedPath(this.settings.cpamcBaseUrl, 'v2', 'chat')
    const body = {
      model: input.model,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.user },
      ],
      temperature: 0.2,
    }

    const response = await requestWithRetry(({ attempt, maxAttempts, attemptTimeoutMs }) => (
      runProviderAttemptWithTelemetry({
        telemetryCollector: input.telemetryCollector,
        requestLabel: input.requestLabel ?? 'optimizer',
        protocol: this.protocol,
        endpointKind: 'cohere_chat',
        endpoint,
        attempt,
        maxAttempts,
        timeoutMs: attemptTimeoutMs,
      }, () => runRequestWithTimeout('Cohere 请求', attemptTimeoutMs, async (signal) => {
        const result = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.settings.cpamcApiKey}`,
          },
          body: JSON.stringify(body),
          signal,
        })

        return {
          payload: await parseJsonResponse(result, 'Cohere 请求', attemptTimeoutMs) as CohereChatResponse,
          status: result.status,
        }
      }))
    ), {
      maxAttempts: input.maxAttempts ?? DEFAULT_MODEL_REQUEST_MAX_ATTEMPTS,
      attemptTimeoutCapMs: input.attemptTimeoutCapMs ?? DEFAULT_MODEL_REQUEST_ATTEMPT_TIMEOUT_CAP_MS,
      timeoutMs: input.timeoutMs,
      actionLabel: 'Cohere 请求',
      onRetry: ({ attempt, maxAttempts, attemptTimeoutMs, delayMs, error }) => {
        emitRequestTelemetry(input.telemetryCollector, {
          kind: 'retry_scheduled',
          requestLabel: input.requestLabel ?? 'optimizer',
          protocol: this.protocol,
          endpointKind: 'cohere_chat',
          endpoint,
          attempt,
          maxAttempts,
          timeoutMs: attemptTimeoutMs,
          elapsedMs: null,
          status: getTelemetryStatus(error),
          retriable: getTelemetryRetriable(error),
          message: `retry in ${delayMs}ms: ${getTelemetryMessage(error)}`,
        })
      },
    })

    return extractJsonObject(extractCohereResponseText(response)) as Record<string, unknown>
  }

  async listModels() {
    const endpoint = appendVersionedPath(this.settings.cpamcBaseUrl, 'v2', 'models')
    const payload = await runRequestWithTimeout('拉取模型列表', 30_000, async (signal) => {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${this.settings.cpamcApiKey}`,
        },
        signal,
      })

      return parseJsonResponse(response, '拉取模型列表', 30_000) as Promise<CohereModelListResponse>
    })
    return normalizeProviderModelCatalog(this.protocol, payload)
  }
}

function normalizeOpenAiModelCatalog(payload: OpenAiModelListResponse): ModelCatalogItem[] {
  const normalizedIds = (payload.data ?? [])
    .map((item) => normalizeOpenAiCompatibleModelAlias(item.id))
    .filter((item): item is string => Boolean(item))

  const qualifiedSuffixes = new Set(
    normalizedIds
      .filter((item) => item.includes('/'))
      .map((item) => item.split('/').filter(Boolean).at(-1) ?? item),
  )

  const seen = new Set<string>()
  const models: ModelCatalogItem[] = []
  for (const id of normalizedIds) {
    if (!id.includes('/') && qualifiedSuffixes.has(id)) {
      continue
    }

    if (seen.has(id)) {
      continue
    }

    seen.add(id)
    models.push({ id, label: id })
  }

  return models
}

function normalizeAnthropicModelCatalog(payload: AnthropicModelListResponse): ModelCatalogItem[] {
  return dedupeModelIds((payload.data ?? []).map((item) => item.id))
}

function normalizeGeminiModelCatalog(payload: GeminiModelListResponse): ModelCatalogItem[] {
  const ids = (payload.models ?? [])
    .filter((item) => {
      const methods = Array.isArray(item.supportedGenerationMethods) ? item.supportedGenerationMethods : null
      return !methods || methods.includes('generateContent')
    })
    .map((item) => item.name)

  return dedupeModelIds(ids)
}

function normalizeCohereModelCatalog(payload: CohereModelListResponse): ModelCatalogItem[] {
  return dedupeModelIds((payload.models ?? []).map((item) => item.name))
}

function dedupeModelIds(ids: Array<string | undefined>): ModelCatalogItem[] {
  const seen = new Set<string>()
  const models: ModelCatalogItem[] = []

  for (const id of ids) {
    const alias = normalizeModelAlias(id)
    if (!alias || seen.has(alias)) {
      continue
    }
    seen.add(alias)
    models.push({ id: alias, label: alias })
  }

  return models
}

function normalizeOpenAiCompatibleModelAlias(value: string | undefined) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim().replace(/^models\//i, '')
  return trimmed || null
}

function normalizeModelAlias(value: string | undefined) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim().replace(/^models\//i, '')
  if (!trimmed) {
    return null
  }

  const parts = trimmed.split('/').filter(Boolean)
  const alias = parts.at(-1)?.trim()
  return alias || null
}

function normalizeGeminiModelPath(model: string) {
  return model.trim().replace(/^models\//i, '')
}

function extractOpenAiResponseText(response: OpenAiChatCompletionResponse) {
  const content = response.choices?.[0]?.message?.content
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    return content.map((part) => part.text ?? '').join('\n')
  }
  if (response.error?.message) {
    throw new Error(response.error.message)
  }
  throw new Error('模型返回了空响应。')
}

function extractOpenAiResponsesText(response: OpenAiResponsesResponse) {
  const text = collectOpenAiResponsesText(response)

  if (text) {
    return text
  }

  if (response.error?.message) {
    throw new Error(response.error.message)
  }

  throw new Error('OpenAI Responses API 返回了空响应。')
}

function collectOpenAiResponsesText(response: OpenAiResponsesResponse) {
  return (response.output ?? [])
    .flatMap((item) => item.type === 'message' ? item.content ?? [] : [])
    .filter((part) => part.type === 'output_text' && typeof part.text === 'string')
    .map((part) => part.text ?? '')
    .join('\n')
    .trim()
}

function assertOpenAiResponsesPayloadSucceeded(response: OpenAiResponsesResponse) {
  if (collectOpenAiResponsesText(response)) {
    return
  }

  if (response.error?.message) {
    throw new Error(response.error.message)
  }
}

function extractAnthropicResponseText(response: AnthropicMessagesResponse) {
  const text = (response.content ?? [])
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text ?? '')
    .join('\n')
    .trim()

  if (text) {
    return text
  }

  if (response.error?.message) {
    throw new Error(response.error.message)
  }

  throw new Error('Anthropic 返回了空响应。')
}

function extractGeminiResponseText(response: GeminiGenerateContentResponse) {
  const text = (response.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('\n')
    .trim()

  if (text) {
    return text
  }

  if (response.error?.message) {
    throw new Error(response.error.message)
  }

  if (response.promptFeedback?.blockReason) {
    throw new Error(`Gemini 阻止了该请求：${response.promptFeedback.blockReason}`)
  }

  throw new Error('Gemini 返回了空响应。')
}

function extractCohereResponseText(response: CohereChatResponse) {
  const text = (response.message?.content ?? [])
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text ?? '')
    .join('\n')
    .trim()

  if (text) {
    return text
  }

  if (response.error?.message) {
    throw new Error(response.error.message)
  }

  throw new Error('Cohere 返回了空响应。')
}

async function parseJsonResponse(response: Response, actionLabel: string, timeoutMs: number) {
  if (!response.ok) {
    throw await createHttpError(response, actionLabel, timeoutMs)
  }

  return readResponseJsonWithTimeout(response, actionLabel, resolveBodyReadTimeoutMs(timeoutMs))
}

async function parseOpenAiResponsesResponse(response: Response, actionLabel: string, timeoutMs: number) {
  if (!response.ok) {
    throw await createHttpError(response, actionLabel, timeoutMs)
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.includes('text/event-stream')) {
    return readResponseJsonWithTimeout(response, actionLabel, resolveBodyReadTimeoutMs(timeoutMs)) as Promise<OpenAiResponsesResponse>
  }

  const payload = await readResponseTextWithTimeout(response, actionLabel, resolveBodyReadTimeoutMs(timeoutMs))
  return parseOpenAiResponsesEventStream(payload)
}

async function createHttpError(response: Response, actionLabel: string, timeoutMs: number) {
  const text = await readResponseTextWithTimeout(response, actionLabel, resolveBodyReadTimeoutMs(timeoutMs))
  const error = new Error(`${actionLabel}失败 (${response.status}): ${text.slice(0, 500)}`) as Error & {
    retriable?: boolean
    status?: number
  }
  error.status = response.status
  error.retriable = isRetriableHttpFailure(response.status, text)
  return error
}

function resolveBodyReadTimeoutMs(timeoutMs: number) {
  return Math.max(1, timeoutMs - 10)
}

function readResponseJsonWithTimeout(response: Response, actionLabel: string, timeoutMs: number) {
  return readResponseBodyWithTimeout(response, actionLabel, timeoutMs, () => response.json() as Promise<unknown>)
}

function readResponseTextWithTimeout(response: Response, actionLabel: string, timeoutMs: number) {
  return readResponseBodyWithTimeout(response, actionLabel, timeoutMs, () => response.text())
}

async function readResponseBodyWithTimeout<T>(
  response: Response,
  actionLabel: string,
  timeoutMs: number,
  readBody: () => Promise<T>,
) {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      readBody(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          void response.body?.cancel().catch(() => {})
          const error = new Error(`${actionLabel}失败：response body timeout after ${timeoutMs}ms`) as Error & {
            retriable?: boolean
            status?: number
          }
          error.retriable = true
          error.status = 408
          reject(error)
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

async function requestWithRetry<T>(
  operation: (input: { attempt: number; maxAttempts: number; attemptTimeoutMs: number }) => Promise<T>,
  options: {
    maxAttempts: number
    attemptTimeoutCapMs?: number
    timeoutMs: number
    actionLabel: string
    onRetry?: (input: {
      attempt: number
      maxAttempts: number
      attemptTimeoutMs: number
      delayMs: number
      error: unknown
    }) => void
  },
) {
  let attempt = 0
  let lastError: unknown
  const startedAt = Date.now()

  while (attempt < options.maxAttempts) {
    const currentAttempt = attempt + 1
    const attemptTimeoutMs = resolveAttemptTimeoutMs(startedAt, options.timeoutMs, options.attemptTimeoutCapMs)
    if (attemptTimeoutMs <= 0) {
      throw lastError ?? createRequestTimeoutError(options.actionLabel, options.timeoutMs)
    }
    try {
      return await operation({
        attempt: currentAttempt,
        maxAttempts: options.maxAttempts,
        attemptTimeoutMs,
      })
    } catch (error) {
      lastError = error
      attempt = currentAttempt
      const retriable = isRetriableRequestError(error)
      if (!retriable || attempt >= options.maxAttempts) {
        throw error
      }
      const remainingTimeoutMs = resolveRemainingTimeoutMs(startedAt, options.timeoutMs)
      const retryDelayMs = resolveRetryDelayMs(attempt, remainingTimeoutMs, options.maxAttempts)
      if (retryDelayMs <= 0) {
        throw error
      }
      options.onRetry?.({
        attempt: currentAttempt,
        maxAttempts: options.maxAttempts,
        attemptTimeoutMs,
        delayMs: retryDelayMs,
        error,
      })
      await wait(retryDelayMs)
    }
  }

  throw lastError
}

function resolveRemainingTimeoutMs(startedAt: number, totalTimeoutMs: number) {
  return Math.max(0, totalTimeoutMs - (Date.now() - startedAt))
}

function resolveAttemptTimeoutMs(startedAt: number, totalTimeoutMs: number, attemptTimeoutCapMs?: number) {
  const remainingTimeoutMs = resolveRemainingTimeoutMs(startedAt, totalTimeoutMs)
  const normalizedCapMs = Math.max(1, attemptTimeoutCapMs ?? totalTimeoutMs)
  return Math.max(0, Math.min(remainingTimeoutMs, normalizedCapMs))
}

function resolveRetryDelayMs(attempt: number, remainingTimeoutMs: number, maxAttempts: number) {
  const remainingAttempts = Math.max(0, maxAttempts - attempt)
  const reservedMs = remainingAttempts * 10
  if (remainingTimeoutMs <= reservedMs) {
    return 0
  }

  return Math.min(500 * 2 ** (attempt - 1), remainingTimeoutMs - reservedMs)
}

function createRequestTimeoutError(actionLabel: string, timeoutMs: number) {
  const error = new Error(`${actionLabel}失败：request timeout after ${timeoutMs}ms`) as Error & {
    retriable?: boolean
    status?: number
  }
  error.retriable = true
  error.status = 408
  return error
}

async function runRequestWithTimeout<T>(
  actionLabel: string,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
) {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          const error = new Error(`${actionLabel}失败：request timeout after ${timeoutMs}ms`) as Error & {
            retriable?: boolean
            status?: number
          }
          error.retriable = true
          error.status = 408
          reject(error)
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

function isRetriableRequestError(error: unknown) {
  if (error instanceof Error && 'retriable' in error) {
    return Boolean((error as Error & { retriable?: boolean }).retriable)
  }

  const message = error instanceof Error ? error.message : String(error ?? '')
  return isRetriableTransientMessage(message)
}

function isRetriableHttpFailure(status: number, bodyText: string) {
  if (status === 408 || status === 429 || status === 502 || status === 503 || status === 504) {
    return true
  }

  if (status !== 500) {
    return false
  }

  return isRetriableTransientMessage(bodyText)
}

function isRetriableTransientMessage(message: string) {
  return /(fetch failed|timeout|timed out|gateway time-?out|bad gateway|service unavailable|the operation was aborted|aborterror|etimedout|econnreset|econnrefused|socket hang up|\beof\b|upstream connect|upstream timed out|network|\bhttp 000\b)/i.test(message)
}

function appendToBasePath(baseUrl: string, tail: string) {
  const url = parseBaseUrl(baseUrl)
  const segments = [
    ...url.pathname.split('/').filter(Boolean),
    ...tail.split('/').filter(Boolean),
  ]
  url.pathname = `/${segments.join('/')}`
  url.search = ''
  return url.toString()
}

async function runProviderAttemptWithTelemetry<T>(input: {
  telemetryCollector?: (event: ProviderRequestTelemetryEvent) => void
  requestLabel: ProviderRequestLabel
  protocol: string
  endpointKind: ProviderEndpointKind
  endpoint: string
  attempt: number
  maxAttempts: number
  timeoutMs: number
}, operation: () => Promise<{ payload: T; status: number }>) {
  const startedAt = Date.now()
  emitRequestTelemetry(input.telemetryCollector, {
    kind: 'attempt_started',
    requestLabel: input.requestLabel,
    protocol: input.protocol,
    endpointKind: input.endpointKind,
    endpoint: input.endpoint,
    attempt: input.attempt,
    maxAttempts: input.maxAttempts,
    timeoutMs: input.timeoutMs,
    elapsedMs: null,
    status: null,
    retriable: null,
    message: 'attempt started',
  })

  try {
    const result = await operation()
    emitRequestTelemetry(input.telemetryCollector, {
      kind: 'attempt_succeeded',
      requestLabel: input.requestLabel,
      protocol: input.protocol,
      endpointKind: input.endpointKind,
      endpoint: input.endpoint,
      attempt: input.attempt,
      maxAttempts: input.maxAttempts,
      timeoutMs: input.timeoutMs,
      elapsedMs: Date.now() - startedAt,
      status: result.status,
      retriable: false,
      message: 'attempt succeeded',
    })
    return result.payload
  } catch (error) {
    emitRequestTelemetry(input.telemetryCollector, {
      kind: 'attempt_failed',
      requestLabel: input.requestLabel,
      protocol: input.protocol,
      endpointKind: input.endpointKind,
      endpoint: input.endpoint,
      attempt: input.attempt,
      maxAttempts: input.maxAttempts,
      timeoutMs: input.timeoutMs,
      elapsedMs: Date.now() - startedAt,
      status: getTelemetryStatus(error),
      retriable: getTelemetryRetriable(error),
      message: getTelemetryMessage(error),
    })
    throw error
  }
}

function emitRequestTelemetry(
  collector: ProviderJsonRequest['telemetryCollector'],
  event: Omit<ProviderRequestTelemetryEvent, 'at'>,
) {
  collector?.({
    ...event,
    at: new Date().toISOString(),
  })
}

function getTelemetryStatus(error: unknown) {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return null
  }

  const numeric = Number((error as { status?: unknown }).status)
  return Number.isFinite(numeric) ? numeric : null
}

function getTelemetryRetriable(error: unknown) {
  if (!error || typeof error !== 'object' || !('retriable' in error)) {
    return null
  }

  return Boolean((error as { retriable?: unknown }).retriable)
}

function getTelemetryMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error ?? 'unknown error')
}

function parseOpenAiResponsesEventStream(payload: string): OpenAiResponsesResponse {
  const blocks = payload
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)

  let finalResponse: OpenAiResponsesResponse | null = null
  let lastPayload: unknown = null

  for (const block of blocks) {
    const lines = block.split('\n')
    const event = lines.find((line) => line.startsWith('event:'))?.slice('event:'.length).trim()
    const data = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trim())
      .join('\n')

    if (!data || data === '[DONE]') {
      continue
    }

    const parsed = JSON.parse(data) as { response?: OpenAiResponsesResponse }
    lastPayload = parsed
    if ((event === 'response.completed' || event === 'response.failed') && parsed.response) {
      finalResponse = parsed.response
    }
  }

  if (finalResponse) {
    return finalResponse
  }

  if (isOpenAiResponsesWrapper(lastPayload)) {
    return lastPayload.response
  }

  if (isOpenAiResponsesResponse(lastPayload)) {
    return lastPayload
  }

  throw new Error('OpenAI Responses API 返回了无法解析的事件流。')
}

function isOpenAiResponsesWrapper(payload: unknown): payload is { response: OpenAiResponsesResponse } {
  return typeof payload === 'object' && payload !== null && 'response' in payload
}

function isOpenAiResponsesResponse(payload: unknown): payload is OpenAiResponsesResponse {
  return typeof payload === 'object' && payload !== null
}

function isMissingOpenAiCompatibleEndpoint(error: unknown) {
  return Boolean(
    error
    && typeof error === 'object'
    && 'status' in error
    && (error as { status?: number }).status === 404,
  )
}

function appendVersionedPath(baseUrl: string, versionSegment: string, tail: string) {
  const url = parseBaseUrl(baseUrl)
  const baseSegments = url.pathname.split('/').filter(Boolean)
  const segments = baseSegments.at(-1) === versionSegment
    ? baseSegments
    : [...baseSegments, versionSegment].filter(Boolean)

  url.pathname = `/${[...segments, ...tail.split('/').filter(Boolean)].join('/')}`
  url.search = ''
  return url.toString()
}

function parseBaseUrl(baseUrl: string) {
  try {
    return new URL(baseUrl.trim())
  } catch {
    throw new Error('Base URL 格式不正确。')
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
