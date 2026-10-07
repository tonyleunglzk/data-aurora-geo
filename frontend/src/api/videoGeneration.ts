import { request } from './client'

export type SeedanceTaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | string

export type VideoGenerationTemplateType =
  | 'CAT_TALK'
  | 'HUMAN_TALK'
  | 'PRODUCT_SHOWCASE'
  | 'KNOWLEDGE_EXPLAINER'
  | 'SEEDING_RECOMMENDATION'
  | 'COMPARISON_REVIEW'
  | 'CUSTOM'

export type VideoGenerationSourceType = 'MANUAL' | 'GEO_V3_PRODUCT' | 'GEO_V3_RUN' | 'GEO_V3_ITEM'
export type VideoGenerationCampaignStatus = 'DRAFT' | 'RUNNING' | 'COMPLETED' | 'PARTIAL_FAILED' | 'FAILED'
export type VideoGenerationAssetKind = 'IMAGE' | 'VIDEO' | 'AUDIO'
export type VideoGenerationAssetStatus = 'PLANNED' | 'GENERATING' | 'READY' | 'FAILED'
export type VideoGenerationAssetSourceType = 'PLANNED' | 'UPLOADED' | 'GENERATED' | 'TRANSFERRED' | 'REMOTE'
export type VideoGenerationAssetPriority = 'REQUIRED' | 'RECOMMENDED' | 'OPTIONAL'
export type VideoGenerationTransferStatus = 'NOT_STARTED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
export type VideoGenerationTaskStatus =
  | 'CREATED'
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'

export type SeedanceContentItem =
  | {
      type: 'text'
      text: string
    }
  | {
      type: 'image_url'
      image_url: {
        url: string
      }
      role?: string
    }
  | {
      type: 'video_url'
      video_url: {
        url: string
      }
      role?: string
    }
  | {
      type: 'audio_url'
      audio_url: {
        url: string
      }
      role?: string
    }

export interface CreateSeedanceTaskPayload {
  model: string
  content: SeedanceContentItem[]
  generate_audio: boolean
  ratio: string
  duration: number
  watermark: boolean
  resolution?: string
  seed?: number
  camera_fixed?: boolean
  return_last_frame?: boolean
  callback_url?: string
}

export interface VideoGenerationUploadResult {
  fileName: string
  relativePath: string
  url: string
}

export interface SeedanceTaskResult {
  id: string
  model?: string
  status: SeedanceTaskStatus
  content?: {
    video_url?: string
  }
  usage?: {
    completion_tokens?: number
    total_tokens?: number
  }
  created_at?: number
  updated_at?: number
  seed?: number
  resolution?: string
  ratio?: string
  duration?: number
  framespersecond?: number
  service_tier?: string
  execution_expires_after?: number
  error?: {
    code?: string
    message?: string
  } | string
  localTask?: VideoGenerationTask
}

