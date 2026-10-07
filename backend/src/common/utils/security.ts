import { createHash } from 'node:crypto'

export const hashPassword = (password: string) => {
  return createHash('sha256').update(password).digest('hex')
}

export const issueAccessToken = (userId: number, username: string) => {
  const payload = `${userId}:${username}:${Date.now()}`
  return Buffer.from(payload).toString('base64url')
}
