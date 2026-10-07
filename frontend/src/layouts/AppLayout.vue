<template>
  <div class="app-shell">
    <header class="topbar reveal-down" style="--delay: 0.02s">
      <div class="brand-block" @click="router.push('/dashboard')">
        <div class="brand-mark">
          <span class="brand-mark__text">DA</span>
        </div>
        <div>
          <div class="brand-name">{{ appStore.systemName }}</div>
        </div>
      </div>

      <nav class="topnav">
        <template v-for="item in navigationItems" :key="item.key">
          <el-dropdown
            v-if="item.children?.length"
            placement="bottom"
            popper-class="topnav-dropdown"
            trigger="hover"
            @command="handleNavigationCommand"
          >
            <button :class="['topnav-item', 'topnav-item--dropdown', { active: isNavigationActive(item) }]" @click="router.push(item.children[0]?.path ?? item.path)">
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.label }}</span>
              <el-icon class="topnav-item__arrow"><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="child in item.children"
                  :key="child.key"
                  :class="{ 'is-active': route.path === child.path }"
                  :command="child.path"
                >
                  <div class="topnav-dropdown__item">
                    <strong>{{ child.label }}</strong>
                    <span>{{ child.description }}</span>
                  </div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <button
            v-else
            :class="['topnav-item', { active: isNavigationActive(item) }]"
            @click="router.push(item.path)"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </button>
        </template>
      </nav>

      <div class="topbar-actions">
        <div class="toolbar-chip">布局: 顶部导航</div>
        <el-badge :hidden="!appStore.notificationsEnabled" is-dot>
          <el-button circle text>
            <el-icon><Bell /></el-icon>
          </el-button>
        </el-badge>
        <el-dropdown>
          <div class="user-chip">
            <div class="user-avatar">{{ appStore.currentUser.avatar }}</div>
            <div class="user-meta">
              <strong>{{ appStore.currentUser.name }}</strong>
              <span>{{ appStore.currentUser.role }}</span>
            </div>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="router.push('/settings')">系统设置</el-dropdown-item>
              <el-dropdown-item divided @click="handleLogout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <section class="tabs-shell reveal-down" style="--delay: 0.05s">
      <div class="tabs-shell__inner">
        <el-tabs
          :model-value="route.path"
          class="route-tabs"
          type="card"
          @tab-click="handleTabClick"
          @tab-remove="handleTabRemove"
        >
          <el-tab-pane
            v-for="item in appStore.visitedViews"
            :key="item.path"
            :closable="item.closable"
            :label="item.title"
            :name="item.path"
          />
        </el-tabs>
      </div>
    </section>

    <main class="page-shell">
      <section class="page-meta">
        <div class="breadcrumb-row">
          <span>Data Aurora</span>
          <span>/</span>
          <span>{{ currentSection?.label ?? '控制台' }}</span>
        </div>
        <div class="section-tip">{{ currentSection?.description }}</div>
      </section>

      <section class="page-view">
        <router-view v-slot="{ Component, route: currentRoute }">
          <transition mode="out-in" name="page-swap">
            <div :key="currentRoute.path" class="page-transition-shell">
              <component :is="Component" />
            </div>
          </transition>
        </router-view>
      </section>
    </main>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { ArrowDown, Bell } from '@element-plus/icons-vue'
import type { TabPaneName, TabsPaneContext } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { navigationItems } from '@/config/navigation'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const route = useRoute()
const router = useRouter()

const currentSection = computed(() => {
  return navigationItems.find((item) => isNavigationActive(item))
})

const handleLogout = () => {
  appStore.logout()
  router.push('/login')
}

const isNavigationActive = (item: (typeof navigationItems)[number]) => {
  const paths = [item.path, ...(item.children?.map((child) => child.path) ?? [])]
  return paths.some((path) => route.path === path || route.path.startsWith(`${path}/`))
}

const handleNavigationCommand = (path: string | number | object) => {
  const target = String(path)
  if (target && target !== route.path) {
    router.push(target)
  }
}

const handleTabClick = (pane: TabsPaneContext) => {
  const target = typeof pane.paneName === 'string' ? pane.paneName : String(pane.paneName ?? '')
  if (target && target !== route.path) {
    router.push(target)
  }
}

const handleTabRemove = (targetName: TabPaneName) => {
  const path = String(targetName)
  const currentIndex = appStore.visitedViews.findIndex((item) => item.path === path)
  const isActive = route.path === path

  appStore.removeVisitedView(path)

  if (!isActive) return

  const nextView =
    appStore.visitedViews[currentIndex] ??
    appStore.visitedViews[currentIndex - 1] ??
    appStore.visitedViews[0]

  router.push(nextView?.path ?? '/dashboard')
}
</script>
