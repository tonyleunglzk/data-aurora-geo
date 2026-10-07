export interface AuthUser {
  id: number
  username: string
  name: string
  role: string
  avatar: string
}

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  user: AuthUser
}
