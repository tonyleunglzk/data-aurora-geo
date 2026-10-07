import { request } from './client'
import type { UserFormPayload, UserItem } from '@/types/user'

export const getUsers = () => {
  return request<UserItem[]>('/users')
}

export const createUser = (payload: UserFormPayload) => {
  return request<UserItem>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const updateUser = (id: number, payload: Partial<UserFormPayload>) => {
  return request<UserItem>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export const deleteUser = (id: number) => {
  return request<UserItem>(`/users/${id}`, {
    method: 'DELETE',
  })
}
