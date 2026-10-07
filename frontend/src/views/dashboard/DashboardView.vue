<template>
  <PageHeader
    class="dashboard-page-header"
    description="这里作为整个系统的仪表盘首页，强调总览框架、趋势判断和执行状态，让首页一眼就能看出平台整体运行情况。"
    eyebrow="Overview"
    title="演示"
  >
    <template #actions>
      <el-button plain>导出周报</el-button>
      <el-button type="primary">创建工作项</el-button>
    </template>
  </PageHeader>

  <section class="dashboard-grid dashboard-grid--primary">
    <article class="surface-card section-card reveal-up" style="--delay: 0.08s">
      <div class="dashboard-section-head">
        <div>
          <h3>一周活跃趋势</h3>
          <p>用折线图展示平台活跃用户、登录次数与任务完成率走势。</p>
        </div>
        <el-tag effect="dark" round type="primary">7 日窗口</el-tag>
      </div>
      <EChartPanel :option="trendOption" height="360px" />
    </article>

    <article class="surface-card section-card reveal-up dashboard-side-panel" style="--delay: 0.16s">
      <div class="dashboard-section-head">
        <div>
          <h3>平台摘要</h3>
          <p>首屏同时保留执行概况和平台状态，避免把图表压到下方。</p>
        </div>
      </div>

      <div class="dashboard-metric-stack">
        <div class="dashboard-metric-card">
          <span>今日待办</span>
          <strong>17</strong>
          <small>已较昨天减少 6 项</small>
        </div>
        <div class="dashboard-metric-card">
          <span>审批通过率</span>
          <strong>94%</strong>
          <small>流程响应速度保持稳定</small>
        </div>
      </div>

      <div class="dashboard-signals dashboard-signals--compact">
        <div v-for="signal in dashboardSignals" :key="signal.label" class="dashboard-signal-card">
          <span>{{ signal.label }}</span>
          <strong>{{ signal.value }}</strong>
        </div>
      </div>

      <div class="dashboard-shortcuts">
        <el-button v-for="shortcut in dashboardShortcuts" :key="shortcut" plain round>
          {{ shortcut }}
        </el-button>
      </div>
    </article>
  </section>

  <section class="stats-grid stats-grid--compact">
    <article
      v-for="(item, index) in dashboardStats"
      :key="item.label"
      class="surface-card stat-card reveal-up"
      :style="{ '--delay': `${0.18 + index * 0.04}s` }"
    >
      <div class="stat-accent">{{ item.accent }}</div>
      <div class="stat-label">{{ item.label }}</div>
      <div class="stat-value">{{ item.value }}</div>
      <div class="stat-footnote">{{ item.footnote }}</div>
    </article>
  </section>

  <section class="dashboard-hero surface-card reveal-up" style="--delay: 0.28s">
    <div class="dashboard-hero__content">
      <span class="dashboard-hero__eyebrow">Operations Snapshot</span>
      <h2>平台运行保持稳定，当前更值得关注的是账号活跃度与执行效率。</h2>
      <p>
        这里作为压缩后的结论区，保留首页层次感，但不再占据首屏主要位置，让图表更早进入视野。
      </p>
      <div class="dashboard-hero__chips">
        <span class="dashboard-chip dashboard-chip--solid">平台运行正常</span>
        <span class="dashboard-chip">告警等级: 低</span>
        <span class="dashboard-chip">本日更新 12 次</span>
      </div>
    </div>

    <div class="dashboard-highlight-list">
      <div class="dashboard-highlight-item">
        <span>登录峰值</span>
        <strong>周六 146 次</strong>
      </div>
      <div class="dashboard-highlight-item">
        <span>任务响应最快团队</span>
        <strong>系统运维组</strong>
      </div>
      <div class="dashboard-highlight-item">
        <span>需关注事项</span>
        <strong>管理员权限复核</strong>
      </div>
    </div>
  </section>

  <section class="dashboard-grid dashboard-grid--secondary">
    <article class="surface-card section-card reveal-up" style="--delay: 0.34s">
      <div class="dashboard-section-head">
        <div>
          <h3>功能重心</h3>
          <p>观察当前系统中各功能区域的关注占比与使用重心。</p>
        </div>
      </div>
      <EChartPanel :option="distributionOption" height="320px" />
    </article>

    <article class="surface-card section-card reveal-up" style="--delay: 0.42s">
      <div class="dashboard-section-head">
        <div>
          <h3>团队协作效率</h3>
          <p>用横向柱状图直观看当前各团队的执行表现。</p>
        </div>
      </div>
      <EChartPanel :option="efficiencyOption" height="320px" />
    </article>
  </section>

  <section class="dashboard-grid dashboard-grid--bottom">
    <article class="surface-card section-card reveal-up" style="--delay: 0.48s">
      <div class="dashboard-section-head">
        <div>
          <h3>近期动态</h3>
          <p>保留后台首页常见的时间线，用来承接系统关键动作。</p>
        </div>
      </div>
      <el-timeline>
        <el-timeline-item
          v-for="activity in dashboardActivity"
          :key="`${activity.time}-${activity.title}`"
          :timestamp="activity.time"
          type="primary"
        >
          <strong>{{ activity.title }}</strong>
          <div class="dashboard-timeline-copy">{{ activity.detail }}</div>
        </el-timeline-item>
      </el-timeline>
    </article>

    <article class="surface-card section-card reveal-up" style="--delay: 0.56s">
      <div class="dashboard-section-head">
        <div>
          <h3>重点项目推进</h3>
          <p>用表格和进度条补齐“管理端首页”的层次感。</p>
        </div>
      </div>
      <el-table :data="dashboardProjects" style="width: 100%">
        <el-table-column label="项目名称" prop="name" min-width="180" />
        <el-table-column label="负责人" prop="owner" width="120" />
        <el-table-column label="进度" min-width="180">
          <template #default="{ row }">
            <el-progress :percentage="row.progress" :stroke-width="10" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <span :class="['table-tag', row.progress >= 90 ? 'tag-success' : row.progress >= 60 ? 'tag-info' : 'tag-warning']">
              {{ row.status }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </article>
  </section>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import EChartPanel from '@/components/EChartPanel.vue'
import PageHeader from '@/components/PageHeader.vue'
import {
  dashboardActivity,
  dashboardEfficiency,
  dashboardProjects,
  dashboardShortcuts,
  dashboardSignals,
  dashboardSourceDistribution,
  dashboardStats,
  dashboardTrend,
} from '@/mock/dashboard'

const trendOption = computed<EChartsOption>(() => ({
  tooltip: {
    trigger: 'axis',
  },
  legend: {
    top: 0,
    right: 0,
    itemWidth: 10,
    textStyle: {
      color: '#7c696f',
    },
  },
  grid: {
    top: 56,
    left: 18,
    right: 18,
    bottom: 18,
    containLabel: true,
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: dashboardTrend.days,
    axisLine: {
      lineStyle: { color: 'rgba(226, 201, 196, 0.9)' },
    },
    axisLabel: {
      color: '#8b767b',
    },
  },
  yAxis: [
    {
      type: 'value',
      splitLine: {
        lineStyle: { color: 'rgba(231, 211, 207, 0.88)' },
      },
      axisLabel: {
        color: '#8b767b',
      },
    },
    {
      type: 'value',
      min: 60,
      max: 100,
      axisLabel: {
        formatter: '{value}%',
        color: '#8b767b',
      },
      splitLine: { show: false },
    },
  ],
  series: [
    {
      name: '活跃用户',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      data: dashboardTrend.users,
      lineStyle: { width: 3, color: '#da6f76' },
      itemStyle: { color: '#da6f76' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(218, 111, 118, 0.26)' },
            { offset: 1, color: 'rgba(218, 111, 118, 0.02)' },
          ],
        },
      },
    },
    {
      name: '登录次数',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 7,
      data: dashboardTrend.logins,
      lineStyle: { width: 3, color: '#f09a88' },
      itemStyle: { color: '#f09a88' },
    },
    {
      name: '任务完成率',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 7,
      yAxisIndex: 1,
      data: dashboardTrend.tasks,
      lineStyle: { width: 3, color: '#c7878e' },
      itemStyle: { color: '#c7878e' },
    },
  ],
}))

