<template>
  <section class="geo-v3-shell">
    <PageHeader
      description="独立维护 V3 版本规则、变量池、主推产品和生成快照，旧 GEO 与 V2 链路保持原样。"
      eyebrow="GEO V3"
      title="Prompt Engine V3"
    >
      <template #actions>
        <el-button type="primary" @click="router.push('/geo-v3/generate')">生成 Prompt</el-button>
      </template>
    </PageHeader>

    <nav class="geo-v3-subnav">
      <RouterLink
        v-for="item in tabs"
        :key="item.path"
        :class="['geo-v3-subnav__item', { active: route.path === item.path }]"
        :to="item.path"
      >
        <strong>{{ item.label }}</strong>
        <span>{{ item.description }}</span>
      </RouterLink>
    </nav>

    <router-view />
  </section>
</template>

<script lang="ts" setup>
import { useRoute, useRouter, RouterLink } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'

const route = useRoute()
const router = useRouter()

const tabs = [
  {
    label: 'Prompt 生成',
    path: '/geo-v3/generate',
    description: '带固定规则',
  },
  {
    label: '纯版本生成',
    path: '/geo-v3/generate-lite',
    description: '不叠加固定规则',
  },
  {
    label: '版本管理',
    path: '/geo-v3/versions',
    description: '规则与变量池',
  },
  {
    label: '主推产品',
    path: '/geo-v3/products',
    description: '必写与随机素材',
  },
  {
    label: '生成记录',
    path: '/geo-v3/runs',
    description: '快照与 ZIP',
  },
  {
    label: '迭代记录',
    path: '/geo-v3/changelog',
    description: 'V3 交付时间线',
  },
]
</script>

<style scoped>
.geo-v3-shell {
  display: grid;
  gap: 14px;
}

.geo-v3-subnav {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}

.geo-v3-subnav__item {
  display: grid;
  gap: 4px;
  min-height: 62px;
  padding: 12px 14px;
  border: 1px solid rgba(217, 107, 114, 0.16);
  border-radius: 8px;
  color: #6b555b;
  background: rgba(255, 252, 251, 0.82);
  box-shadow: 0 10px 22px rgba(163, 91, 96, 0.06);
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.geo-v3-subnav__item:hover,
.geo-v3-subnav__item.active {
  color: var(--brand-primary-strong);
  border-color: rgba(217, 107, 114, 0.32);
  background: linear-gradient(180deg, #fffafa, #fff1f1);
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(176, 102, 108, 0.1);
}

.geo-v3-subnav__item strong {
  font-size: 13px;
  font-weight: 750;
}

.geo-v3-subnav__item span {
  font-size: 12px;
  line-height: 1.45;
  color: #8a7378;
}

@media (max-width: 1200px) {
  .geo-v3-subnav {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
