import { request } from './client'
import type { LoginPayload, LoginResponse } from '@/types/auth'

export const loginApi = (payload: LoginPayload) => {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
