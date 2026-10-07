export type ChangelogSourceType = 'manual' | 'ai_delivery'

export interface ChangelogEntry {
  id: number
  title: string
  batchNo: string
  releaseDate: string
  summary: string
  addedItems: string[]
  changedItems: string[]
  removedItems: string[]
  affectedModules: string[]
  sourceType: ChangelogSourceType
  publishedAt: string
  createdAt: string
  updatedAt: string
}

export interface ChangelogEntryPayload {
  title: string
  releaseDate: string
  summary: string
  addedItems: string[]
  changedItems: string[]
  removedItems: string[]
  affectedModules?: string[]
  sourceType?: ChangelogSourceType
}

export interface AutoGenerateChangelogEntryPayload {
  title: string
  releaseDate?: string
  summary: string
  addedItems: string[]
  changedItems: string[]
  removedItems: string[]
  affectedModules?: string[]
  sourceType?: 'ai_delivery'
}
