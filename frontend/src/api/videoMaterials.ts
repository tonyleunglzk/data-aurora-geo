import { getApiBaseUrl, request } from './client'

export type VideoMaterialProductCategory =
  | 'SUN_PROTECTIVE_CLOTHING'
  | 'SHELL_JACKET'

export type VideoMaterialStatus = 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED'

export type VideoMaterialAiStatus =
  | 'NOT_STARTED'
  | 'QUEUED'
  | 'ANALYZING'
  | 'COMPLETED'
  | 'FAILED'

export type VideoMaterialReviewStatus = 'PENDING' | 'CONFIRMED' | 'NEEDS_REVIEW'
export type VideoMaterialMotionLevel = 'UNKNOWN' | 'STATIC' | 'LOW' | 'MEDIUM' | 'HIGH'
export type VideoMaterialSpeechBoundaryStatus =
  | 'UNKNOWN'
  | 'NO_SPEECH'
  | 'CLEAN'
  | 'CROSSES_START'
  | 'CROSSES_END'
  | 'CROSSES_BOTH'

export interface VideoMaterialContentType {
  value: string
  label: string
}

export interface VideoMaterialTaxonomy {
  value: VideoMaterialProductCategory
  label: string
  shotTypes: VideoMaterialContentType[]
  contentTypes: VideoMaterialContentType[]
}

export interface VideoMaterialSegmentationDiagnostics {
  detectedSceneCount: number
  atomicSegmentCount: number
  mergedShortSegmentCount: number
  forcedSplitCount: number
  outputSegmentCount: number
  shortestSegmentMs: number
  longestSegmentMs: number
  averageSegmentMs: number
}

export interface VideoMaterialClip {
  id: number
  materialId: number
  clipIndex: number
  startMs: number
  endMs: number
  durationMs: number
  clipUrl: string
  keyframeUrl: string
  shotType: string
  contentType: string
  contentTopics: string[]
  description: string
  tags: string[]
  actions: string[]
  objects: string[]
  scenes: string[]
  brands: string[]
  qualityFlags: string[]
  qualityScore: number | null
  usabilityScore: number | null
  hasPerson: boolean
  hasTextOverlay: boolean
  transcript: string
  transcriptContext: string
  speechBoundaryStatus: VideoMaterialSpeechBoundaryStatus
  motionScore: number | null
  motionLevel: VideoMaterialMotionLevel
  confidence: number | null
  aiModel: string
  analyzedAt: string | null
  reviewStatus: VideoMaterialReviewStatus
  createdAt: string
  updatedAt: string
}

export interface VideoMaterial {
  id: number
  productCategory: VideoMaterialProductCategory
  originalName: string
  sourceFileName: string
  sourceUrl: string
  mimeType: string
  fileSizeBytes: string
  durationMs: number
  width: number
  height: number
  fps: number
  videoCodec: string
  audioCodec: string
  hasAudio: boolean
  status: VideoMaterialStatus
  progress: number
  stage: string
  errorMessage: string
  sceneThreshold: number
  minClipDurationMs: number
  maxClipDurationMs: number
  clipCount: number
  transcriptSegmentCount: number
  aiStatus: VideoMaterialAiStatus
  aiProgress: number
  aiStage: string
  aiErrorMessage: string
  aiModel: string
  aiInputTokens: number
  aiOutputTokens: number
  aiAudioSeconds: number
  aiStartedAt: string | null
  aiCompletedAt: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  segmentation: VideoMaterialSegmentationDiagnostics | null
  clips?: VideoMaterialClip[]
}

export interface VideoMaterialAiConfiguration {
  configured: boolean
  visionModel: string
  asrModel: string
  timelineAsrModel: string
  timelineAsrConfigured: boolean
  textModel: string
}

export interface VideoMaterialAiAnalysisInput {
  reanalyzeConfirmed?: boolean
  clipIds?: number[]
}

export interface VideoMaterialAiAnalysisPreview {
  materialId: number
  clipIds: number[]
  clipCount: number
  confirmedClipCount: number
  existingTranscriptCount: number
  audioSeconds: number
  timelineSegmentCount: number
  timelineWillBeCreated: boolean
  keyframeCount: number
  estimatedInputTokens: number | null
  estimatedOutputTokens: number | null
  visionModel: string
  asrModel: string
  timelineAsrModel: string
}

export interface UploadVideoMaterialOptions {
  productCategory: VideoMaterialProductCategory
  sceneThreshold: number
  minClipDurationMs: number
  maxClipDurationMs: number
}

