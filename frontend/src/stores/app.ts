import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getSettings } from '@/api/settings'
import type { AuthUser } from '@/types/auth'
import type { AppSettings } from '@/types/settings'

const AUTH_STORAGE_KEY = 'data-aurora-auth'

type StoredAuthState = {
  token: string
  currentUser: AuthUser
}

export interface VisitedView {
  path: string
  title: string
  closable: boolean
}

const defaultVisitedViews: VisitedView[] = [
  {
    path: '/dashboard',
    title: '演示',
    closable: false,
  },
]

const defaultCurrentUser: AuthUser = {
  id: 0,
  username: 'admin',
  name: 'Aurora Admin',
  role: '超级管理员',
  avatar: 'A',
}

const readStoredAuthState = (): StoredAuthState | null => {
  const rawValue = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!rawValue) return null

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<StoredAuthState>
    if (parsedValue.token && parsedValue.currentUser?.name) {
      return {
        token: parsedValue.token,
        currentUser: {
          ...defaultCurrentUser,
          ...parsedValue.currentUser,
        },
      }
    }
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }

  return null
}

export const useAppStore = defineStore('app', () => {
  const storedAuthState = readStoredAuthState()
  const token = ref<string>(storedAuthState?.token ?? '')
  const systemName = ref('Data Aurora Admin')
  const notificationsEnabled = ref(true)
  const currentUser = ref<AuthUser>(storedAuthState?.currentUser ?? defaultCurrentUser)
  const visitedViews = ref<VisitedView[]>([...defaultVisitedViews])

  const isAuthenticated = computed(() => Boolean(token.value))
  const isAdmin = computed(() => {
    const role = currentUser.value.role.trim()
    return role === '超级管理员' || role === '平台管理员' || role.includes('管理员')
  })

  const applySettings = (settings: AppSettings) => {
    systemName.value = settings.systemName
    notificationsEnabled.value = settings.notificationsEnabled
  }

  const fetchSettings = async () => {
    const settings = await getSettings()
    applySettings(settings)
    return settings
  }

  const persistAuthState = () => {
    if (!token.value) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      return
    }

    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: token.value,
        currentUser: currentUser.value,
      } satisfies StoredAuthState)
    )
  }

  const login = (accessToken: string, user: AuthUser) => {
    token.value = accessToken
    currentUser.value = user
    persistAuthState()
  }

  const logout = () => {
    token.value = ''
    currentUser.value = { ...defaultCurrentUser }
    persistAuthState()
    visitedViews.value = [...defaultVisitedViews]
  }

  const addVisitedView = (view: VisitedView) => {
    const existing = visitedViews.value.find((item) => item.path === view.path)
    if (existing) {
      existing.title = view.title
      existing.closable = view.closable
      return
    }
    visitedViews.value.push(view)
  }

  const removeVisitedView = (path: string) => {
    visitedViews.value = visitedViews.value.filter((item) => item.path !== path || !item.closable)
  }

  return {
    addVisitedView,
    applySettings,
    currentUser,
    fetchSettings,
    isAdmin,
    isAuthenticated,
    login,
    logout,
    notificationsEnabled,
    removeVisitedView,
    systemName,
    visitedViews,
  }
})
