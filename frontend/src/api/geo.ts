import { getApiBaseUrl, request } from './client'
import type {
  GeoGeneratePayload,
  GeoGenerateV2Payload,
  GeoPromptBatchCreatePayload,
  GeoPromptBatchJob,
  GeoPromptCodeOption,
  GeoPromptEngineLegacyRules,
  GeoProfileItem,
  GeoProfilePayload,
  GeoPromptEngineV2FixedRules,
  GeoPromptEngineVersion,
  GeoPromptEngineVersionDraftChatPayload,
  GeoPromptEngineVersionDraftImportPayload,
  GeoPromptEngineVersionDraftSession,
  GeoPromptEngineVersionDraftSessionPayload,
  GeoPromptEngineVersionDraftSuggestion,
  GeoPromptEngineVersionPayload,
  GeoProviderConfigPayload,
  GeoProviderConfigView,
  GeoPublicationCrawlJob,
  GeoPublicationCrawlKeyword,
  GeoPublicationCrawlKeywordPayload,
  GeoPublicationCrawlSetting,
  GeoPublicationImportResult,
  GeoPublicationOption,
  GeoPublicationOptionPayload,
  GeoPublicationOptionsView,
  GeoPublicationRecord,
  GeoPublicationRecordPayload,
  GeoPublicationRecordQuery,
  GeoPublicationStats,
  GeoRuleCard,
  GeoRuleCardGeneratePayload,
  GeoSerpAiSummary,
  GeoSerpAiSummaryDraft,
  GeoSerpAiSummaryPromptPreview,
  GeoSerpAiSummaryStreamEvent,
  GeoSerpAiSummaryTestPrompt,
  GeoSerpAiSummaryTestPayload,
  GeoSerpProjectDetail,
  GeoSerpProjectPayload,
  GeoSerpProjectSummary,
  GeoStreamEvent,
  GeoV3GeneratePayload,
  GeoV3BatchTxtJob,
  GeoV3BatchTxtJobPayload,
  GeoV3GenerationRun,
  GeoV3FixedRules,
  GeoV3Product,
  GeoV3ProductPayload,
  GeoV3VariableSet,
  GeoV3VariableSetDraftPayload,
  GeoV3VariableSetPayload,
  GeoV3Version,
  GeoV3VersionBatchAction,
  GeoV3VersionBatchActionResult,
  GeoV3VersionDraftChatPayload,
  GeoV3VersionDraftPayload,
  GeoV3VersionDraftSession,
  GeoV3VersionDraftSessionApplyPayload,
  GeoV3VersionDraftSessionImportV2Payload,
  GeoV3VersionDraftSessionPayload,
  GeoV3VersionDraftSuggestion,
  GeoV3VersionDraftVariableSet,
  GeoV3VersionPayload,
} from '@/types/geo'

const parseErrorMessage = (payload: unknown) => {
  if (!payload) return '请求失败，请稍后重试'

  if (typeof payload === 'string') return payload

  if (typeof payload === 'object' && payload !== null) {
    const error = Reflect.get(payload, 'error')
    if (typeof error === 'string') return error

    const message = Reflect.get(payload, 'message')
    if (typeof message === 'string') return message

    if (Array.isArray(message) && message.length > 0) {
      return String(message[0])
    }
  }

  return '请求失败，请稍后重试'
}

export const getGeoProfiles = () => {
  return request<GeoProfileItem[]>('/geo/profiles')
}