export interface VideoMaterialSegmentationPreview {
  materialId: number
  configuration: Pick<
    UploadVideoMaterialOptions,
    'sceneThreshold' | 'minClipDurationMs' | 'maxClipDurationMs'
  >
  current: {
    clipCount: number
    shortestSegmentMs: number
    longestSegmentMs: number
    averageSegmentMs: number
    confirmedClipCount: number
  }
  preview: VideoMaterialSegmentationDiagnostics & {
    segments: Array<{
      clipIndex: number
      startMs: number
      endMs: number
      durationMs: number
    }>
  }
  linkedSceneCount: number
}

export interface UpdateVideoMaterialClipInput {
  shotType?: string
  contentType?: string
  description?: string
  tags?: string[]
  contentTopics?: string[]
  actions?: string[]
  objects?: string[]
  scenes?: string[]
  brands?: string[]
  qualityFlags?: string[]
  qualityScore?: number
  usabilityScore?: number
  hasPerson?: boolean
  hasTextOverlay?: boolean
  reviewStatus?: VideoMaterialReviewStatus
}

export const resolveVideoMaterialUrl = (path: string) => {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path

  const apiBaseUrl = getApiBaseUrl().replace(/\/$/, '')
  if (path.startsWith('/api/') && apiBaseUrl.endsWith('/api')) {
    return `${apiBaseUrl.slice(0, -4)}${path}`
  }

  return `${apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`
}

export const fetchVideoMaterialTaxonomy = () =>
  request<VideoMaterialTaxonomy[]>('/video-materials/taxonomy')

export const fetchVideoMaterialAiConfiguration = () =>
  request<VideoMaterialAiConfiguration>('/video-materials/ai-configuration')

export const fetchVideoMaterials = (productCategory: VideoMaterialProductCategory) =>
  request<VideoMaterial[]>(
    `/video-materials/materials?productCategory=${encodeURIComponent(productCategory)}`
  )

export const fetchVideoMaterial = (id: number) =>
  request<VideoMaterial>(`/video-materials/materials/${id}`)

export const uploadVideoMaterial = (file: File, options: UploadVideoMaterialOptions) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('productCategory', options.productCategory)
  formData.append('sceneThreshold', String(options.sceneThreshold))
  formData.append('minClipDurationMs', String(options.minClipDurationMs))
  formData.append('maxClipDurationMs', String(options.maxClipDurationMs))

  return request<VideoMaterial>('/video-materials/materials/upload', {
    method: 'POST',
    body: formData,
  })
}

export const reprocessVideoMaterial = (
  id: number,
  input: Pick<
    UploadVideoMaterialOptions,
    'sceneThreshold' | 'minClipDurationMs' | 'maxClipDurationMs'
  >
) => request<VideoMaterial>(`/video-materials/materials/${id}/reprocess`, {
  method: 'POST',
  body: JSON.stringify(input),
})

export const previewVideoMaterialSegmentation = (
  id: number,
  input: Pick<
    UploadVideoMaterialOptions,
    'sceneThreshold' | 'minClipDurationMs' | 'maxClipDurationMs'
  >
) => request<VideoMaterialSegmentationPreview>(
  `/video-materials/materials/${id}/segmentation-preview`,
  {
    method: 'POST',
    body: JSON.stringify(input),
  }
)

export const previewVideoMaterialAiAnalysis = (
  id: number,
  input: VideoMaterialAiAnalysisInput = {}
) => request<VideoMaterialAiAnalysisPreview>(
  `/video-materials/materials/${id}/analyze-preview`,
  {
    method: 'POST',
    body: JSON.stringify(input),
  }
)

export const analyzeVideoMaterial = (
  id: number,
  input: VideoMaterialAiAnalysisInput = {}
) =>
  request<VideoMaterial>(`/video-materials/materials/${id}/analyze`, {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const confirmVideoMaterialAiClips = (id: number, threshold = 0.75) =>
  request<{ confirmedCount: number; threshold: number }>(
    `/video-materials/materials/${id}/confirm-ai`,
    {
      method: 'POST',
      body: JSON.stringify({ threshold }),
    }
  )

export const removeVideoMaterial = (id: number) =>
  request<{ id: number }>(`/video-materials/materials/${id}`, {
    method: 'DELETE',
  })

export const updateVideoMaterialClip = (id: number, input: UpdateVideoMaterialClipInput) =>
  request<VideoMaterialClip>(`/video-materials/clips/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
