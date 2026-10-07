import { request } from './client'
import type { VideoMaterialProductCategory } from './videoMaterials'

export type VideoAssemblyStatus =
  | 'DRAFT'
  | 'PLANNING'
  | 'MATCHING'
  | 'READY'
  | 'RENDER_QUEUED'
  | 'RENDERING'
  | 'COMPLETED'
  | 'FAILED'

export type VideoAssemblySourceMode = 'ALL' | 'SELECTED'
export type VideoAssemblyFramingMode = 'SMART' | 'FILL_CROP' | 'FIT_BLUR'
export type VideoAssemblyVisualIntent =
  | 'INFORMATION'
  | 'ACTION'
  | 'EXPERIENCE'
  | 'PRODUCT'
  | 'MIXED'

export interface VideoAssemblyScoreBreakdown {
  content: number
  visualIntent: number
  keywords: number
  quality: number
  penalties: number
}

export interface VideoAssemblyCandidate {
  clipId: number
  score: number
  reason: string
  materialId: number
  materialName: string
  clipIndex: number
  durationMs: number
  shotType: string
  contentType: string
  description: string
  keyframeUrl: string
  clipUrl: string
  reviewStatus: string
  motionScore: number | null
  motionLevel: string
  visualCompatible: boolean
  staticFallback: boolean
  scoreBreakdown: VideoAssemblyScoreBreakdown
  warningFlags: string[]
}

export interface VideoAssemblySelectedClip {
  id: number
  materialId: number
  materialName: string
  clipIndex: number
  durationMs: number
  shotType: string
  contentType: string
  description: string
  keyframeUrl: string
  clipUrl: string
  reviewStatus: string
  motionScore: number | null
  motionLevel: string
}

export interface VideoAssemblyScene {
  id: number
  projectId: number
  sceneIndex: number
  narrationText: string
  targetDurationMs: number
  visualBrief: string
  visualIntent: VideoAssemblyVisualIntent
  contentTypes: string[]
  shotTypes: string[]
  keywords: string[]
  negativeKeywords: string[]
  selectedClipId: number | null
  clipStartOffsetMs: number
  clipDurationMs: number
  matchScore: number | null
  matchReason: string
  candidates: VideoAssemblyCandidate[]
  warningFlags: string[]
  status: string
  selectedClip: VideoAssemblySelectedClip | null
  createdAt: string
  updatedAt: string
}

export interface VideoAssemblyProject {
  id: number
  productCategory: VideoMaterialProductCategory
  name: string
  narrationText: string
  status: VideoAssemblyStatus
  progress: number
  stage: string
  errorMessage: string
  aspectRatio: '9:16' | '16:9' | '1:1'
  removeSourceSubtitles: boolean
  sourceMode: VideoAssemblySourceMode
  sourceMaterialIds: number[]
  sourceMaterials: Array<{
    id: number
    originalName: string
    status: string
    clipCount: number
  }>
  framingMode: VideoAssemblyFramingMode
  narrationAudioFileName: string
  narrationAudioUrl: string
  outputFileName: string
  outputUrl: string
  outputStale: boolean
  durationMs: number
  aiModel: string
  aiInputTokens: number
  aiOutputTokens: number
  sceneCount: number
  createdAt: string
  updatedAt: string
  completedAt: string | null
  scenes?: VideoAssemblyScene[]
}

export interface CreateVideoAssemblyProjectInput {
  productCategory: VideoMaterialProductCategory
  name: string
  narrationText: string
  aspectRatio: '9:16' | '16:9' | '1:1'
  removeSourceSubtitles: boolean
  sourceMode: VideoAssemblySourceMode
  sourceMaterialIds: number[]
  framingMode: VideoAssemblyFramingMode
}

export interface UpdateVideoAssemblySceneInput {
  selectedClipId?: number
  clipStartOffsetMs?: number
  clipDurationMs?: number
  narrationText?: string
  visualBrief?: string
  visualIntent?: VideoAssemblyVisualIntent
  contentTypes?: string[]
  shotTypes?: string[]
  keywords?: string[]
  negativeKeywords?: string[]
}

export const fetchVideoAssemblyProjects = (productCategory: VideoMaterialProductCategory) =>
  request<VideoAssemblyProject[]>(
    `/video-materials/assembly/projects?productCategory=${encodeURIComponent(productCategory)}`
  )

export const fetchVideoAssemblyProject = (id: number) =>
  request<VideoAssemblyProject>(`/video-materials/assembly/projects/${id}`)

export const createVideoAssemblyProject = (payload: CreateVideoAssemblyProjectInput) =>
  request<VideoAssemblyProject>('/video-materials/assembly/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateVideoAssemblyProject = (
  id: number,
  payload: Partial<Omit<CreateVideoAssemblyProjectInput, 'productCategory'>>
) => request<VideoAssemblyProject>(`/video-materials/assembly/projects/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(payload),
})

export const removeVideoAssemblyProject = (id: number) =>
  request<{ id: number }>(`/video-materials/assembly/projects/${id}`, { method: 'DELETE' })

export const planVideoAssemblyProject = (id: number) =>
  request<VideoAssemblyProject>(`/video-materials/assembly/projects/${id}/plan`, {
    method: 'POST',
    body: JSON.stringify({}),
  })

export const matchVideoAssemblyProject = (id: number, confirmedOnly = false) =>
  request<VideoAssemblyProject>(`/video-materials/assembly/projects/${id}/match`, {
    method: 'POST',
    body: JSON.stringify({ confirmedOnly }),
  })

export const updateVideoAssemblyScene = (id: number, payload: UpdateVideoAssemblySceneInput) =>
  request<VideoAssemblyProject>(`/video-materials/assembly/scenes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

export const uploadVideoAssemblyAudio = (id: number, audio: File) => {
  const formData = new FormData()
  formData.append('audio', audio)
  return request<VideoAssemblyProject>(`/video-materials/assembly/projects/${id}/audio`, {
    method: 'POST',
    body: formData,
  })
}

export const renderVideoAssemblyProject = (id: number) =>
  request<VideoAssemblyProject>(`/video-materials/assembly/projects/${id}/render`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
