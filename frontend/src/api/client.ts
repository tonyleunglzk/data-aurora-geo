const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:19988/api' : '/api')

export const getApiBaseUrl = () => API_BASE_URL

const extractErrorMessage = (payload: unknown) => {
  if (!payload) return '请求失败，请稍后重试'

  if (typeof payload === 'string') return payload

  if (typeof payload === 'object' && payload !== null) {
    const message = Reflect.get(payload, 'message')

    if (Array.isArray(message) && message.length > 0) {
      return String(message[0])
    }

    if (typeof message === 'string') {
      return message
    }
  }

  return '请求失败，请稍后重试'
}

const isJsonResponse = (response: Response) => {
  const contentType = response.headers.get('Content-Type') || ''

  return contentType.includes('application/json') || contentType.includes('+json')
}

const looksLikeJson = (responseText: string) => {
  const trimmedText = responseText.trim()

  return trimmedText.startsWith('{') || trimmedText.startsWith('[')
}

const createNonJsonErrorMessage = (response: Response, responseText: string) => {
  const preview = responseText.replace(/\s+/g, ' ').trim().slice(0, 120)
  const hint = responseText.trim().startsWith('<')
    ? '接口返回了 HTML 页面，可能是后端接口未部署、服务未重启，或 nginx 代理没有命中 /api。'
    : '接口返回了非 JSON 内容。'

  return `${hint} HTTP ${response.status}${preview ? `：${preview}` : ''}`
}

export async function request<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  const isFormDataBody = typeof FormData !== 'undefined' && init.body instanceof FormData

  if (init.body && !headers.has('Content-Type') && !isFormDataBody) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  })

  const responseText = await response.text()

  if (!responseText) {
    if (!response.ok) {
      throw new Error(`请求失败（HTTP ${response.status}）`)
    }

    return null as T
  }

  if (!isJsonResponse(response) && !looksLikeJson(responseText)) {
    throw new Error(createNonJsonErrorMessage(response, responseText))
  }

  let payload: unknown = null

  try {
    payload = JSON.parse(responseText)
  } catch {
    throw new Error(`接口返回的 JSON 格式不正确（HTTP ${response.status}）`)
  }

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload))
  }

  return payload as T
}
