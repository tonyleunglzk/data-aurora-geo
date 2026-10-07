import { request } from './client'
import type {
  AutoGenerateChangelogEntryPayload,
  ChangelogEntry,
  ChangelogEntryPayload,
} from '@/types/changelog'

export const getChangelogEntries = () => {
  return request<ChangelogEntry[]>('/changelog-entries')
}

export const getChangelogEntry = (id: number) => {
  return request<ChangelogEntry>(`/changelog-entries/${id}`)
}

export const createChangelogEntry = (payload: ChangelogEntryPayload) => {
  return request<ChangelogEntry>('/changelog-entries', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const autoGenerateChangelogEntry = (payload: AutoGenerateChangelogEntryPayload) => {
  return request<ChangelogEntry>('/changelog-entries/auto-generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const updateChangelogEntry = (id: number, payload: Partial<ChangelogEntryPayload>) => {
  return request<ChangelogEntry>(`/changelog-entries/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export const deleteChangelogEntry = (id: number) => {
  return request<ChangelogEntry>(`/changelog-entries/${id}`, {
    method: 'DELETE',
  })
}
