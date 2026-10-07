import { request } from './client'
import type { AppSettings } from '@/types/settings'

export const getSettings = () => {
  return request<AppSettings>('/settings')
}

export const updateSettings = (payload: AppSettings) => {
  return request<AppSettings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
