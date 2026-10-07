import { createRouter, createWebHistory } from 'vue-router'
import { useAppStore } from '@/stores/app'
import LoginView from '@/views/login/LoginView.vue'
import DashboardView from '@/views/dashboard/DashboardView.vue'
import ChangelogView from '@/views/changelog/ChangelogView.vue'
import UsersView from '@/views/users/UsersView.vue'
import GeoLayoutView from '@/views/geo/GeoLayoutView.vue'
import GeoPromptEngineLegacyView from '@/views/geo/GeoPromptEngineView.vue'
import GeoPromptEngineV2View from '@/views/geo/GeoPromptEngineV2View.vue'
import GeoProviderConfigView from '@/views/geo/GeoProviderConfigView.vue'
import GeoSerpResearchView from '@/views/geo/GeoSerpResearchView.vue'
import GeoRuleCardsView from '@/views/geo/GeoRuleCardsView.vue'
import GeoAiSummaryLabView from '@/views/geo/GeoAiSummaryLabView.vue'
import GeoPromptBatchHistoryView from '@/views/geo/GeoPromptBatchHistoryView.vue'
import GeoPromptVersionsView from '@/views/geo/GeoPromptVersionsView.vue'
import GeoPublicationsView from '@/views/geo/GeoPublicationsView.vue'
import GeoV3LayoutView from '@/views/geo-v3/GeoV3LayoutView.vue'
import GeoV3GenerateView from '@/views/geo-v3/GeoV3GenerateView.vue'
import GeoV3VersionsView from '@/views/geo-v3/GeoV3VersionsView.vue'
import GeoV3ProductsView from '@/views/geo-v3/GeoV3ProductsView.vue'
import GeoV3RunsView from '@/views/geo-v3/GeoV3RunsView.vue'
import GeoV3ChangelogView from '@/views/geo-v3/GeoV3ChangelogView.vue'
import VideoGenerationView from '@/views/video-generation/VideoGenerationView.vue'
import VideoMaterialsView from '@/views/video-materials/VideoMaterialsView.vue'
import SettingsView from '@/views/settings/SettingsView.vue'
import NotFoundView from '@/views/error/NotFoundView.vue'
import AppLayout from '@/layouts/AppLayout.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { public: true, title: '登录' },
    },
    {
      path: '/',
      component: AppLayout,
      children: [
        {
          path: '',
          redirect: '/dashboard',
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: DashboardView,
          meta: { title: '演示' },
        },
        {
          path: 'changelog',
          name: 'changelog',
          component: ChangelogView,
          meta: { title: '迭代记录' },
        },
        {
          path: 'users',
          name: 'users',
          component: UsersView,
          meta: { title: '用户中心' },
        },
        {
          path: 'geo',
          component: GeoLayoutView,
          children: [
            {
              path: '',
              redirect: '/geo/prompt-engine',
            },
            {
              path: 'prompt-engine',
              name: 'geo-prompt-engine-v2',
              component: GeoPromptEngineV2View,
              meta: { title: 'Prompt Engine（新版）' },
            },
            {
              path: 'prompt-engine-legacy',
              name: 'geo-prompt-engine-legacy',
              component: GeoPromptEngineLegacyView,
              meta: { title: 'Prompt Engine（旧版）' },
            },
            {
              path: 'prompt-versions',
              name: 'geo-prompt-versions',
              component: GeoPromptVersionsView,
              meta: { title: '版本管理' },
            },
            {
              path: 'prompt-batches',
              name: 'geo-prompt-batches',
              component: GeoPromptBatchHistoryView,
              meta: { title: '批量历史' },
            },
            {
              path: 'publications',
              name: 'geo-publications',
              component: GeoPublicationsView,
              meta: { title: '发文反馈' },
            },
            {
              path: 'provider-config',
              redirect: '/geo/anthropic-config',
            },
            {
              path: 'serp-research',
              name: 'geo-serp-research',
              component: GeoSerpResearchView,
              meta: { title: 'SERP 研究' },
            },
            {
              path: 'rule-cards',
              name: 'geo-rule-cards',
              component: GeoRuleCardsView,
              meta: { title: '规则库' },
            },
            {
              path: 'ai-summary-lab',
              name: 'geo-ai-summary-lab',
              component: GeoAiSummaryLabView,
              meta: { title: 'AI 总结测试' },
            },
            {
              path: 'anthropic-config',
              name: 'geo-anthropic-config',
              component: GeoProviderConfigView,
              meta: { title: 'Anthropic 配置' },
            },
          ],
        },
        {
          path: 'geo-v3',
          component: GeoV3LayoutView,
          children: [
            {
              path: '',
              redirect: '/geo-v3/generate',
            },
            {
              path: 'generate',
              name: 'geo-v3-generate',
              component: GeoV3GenerateView,
              meta: { title: 'GEO V3 · Prompt 生成' },
            },
            {
              path: 'generate-lite',
              name: 'geo-v3-generate-lite',
              component: GeoV3GenerateView,
              meta: { title: 'GEO V3 · 纯版本生成' },
            },
            {
              path: 'versions',
              name: 'geo-v3-versions',
              component: GeoV3VersionsView,
              meta: { title: 'GEO V3 · 版本管理' },
            },
            {
              path: 'variables',
              redirect: '/geo-v3/versions',
            },
            {
              path: 'products',
              name: 'geo-v3-products',
              component: GeoV3ProductsView,
              meta: { title: 'GEO V3 · 主推产品' },
            },
            {
              path: 'runs',
              name: 'geo-v3-runs',
              component: GeoV3RunsView,
              meta: { title: 'GEO V3 · 生成记录' },
            },
            {
              path: 'changelog',
              name: 'geo-v3-changelog',
              component: GeoV3ChangelogView,
              meta: { title: 'GEO V3 · 迭代记录' },
            },
          ],
        },
        {
          path: 'video-materials',
          name: 'video-materials',
          component: VideoMaterialsView,
          meta: { title: '视频素材库' },
        },
        {
          path: 'video-generation',
          name: 'video-generation',
          component: VideoGenerationView,
          meta: { title: '视频生成' },
        },
        {
          path: 'settings',
          name: 'settings',
          component: SettingsView,
          meta: { title: '系统设置' },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: '404',
      component: NotFoundView,
      meta: { public: true, title: '页面不存在' },
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach((to) => {
  const appStore = useAppStore()
  document.title = `${to.meta.title ?? 'Data Aurora'} | Data Aurora Admin`

  if (to.meta.public) {
    if (to.path === '/login' && appStore.isAuthenticated) {
      return '/dashboard'
    }
    return true
  }

  if (!appStore.isAuthenticated) {
    return `/login?redirect=${encodeURIComponent(to.fullPath)}`
  }

  return true
})

router.afterEach((to) => {
  if (to.meta.public || to.name === '404') return

  const appStore = useAppStore()
  appStore.addVisitedView({
    path: to.path,
    title: String(to.meta.title ?? '未命名页面'),
    closable: to.path !== '/dashboard',
  })
})

export default router