const distributionOption = computed<EChartsOption>(() => ({
  tooltip: {
    trigger: 'item',
  },
  legend: {
    bottom: 0,
    icon: 'circle',
    textStyle: {
      color: '#7f6d72',
    },
  },
  color: ['#da6f76', '#f09a88', '#e38c95', '#f1b18a', '#d8b5ae'],
  series: [
    {
      name: '功能关注占比',
      type: 'pie',
      radius: ['48%', '72%'],
      center: ['50%', '44%'],
      avoidLabelOverlap: false,
      label: {
        show: true,
        formatter: '{b}\n{d}%',
        color: '#775f65',
      },
      labelLine: {
        length: 14,
        length2: 12,
      },
      data: dashboardSourceDistribution,
    },
  ],
}))

const efficiencyOption = computed<EChartsOption>(() => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'shadow',
    },
  },
  grid: {
    top: 10,
    left: 12,
    right: 16,
    bottom: 8,
    containLabel: true,
  },
  xAxis: {
    type: 'value',
    max: 100,
    splitLine: {
      lineStyle: { color: 'rgba(231, 211, 207, 0.88)' },
    },
    axisLabel: {
      formatter: '{value}%',
      color: '#8b767b',
    },
  },
  yAxis: {
    type: 'category',
    data: dashboardEfficiency.map((item) => item.team),
    axisTick: { show: false },
    axisLine: { show: false },
    axisLabel: {
      color: '#7b666b',
    },
  },
  series: [
    {
      type: 'bar',
      data: dashboardEfficiency.map((item) => item.score),
      barWidth: 16,
      showBackground: true,
      backgroundStyle: {
        color: 'rgba(243, 226, 223, 0.92)',
        borderRadius: 999,
      },
      itemStyle: {
        borderRadius: 999,
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 1,
          y2: 0,
          colorStops: [
            { offset: 0, color: '#da6f76' },
            { offset: 1, color: '#f1a38d' },
          ],
        },
      },
      label: {
        show: true,
        position: 'right',
        formatter: '{c}%',
        color: '#664f55',
      },
    },
  ],
}))
</script>

