export interface UserItem {
  id: number
  name: string
  username: string
  role: string
  phone: string
  status: '启用' | '停用'
  createdAt: string
}

export interface UserForm {
  name: string
  username: string
  role: string
  phone: string
  status: '启用' | '停用'
  password?: string
}

export type UserFormPayload = Omit<UserForm, 'password'> & {
  password?: string
}