export const createGeoProfile = (payload: GeoProfilePayload) => {
  return request<GeoProfileItem>('/geo/profiles', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const updateGeoProfile = (id: number, payload: Partial<GeoProfilePayload>) => {
  return request<GeoProfileItem>(`/geo/profiles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export const deleteGeoProfile = (id: number) => {
  return request<{ id: number; success: boolean }>(`/geo/profiles/${id}`, {
    method: 'DELETE',
  })
}

export const getGeoProviderConfig = () => {
  return request<GeoProviderConfigView>('/geo/provider-config')
}

export const updateGeoProviderConfig = (payload: GeoProviderConfigPayload) => {
  return request<GeoProviderConfigView>('/geo/provider-config', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export const getGeoPromptEngineV2FixedRules = () => {
  return request<GeoPromptEngineV2FixedRules>('/geo/prompt-engine-v2/fixed-rules')
}

export const getGeoPromptEngineLegacyRules = () => {
  return request<GeoPromptEngineLegacyRules>('/geo/prompt-engine-legacy/rules')
}

export const updateGeoPromptEngineV2FixedRules = (ruleText: string) => {
  return request<GeoPromptEngineV2FixedRules>('/geo/prompt-engine-v2/fixed-rules', {
    method: 'PUT',
    body: JSON.stringify({ ruleText }),
  })
}

export const getGeoPromptEngineV2Versions = () => {
  return request<GeoPromptEngineVersion[]>('/geo/prompt-engine-v2/versions')
}

export const createGeoPromptEngineV2Version = (payload: GeoPromptEngineVersionPayload) => {
  return request<GeoPromptEngineVersion>('/geo/prompt-engine-v2/versions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const updateGeoPromptEngineV2Version = (
  id: number,
  payload: Partial<GeoPromptEngineVersionPayload>
) => {
  return request<GeoPromptEngineVersion>(`/geo/prompt-engine-v2/versions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export const deleteGeoPromptEngineV2Version = (id: number) => {
  return request<{ id: number; success: boolean }>(`/geo/prompt-engine-v2/versions/${id}`, {
    method: 'DELETE',
  })
}

export const getGeoPromptEngineV2VersionDraftSessions = () => {
  return request<GeoPromptEngineVersionDraftSession[]>('/geo/prompt-engine-v2/version-draft-sessions')
}

export const getGeoPromptEngineV2VersionDraftSession = (id: number) => {
  return request<GeoPromptEngineVersionDraftSession>(`/geo/prompt-engine-v2/version-draft-sessions/${id}`)
}

export const createGeoPromptEngineV2VersionDraftSession = (
  payload: GeoPromptEngineVersionDraftSessionPayload
) => {
  return request<GeoPromptEngineVersionDraftSession>('/geo/prompt-engine-v2/version-draft-sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const updateGeoPromptEngineV2VersionDraftSession = (
  id: number,
  payload: GeoPromptEngineVersionDraftSessionPayload
) => {
  return request<GeoPromptEngineVersionDraftSession>(`/geo/prompt-engine-v2/version-draft-sessions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export const deleteGeoPromptEngineV2VersionDraftSession = (id: number) => {
  return request<GeoPromptEngineVersionDraftSession>(`/geo/prompt-engine-v2/version-draft-sessions/${id}`, {
    method: 'DELETE',
  })
}

export const applyGeoPromptEngineV2VersionDraftSession = (id: number) => {
  return request<GeoPromptEngineVersionDraftSuggestion>(`/geo/prompt-engine-v2/version-draft-sessions/${id}/apply`, {
    method: 'POST',
  })
}

export const applyGeoPromptEngineV2VersionDraftChat = (
  payload: GeoPromptEngineVersionDraftChatPayload
) => {
  return request<GeoPromptEngineVersionDraftSuggestion>('/geo/prompt-engine-v2/version-drafts/chat/apply', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const importGeoPromptEngineV2VersionDraft = (
  payload: GeoPromptEngineVersionDraftImportPayload
) => {
  return request<GeoPromptEngineVersionDraftSuggestion>('/geo/prompt-engine-v2/version-drafts/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const getGeoV3Versions = () => {
  return request<GeoV3Version[]>('/geo-v3/versions')
}

export const createGeoV3Version = (payload: GeoV3VersionPayload) => {
  return request<GeoV3Version>('/geo-v3/versions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const updateGeoV3Version = (id: number, payload: Partial<GeoV3VersionPayload>) => {
  return request<GeoV3Version>(`/geo-v3/versions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export const batchUpdateGeoV3Versions = (ids: number[], action: GeoV3VersionBatchAction) => {
  return request<GeoV3VersionBatchActionResult>('/geo-v3/versions/batch', {
    method: 'PATCH',
    body: JSON.stringify({ ids, action }),
  })
}

export const archiveGeoV3Version = (id: number) => {
  return request<{ id: number; success: boolean; archived: boolean }>(`/geo-v3/versions/${id}`, {
    method: 'DELETE',
  })
}

export const createGeoV3VersionDraft = (payload: GeoV3VersionDraftPayload) => {
  return request<GeoV3VersionDraftSuggestion>('/geo-v3/versions/draft', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const applyGeoV3VersionDraftChat = (payload: GeoV3VersionDraftChatPayload) => {
  return request<GeoV3VersionDraftSuggestion>('/geo-v3/versions/chat/apply', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const createGeoV3VariableSetDraft = (payload: GeoV3VariableSetDraftPayload) => {
  return request<GeoV3VersionDraftVariableSet>('/geo-v3/versions/variable-set-draft', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const getGeoV3VersionDraftSessions = () => {
  return request<GeoV3VersionDraftSession[]>('/geo-v3/version-draft-sessions')
}

export const getGeoV3VersionDraftSession = (id: number) => {
  return request<GeoV3VersionDraftSession>(`/geo-v3/version-draft-sessions/${id}`)
}

export const createGeoV3VersionDraftSession = (payload: GeoV3VersionDraftSessionPayload) => {
  return request<GeoV3VersionDraftSession>('/geo-v3/version-draft-sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const updateGeoV3VersionDraftSession = (
  id: number,
  payload: GeoV3VersionDraftSessionPayload
) => {
  return request<GeoV3VersionDraftSession>(`/geo-v3/version-draft-sessions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export const deleteGeoV3VersionDraftSession = (id: number) => {
  return request<GeoV3VersionDraftSession>(`/geo-v3/version-draft-sessions/${id}`, {
    method: 'DELETE',
  })
}

export const importGeoV3VersionDraftSessionFromV2 = (
  payload: GeoV3VersionDraftSessionImportV2Payload
) => {
  return request<GeoV3VersionDraftSession>('/geo-v3/version-draft-sessions/import-v2', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const applyGeoV3VersionDraftSession = (
  id: number,
  payload: GeoV3VersionDraftSessionApplyPayload = {}
) => {
  return request<GeoV3VersionDraftSuggestion>(`/geo-v3/version-draft-sessions/${id}/apply`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const createGeoV3BatchTxtJob = (payload: GeoV3BatchTxtJobPayload) => {
  return request<GeoV3BatchTxtJob>('/geo-v3/version-draft-sessions/batch-txt-jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const getGeoV3BatchTxtJob = (id: number) => {
  return request<GeoV3BatchTxtJob>(`/geo-v3/version-draft-sessions/batch-txt-jobs/${id}`)
}

export const retryFailedGeoV3BatchTxtJob = (id: number) => {
  return request<GeoV3BatchTxtJob>(`/geo-v3/version-draft-sessions/batch-txt-jobs/${id}/retry-failed`, {
    method: 'POST',
  })
}

export const getGeoV3VariableSets = () => {
  return request<GeoV3VariableSet[]>('/geo-v3/variables')
}

export const createGeoV3VariableSet = (payload: GeoV3VariableSetPayload) => {
  return request<GeoV3VariableSet>('/geo-v3/variables', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const updateGeoV3VariableSet = (id: number, payload: Partial<GeoV3VariableSetPayload>) => {
  return request<GeoV3VariableSet>(`/geo-v3/variables/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export const deleteGeoV3VariableSet = (id: number) => {
  return request<{ id: number; success: boolean }>(`/geo-v3/variables/${id}`, {
    method: 'DELETE',
  })
}

export const getGeoV3FixedRules = () => {
  return request<GeoV3FixedRules>('/geo-v3/fixed-rules')
}

export const updateGeoV3FixedRules = (ruleText: string) => {
  return request<GeoV3FixedRules>('/geo-v3/fixed-rules', {
    method: 'PATCH',
    body: JSON.stringify({ ruleText }),
  })
}

export const getGeoV3Products = () => {
  return request<GeoV3Product[]>('/geo-v3/products')
}

export const createGeoV3Product = (payload: GeoV3ProductPayload) => {
  return request<GeoV3Product>('/geo-v3/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const updateGeoV3Product = (id: number, payload: Partial<GeoV3ProductPayload>) => {
  return request<GeoV3Product>(`/geo-v3/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export const deleteGeoV3Product = (id: number) => {
  return request<{ id: number; success: boolean }>(`/geo-v3/products/${id}`, {
    method: 'DELETE',
  })
}

export const generateGeoV3Prompts = (payload: GeoV3GeneratePayload) => {
  return request<GeoV3GenerationRun>('/geo-v3/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const getGeoV3Runs = () => {
  return request<GeoV3GenerationRun[]>('/geo-v3/runs')
}

export const getGeoV3Run = (id: number) => {
  return request<GeoV3GenerationRun>(`/geo-v3/runs/${id}`)
}

export const downloadGeoV3Run = async (id: number) => {
  const response = await fetch(`${getApiBaseUrl()}/geo-v3/runs/${id}/download`)

  if (!response.ok) {
    const responseText = await response.text()

    try {
      const payload = responseText ? JSON.parse(responseText) : null
      throw new Error(parseErrorMessage(payload))
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : responseText || '下载失败')
    }
  }

  return {
    blob: await response.blob(),
    fileName: parseDownloadFileName(response.headers.get('Content-Disposition'), `geo-v3-run-${id}.zip`),
  }
}

export const createGeoPromptBatch = (payload: GeoPromptBatchCreatePayload) => {
  return request<GeoPromptBatchJob>('/geo/prompt-engine-batches', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const getGeoPromptBatches = () => {
  return request<GeoPromptBatchJob[]>('/geo/prompt-engine-batches')
}

export const getGeoPromptBatch = (id: number) => {
  return request<GeoPromptBatchJob>(`/geo/prompt-engine-batches/${id}`)
}

const parseDownloadFileName = (disposition: string | null, fallback: string) => {
  if (!disposition) return fallback

  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1])
    } catch {
      return encodedMatch[1]
    }
  }

  const plainMatch = disposition.match(/filename="?([^";]+)"?/i)
  return plainMatch?.[1] || fallback
}

export const downloadGeoPromptBatch = async (id: number) => {
  const response = await fetch(`${getApiBaseUrl()}/geo/prompt-engine-batches/${id}/download`)

  if (!response.ok) {
    const responseText = await response.text()

    try {
      const payload = responseText ? JSON.parse(responseText) : null
      throw new Error(parseErrorMessage(payload))
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : responseText || '下载失败')
    }
  }

  return {
    blob: await response.blob(),
    fileName: parseDownloadFileName(response.headers.get('Content-Disposition'), `prompt-batch-${id}.zip`),
  }
}

const buildQueryString = (query: object) => {
  const params = new URLSearchParams()

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params.set(key, String(value))
  })

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

export const getGeoPublicationRecords = (query: GeoPublicationRecordQuery = {}) => {
  return request<GeoPublicationRecord[]>(`/geo/publication-records${buildQueryString(query)}`)
}

export const getGeoPublicationStats = (query: GeoPublicationRecordQuery = {}) => {
  return request<GeoPublicationStats>(`/geo/publication-stats${buildQueryString(query)}`)
}

export const createGeoPublicationRecord = (payload: GeoPublicationRecordPayload) => {
  return request<GeoPublicationRecord>('/geo/publication-records', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const importGeoPublicationRecords = (file: File) => {
  const formData = new FormData()
  formData.set('file', file)

  return request<GeoPublicationImportResult>('/geo/publication-records/import', {
    method: 'POST',
    body: formData,
  })
}

export const updateGeoPublicationRecord = (
  id: number,
  payload: Partial<GeoPublicationRecordPayload>
) => {
  return request<GeoPublicationRecord>(`/geo/publication-records/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export const deleteGeoPublicationRecord = (id: number) => {
  return request<{ id: number; success: boolean }>(`/geo/publication-records/${id}`, {
    method: 'DELETE',
  })
}

export const getGeoPublicationOptions = () => {
  return request<GeoPublicationOptionsView>('/geo/publication-options')
}

export const createGeoPublicationOption = (payload: GeoPublicationOptionPayload) => {
  return request<GeoPublicationOption>('/geo/publication-options', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const getGeoPromptCodeOptions = (keyword = '') => {
  return request<GeoPromptCodeOption[]>(`/geo/prompt-code-options${buildQueryString({ keyword })}`)
}

export const getGeoPublicationCrawlSetting = () => {
  return request<GeoPublicationCrawlSetting>('/geo/publication-crawl/settings')
}

export const updateGeoPublicationCrawlSetting = (payload: Partial<GeoPublicationCrawlSetting>) => {
  return request<GeoPublicationCrawlSetting>('/geo/publication-crawl/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export const getGeoPublicationCrawlKeywords = () => {
  return request<GeoPublicationCrawlKeyword[]>('/geo/publication-crawl/keywords')
}

export const createGeoPublicationCrawlKeyword = (payload: GeoPublicationCrawlKeywordPayload) => {
  return request<GeoPublicationCrawlKeyword>('/geo/publication-crawl/keywords', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const updateGeoPublicationCrawlKeyword = (
  id: number,
  payload: Partial<GeoPublicationCrawlKeywordPayload>
) => {
  return request<GeoPublicationCrawlKeyword>(`/geo/publication-crawl/keywords/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export const deleteGeoPublicationCrawlKeyword = (id: number) => {
  return request<{ id: number; success: boolean }>(`/geo/publication-crawl/keywords/${id}`, {
    method: 'DELETE',
  })
}

export const createGeoPublicationCrawlJob = (payload: { product?: string } = {}) => {
  return request<GeoPublicationCrawlJob>('/geo/publication-crawl/jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const getGeoPublicationCrawlJobs = (product = '') => {
  return request<GeoPublicationCrawlJob[]>(`/geo/publication-crawl/jobs${buildQueryString({ product })}`)
}

export const getGeoPublicationCrawlJob = (id: number) => {
  return request<GeoPublicationCrawlJob>(`/geo/publication-crawl/jobs/${id}`)
}

export const getGeoSerpProjects = () => {
  return request<GeoSerpProjectSummary[]>('/geo/serp-projects')
}

export const getGeoSerpProject = (id: number) => {
  return request<GeoSerpProjectDetail>(`/geo/serp-projects/${id}`)
}

export const createGeoSerpProject = (payload: GeoSerpProjectPayload) => {
  return request<GeoSerpProjectDetail>('/geo/serp-projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const deleteGeoSerpProject = (id: number) => {
  return request<{ id: number; success: boolean }>(`/geo/serp-projects/${id}`, {
    method: 'DELETE',
  })
}

export const getGeoSerpProjectAiSummary = (id: number) => {
  return request<GeoSerpAiSummary>(`/geo/serp-projects/${id}/ai-summary`)
}

export const generateGeoSerpProjectAiSummary = (id: number) => {
  return request<GeoSerpAiSummary>(`/geo/serp-projects/${id}/ai-summary`, {
    method: 'POST',
  })
}

export const saveGeoSerpProjectAiSummary = (id: number, payload: GeoSerpAiSummaryDraft) => {
  return request<GeoSerpAiSummary>(`/geo/serp-projects/${id}/ai-summary`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export const getGeoAiSummaries = (category?: string) => {
  const searchParams = new URLSearchParams()
  if (category?.trim()) searchParams.set('category', category.trim())

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : ''
  return request<GeoSerpAiSummary[]>(`/geo/ai-summaries${suffix}`)
}

export const getGeoRuleCards = (options?: { category?: string; activeOnly?: boolean }) => {
  const searchParams = new URLSearchParams()
  if (options?.category?.trim()) searchParams.set('category', options.category.trim())
  if (options?.activeOnly) searchParams.set('activeOnly', 'true')

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : ''
  return request<GeoRuleCard[]>(`/geo/rule-cards${suffix}`)
}

export const getGeoRuleCard = (id: number) => {
  return request<GeoRuleCard>(`/geo/rule-cards/${id}`)
}

export const generateGeoRuleCard = (payload: GeoRuleCardGeneratePayload) => {
  return request<GeoRuleCard>('/geo/rule-cards/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const activateGeoRuleCard = (id: number, isActive = true) => {
  return request<GeoRuleCard>(`/geo/rule-cards/${id}/activate`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  })
}

const streamGeoSerpAiSummary = async (
  url: string,
  payload: GeoSerpAiSummaryTestPayload | undefined,
  options: {
    onEvent: (event: GeoSerpAiSummaryStreamEvent) => void
    signal?: AbortSignal
  }
) => {
  const processChunk = (chunk: string) => {
    if (!chunk) return

    const lines = chunk.split('\n')

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith('data: ')) continue

      try {
        const event = JSON.parse(line.slice(6)) as GeoSerpAiSummaryStreamEvent
        options.onEvent(event)
      } catch {
        continue
      }
    }
  }

  const response = await fetch(`${getApiBaseUrl()}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload ?? {}),
    signal: options.signal,
  })

  if (!response.ok) {
    const responseText = await response.text()

    try {
      const payload = responseText ? JSON.parse(responseText) : null
      throw new Error(parseErrorMessage(payload))
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : responseText || 'AI 总结生成失败')
    }
  }

  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error('当前浏览器不支持流式响应')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    processChunk(lines.join('\n'))
  }

  buffer += decoder.decode()
  processChunk(buffer)
}

export const streamGeoSerpProjectAiSummary = async (
  id: number,
  options: {
    onEvent: (event: GeoSerpAiSummaryStreamEvent) => void
    signal?: AbortSignal
  }
) => {
  return streamGeoSerpAiSummary(`/geo/serp-projects/${id}/ai-summary/stream`, undefined, options)
}

export const streamGeoSerpProjectAiSummaryTest = async (
  id: number,
  payload: GeoSerpAiSummaryTestPayload,
  options: {
    onEvent: (event: GeoSerpAiSummaryStreamEvent) => void
    signal?: AbortSignal
  }
) => {
  return streamGeoSerpAiSummary(`/geo/serp-projects/${id}/ai-summary/test-stream`, payload, options)
}

export const getGeoSerpProjectAiSummaryTestPrompt = (id: number, payload: GeoSerpAiSummaryTestPayload) => {
  return request<GeoSerpAiSummaryTestPrompt>(`/geo/serp-projects/${id}/ai-summary/test-prompt`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const getGeoSerpProjectAiSummaryPromptPreview = (id: number) => {
  return request<GeoSerpAiSummaryPromptPreview>(`/geo/serp-projects/${id}/ai-summary/prompt-preview`, {
    method: 'POST',
  })
}

export const streamGeoPrompt = async (
  payload: GeoGeneratePayload,
  options: {
    onEvent: (event: GeoStreamEvent) => void
    signal?: AbortSignal
  }
) => {
  const processChunk = (chunk: string) => {
    if (!chunk) return

    const lines = chunk.split('\n')

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith('data: ')) continue

      try {
        const event = JSON.parse(line.slice(6)) as GeoStreamEvent
        options.onEvent(event)
      } catch {
        continue
      }
    }
  }

  const response = await fetch(`${getApiBaseUrl()}/geo/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  })

  if (!response.ok) {
    const responseText = await response.text()

    try {
      const payload = responseText ? JSON.parse(responseText) : null
      throw new Error(parseErrorMessage(payload))
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : responseText || '生成失败')
    }
  }

  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error('当前浏览器不支持流式响应')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    processChunk(lines.join('\n'))
  }

  buffer += decoder.decode()
  processChunk(buffer)
}

export const streamGeoPromptV2 = async (
  payload: GeoGenerateV2Payload,
  options: {
    onEvent: (event: GeoStreamEvent) => void
    signal?: AbortSignal
  }
) => {
  const processChunk = (chunk: string) => {
    if (!chunk) return

    const lines = chunk.split('\n')

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith('data: ')) continue

      try {
        const event = JSON.parse(line.slice(6)) as GeoStreamEvent
        options.onEvent(event)
      } catch {
        continue
      }
    }
  }

  const response = await fetch(`${getApiBaseUrl()}/geo/generate-v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  })

  if (!response.ok) {
    const responseText = await response.text()

    try {
      const payload = responseText ? JSON.parse(responseText) : null
      throw new Error(parseErrorMessage(payload))
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : responseText || '生成失败')
    }
  }

  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error('当前浏览器不支持流式响应')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    processChunk(lines.join('\n'))
  }

  buffer += decoder.decode()
  processChunk(buffer)
}

export const streamGeoPromptEngineV2VersionDraftChat = async (
  payload: GeoPromptEngineVersionDraftChatPayload,
  options: {
    onEvent: (event: GeoStreamEvent) => void
    signal?: AbortSignal
  }
) => {
  const processChunk = (chunk: string) => {
    if (!chunk) return

    const lines = chunk.split('\n')

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith('data: ')) continue

      try {
        const event = JSON.parse(line.slice(6)) as GeoStreamEvent
        options.onEvent(event)
      } catch {
        continue
      }
    }
  }

  const response = await fetch(`${getApiBaseUrl()}/geo/prompt-engine-v2/version-drafts/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  })

  if (!response.ok) {
    const responseText = await response.text()

    try {
      const payload = responseText ? JSON.parse(responseText) : null
      throw new Error(parseErrorMessage(payload))
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : responseText || '生成失败')
    }
  }

  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error('当前浏览器不支持流式响应')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    processChunk(lines.join('\n'))
  }

  buffer += decoder.decode()
  processChunk(buffer)
}

export const streamGeoV3VersionDraftChat = async (
  payload: GeoV3VersionDraftChatPayload,
  options: {
    onEvent: (event: GeoStreamEvent) => void
    signal?: AbortSignal
  }
) => {
  const processChunk = (chunk: string) => {
    if (!chunk) return

    const lines = chunk.split('\n')

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith('data: ')) continue

      try {
        const event = JSON.parse(line.slice(6)) as GeoStreamEvent
        options.onEvent(event)
      } catch {
        continue
      }
    }
  }

  const response = await fetch(`${getApiBaseUrl()}/geo-v3/versions/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  })

  if (!response.ok) {
    const responseText = await response.text()

    try {
      const payload = responseText ? JSON.parse(responseText) : null
      throw new Error(parseErrorMessage(payload))
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : responseText || '生成失败')
    }
  }

  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error('当前浏览器不支持流式响应')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    processChunk(lines.join('\n'))
  }

  buffer += decoder.decode()
  processChunk(buffer)
}

export const streamGeoV3VersionDraftSessionChat = async (
  id: number,
  options: {
    onEvent: (event: GeoStreamEvent) => void
    signal?: AbortSignal
  }
) => {
  const processChunk = (chunk: string) => {
    if (!chunk) return

    const lines = chunk.split('\n')

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith('data: ')) continue

      try {
        const event = JSON.parse(line.slice(6)) as GeoStreamEvent
        options.onEvent(event)
      } catch {
        continue
      }
    }
  }

  const response = await fetch(`${getApiBaseUrl()}/geo-v3/version-draft-sessions/${id}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
    signal: options.signal,
  })

  if (!response.ok) {
    const responseText = await response.text()

    try {
      const payload = responseText ? JSON.parse(responseText) : null
      throw new Error(parseErrorMessage(payload))
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : responseText || '生成失败')
    }
  }

  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error('当前浏览器不支持流式响应')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    processChunk(lines.join('\n'))
  }

  buffer += decoder.decode()
  processChunk(buffer)
}

export const streamGeoPromptEngineV2VersionDraftSessionChat = async (
  id: number,
  options: {
    onEvent: (event: GeoStreamEvent) => void
    signal?: AbortSignal
  }
) => {
  const processChunk = (chunk: string) => {
    if (!chunk) return

    const lines = chunk.split('\n')

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith('data: ')) continue

      try {
        const event = JSON.parse(line.slice(6)) as GeoStreamEvent
        options.onEvent(event)
      } catch {
        continue
      }
    }
  }

  const response = await fetch(`${getApiBaseUrl()}/geo/prompt-engine-v2/version-draft-sessions/${id}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
    signal: options.signal,
  })

  if (!response.ok) {
    const responseText = await response.text()

    try {
      const payload = responseText ? JSON.parse(responseText) : null
      throw new Error(parseErrorMessage(payload))
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : responseText || '生成失败')
    }
  }

  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error('当前浏览器不支持流式响应')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    processChunk(lines.join('\n'))
  }

  buffer += decoder.decode()
  processChunk(buffer)
}