<style scoped>
.dashboard-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) 360px;
  gap: 18px;
  padding: 20px 22px;
  background:
    radial-gradient(circle at top right, rgba(235, 170, 161, 0.2), transparent 28%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(255, 245, 243, 0.94));
}

.dashboard-page-header:deep(.page-header) {
  padding: 20px 24px;
}

.dashboard-page-header:deep(.page-eyebrow) {
  margin-bottom: 8px;
  font-size: 11px;
}

.dashboard-page-header:deep(h1) {
  font-size: 26px;
}

.dashboard-page-header:deep(.page-description) {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.65;
}

.dashboard-hero__eyebrow {
  display: inline-flex;
  margin-bottom: 10px;
  color: #d96b72;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.dashboard-hero__content h2 {
  margin: 0;
  font-size: 24px;
  line-height: 1.28;
  color: #15203a;
}

.dashboard-hero__content p {
  max-width: 680px;
  margin: 10px 0 0;
  color: #7f6c71;
  font-size: 13px;
  line-height: 1.7;
}

.dashboard-hero__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

.dashboard-chip {
  display: inline-flex;
  align-items: center;
  padding: 8px 14px;
  border: 1px solid rgba(224, 189, 182, 0.32);
  border-radius: 999px;
  color: #7d666b;
  font-size: 13px;
  background: rgba(255, 251, 250, 0.88);
}

.dashboard-chip--solid {
  color: #ffffff;
  background: linear-gradient(135deg, #d96b72, #f0a18c);
  border-color: transparent;
}

.dashboard-signals {
  display: grid;
  gap: 14px;
}

.dashboard-signals--compact {
  gap: 10px;
  margin-bottom: 16px;
}

.dashboard-signal-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  min-height: 88px;
  padding: 14px 16px;
  border: 1px solid rgba(224, 191, 185, 0.22);
  border-radius: 22px;
  background: rgba(255, 252, 251, 0.88);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.dashboard-signal-card span {
  color: #8a7277;
  font-size: 12px;
}

.dashboard-signal-card strong {
  color: #12203a;
  font-size: 22px;
}

.stat-accent {
  display: inline-flex;
  margin-bottom: 14px;
  padding: 6px 10px;
  border-radius: 999px;
  color: #cf6670;
  font-size: 12px;
  font-weight: 700;
  background: rgba(217, 107, 114, 0.1);
}

.dashboard-grid {
  display: grid;
  gap: 18px;
}

.dashboard-grid--primary {
  grid-template-columns: minmax(0, 1.5fr) 360px;
}

.dashboard-grid--secondary,
.dashboard-grid--bottom {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.dashboard-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.dashboard-section-head h3 {
  margin: 0;
  font-size: 17px;
}

.dashboard-section-head p {
  margin: 8px 0 0;
  color: #816c72;
  font-size: 13px;
  line-height: 1.7;
}

.dashboard-side-panel {
  display: flex;
  flex-direction: column;
}

.dashboard-metric-stack {
  display: grid;
  gap: 14px;
  margin-bottom: 14px;
}

.dashboard-metric-card {
  padding: 14px 16px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(217, 107, 114, 0.1), rgba(242, 171, 149, 0.14));
}

.dashboard-metric-card span,
.dashboard-highlight-item span {
  color: #866f74;
  font-size: 13px;
}

.dashboard-metric-card strong,
.dashboard-highlight-item strong {
  display: block;
  margin-top: 8px;
  color: #15203a;
  font-size: 24px;
}

.dashboard-metric-card small {
  display: block;
  margin-top: 10px;
  color: #7c686d;
}

.dashboard-shortcuts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 0;
}

.dashboard-highlight-list {
  display: grid;
  gap: 12px;
}

.dashboard-highlight-item {
  padding: 14px 16px;
  border: 1px solid rgba(225, 191, 185, 0.22);
  border-radius: 18px;
  background: rgba(255, 251, 250, 0.9);
}

.dashboard-highlight-item strong {
  margin-top: 6px;
  font-size: 16px;
}

.stats-grid--compact .stat-card {
  padding: 16px 18px;
}

.stats-grid--compact .stat-accent {
  margin-bottom: 10px;
  padding: 4px 8px;
  font-size: 11px;
}

.stats-grid--compact .stat-value {
  margin-top: 8px;
  font-size: 24px;
}

.stats-grid--compact .stat-label,
.stats-grid--compact .stat-footnote {
  font-size: 12px;
}

.dashboard-timeline-copy {
  margin-top: 6px;
  color: #7a676c;
}

@media (max-width: 1280px) {
  .dashboard-hero,
  .dashboard-grid--primary,
  .dashboard-grid--secondary,
  .dashboard-grid--bottom {
    grid-template-columns: 1fr;
  }
}
</style>