export interface VideoGenerationTemplate {
  id: number
  key: string
  name: string
  type: VideoGenerationTemplateType
  description: string
  model: string
  resolution: string
  ratio: string
  duration: number
  generateAudio: boolean
  watermark: boolean
  promptTemplate: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface VideoGenerationTask {
  id: number
  campaignId: number | null
  providerTaskId: string
  status: VideoGenerationTaskStatus
  model: string
  resolution: string
  ratio: string
  duration: number
  generateAudio: boolean
  watermark: boolean
  cameraFixed: boolean | null
  returnLastFrame: boolean
  callbackUrl: string
  promptText: string
  content: unknown
  referenceAssets: unknown
  productSnapshot: Record<string, unknown> | null
  sourceSnapshot: Record<string, unknown> | null
  videoUrl: string
  videoUrlExpiresAt: string | null
  lastFrameUrl: string
  transferredVideoUrl: string | null
  localVideoPath: string | null
  transferStatus: VideoGenerationTransferStatus
  transferError: string | null
  transferredAt: string | null
  usage: {
    completion_tokens?: number
    total_tokens?: number
    [key: string]: unknown
  } | null
  seed: number | null
  framesPerSecond: number | null
  serviceTier: string
  executionExpiresAfter: number | null
  errorCode: string
  errorMessage: string
  arkResponse: unknown
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface VideoGenerationAsset {
  id: number
  productProfileId: number | null
  campaignId: number | null
  taskId: number | null
  planKey: string
  title: string
  kind: VideoGenerationAssetKind
  role: string
  priority: VideoGenerationAssetPriority
  status: VideoGenerationAssetStatus
  sourceType: VideoGenerationAssetSourceType
  stage: string
  purpose: string
  brief: string
  prompt: string
  toolHint: string
  sourceFields: string[]
  url: string | null
  localPath: string | null
  provider: string
  providerTaskId: string
  model: string
  errorMessage: string
  productSnapshot: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface VideoGenerationStoryboardScene {
  index: number
  timeRange: string
  title: string
  visual: string
  narration: string
  seedancePrompt: string
  assetRoles: string[]
}

export interface VideoGenerationStoryboard {
  id: number
  productProfileId: number | null
  campaignId: number | null
  sourceType: VideoGenerationSourceType | null
  title: string
  topicText: string
  scriptText: string
  scenes: VideoGenerationStoryboardScene[]
  productSnapshot: Record<string, unknown> | null
  sourceSnapshot: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface VideoGenerationCampaign {
  id: number
  name: string
  sourceType: VideoGenerationSourceType
  status: VideoGenerationCampaignStatus
  templateId: number | null
  templateName: string
  productProfileId: number | null
  geoRunId: number | null
  geoItemId: number | null
  topicText: string
  productSnapshot: Record<string, unknown> | null
  sourceSnapshot: Record<string, unknown> | null
  requestedCount: number
  successCount: number
  failedCount: number
  runningCount: number
  queuedCount: number
  lastError: string
  tasks: VideoGenerationTask[]
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface CreateVideoGenerationTemplatePayload {
  key?: string
  name: string
  type: VideoGenerationTemplateType
  description?: string
  model: string
  resolution: string
  ratio: string
  duration: number
  generateAudio?: boolean
  watermark?: boolean
  promptTemplate: string
  isActive?: boolean
  sortOrder?: number
}

export type UpdateVideoGenerationTemplatePayload = Partial<Omit<CreateVideoGenerationTemplatePayload, 'key'>>

export interface CreateVideoGenerationCampaignPayload {
  name?: string
  sourceType: VideoGenerationSourceType
  templateId: number
  productProfileId?: number
  geoRunId?: number
  geoItemId?: number
  topics: string[]
  referenceAssets?: SeedanceContentItem[]
  model?: string
  resolution?: string
  ratio?: string
  duration?: number
  seed?: number
  cameraFixed?: boolean
  returnLastFrame?: boolean
  callbackUrl?: string
}

export interface CreateVideoGenerationCampaignTasksPayload {
  topics?: string[]
  referenceAssets?: SeedanceContentItem[]
  seed?: number
  cameraFixed?: boolean
  returnLastFrame?: boolean
  callbackUrl?: string
}

export interface ImportVideoGenerationTaskPayload {
  taskId: string
  campaignId?: number
}

export interface PlanVideoGenerationAssetsPayload {
  productProfileId: number
}

export interface GenerateVideoAssetImagePayload {
  prompt?: string
  size?: string
}

export interface GenerateVideoStoryboardPayload {
  productProfileId?: number
  campaignId?: number
  sourceType?: VideoGenerationSourceType
  topics?: string[]
  title?: string
}

export const createSeedanceTask = (payload: CreateSeedanceTaskPayload) => {
  return request<SeedanceTaskResult>('/video-generation/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const uploadVideoGenerationImage = async (file: File, timeoutMs = 60000) => {
  const formData = new FormData()
  formData.append('file', file)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await request<VideoGenerationUploadResult>('/video-generation/uploads/image', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('图片上传超时，请检查网络或换一张更小的图片')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export const getSeedanceTask = (taskId: string) => {
  return request<SeedanceTaskResult | VideoGenerationTask>(`/video-generation/tasks/${encodeURIComponent(taskId)}`)
}

export const getVideoGenerationTemplates = () => {
  return request<VideoGenerationTemplate[]>('/video-generation/templates')
}

export const createVideoGenerationTemplate = (payload: CreateVideoGenerationTemplatePayload) => {
  return request<VideoGenerationTemplate>('/video-generation/templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const updateVideoGenerationTemplate = (id: number, payload: UpdateVideoGenerationTemplatePayload) => {
  return request<VideoGenerationTemplate>(`/video-generation/templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export const getVideoGenerationAssets = (query: Record<string, string | number | undefined> = {}) => {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  const search = params.toString()
  return request<VideoGenerationAsset[]>(`/video-generation/assets${search ? `?${search}` : ''}`)
}

export const planVideoGenerationAssets = (payload: PlanVideoGenerationAssetsPayload) => {
  return request<VideoGenerationAsset[]>('/video-generation/assets/plan', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const generateVideoAssetImage = (id: number, payload: GenerateVideoAssetImagePayload = {}) => {
  return request<VideoGenerationAsset>(`/video-generation/assets/${id}/generate-image`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const getVideoGenerationStoryboards = (query: Record<string, string | number | undefined> = {}) => {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  const search = params.toString()
  return request<VideoGenerationStoryboard[]>(`/video-generation/storyboards${search ? `?${search}` : ''}`)
}

export const generateVideoStoryboard = (payload: GenerateVideoStoryboardPayload) => {
  return request<VideoGenerationStoryboard>('/video-generation/storyboards/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const getVideoGenerationCampaigns = (query: Record<string, string | number | undefined> = {}) => {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  const search = params.toString()
  return request<VideoGenerationCampaign[]>(`/video-generation/campaigns${search ? `?${search}` : ''}`)
}

export const createVideoGenerationCampaign = (payload: CreateVideoGenerationCampaignPayload) => {
  return request<VideoGenerationCampaign>('/video-generation/campaigns', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const getVideoGenerationCampaign = (id: number) => {
  return request<VideoGenerationCampaign>(`/video-generation/campaigns/${id}`)
}

export const createVideoGenerationCampaignTasks = (
  id: number,
  payload: CreateVideoGenerationCampaignTasksPayload
) => {
  return request<{ campaign: VideoGenerationCampaign; tasks: VideoGenerationTask[] }>(
    `/video-generation/campaigns/${id}/tasks`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
}

export const importVideoGenerationTask = (payload: ImportVideoGenerationTaskPayload) => {
  return request<VideoGenerationTask>('/video-generation/tasks/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const refreshVideoGenerationTask = (id: number | string) => {
  return request<VideoGenerationTask>(`/video-generation/tasks/${encodeURIComponent(String(id))}/refresh`, {
    method: 'POST',
  })
}

export const refreshRunningVideoGenerationTasks = () => {
  return request<VideoGenerationTask[]>('/video-generation/tasks/refresh-running', {
    method: 'POST',
  })
}

export const getRecentVideoGenerationTasks = (limit = 10) => {
  return request<VideoGenerationTask[]>(`/video-generation/tasks/recent?limit=${encodeURIComponent(String(limit))}`)
}
