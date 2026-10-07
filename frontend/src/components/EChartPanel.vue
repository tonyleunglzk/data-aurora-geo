<template>
  <div ref="chartRef" :style="{ height, width: '100%' }" />
</template>

<script lang="ts" setup>
import type { ECharts, EChartsOption } from 'echarts'
import * as echarts from 'echarts'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    option: EChartsOption
    height?: string
  }>(),
  {
    height: '320px',
  }
)

const chartRef = ref<HTMLDivElement>()
let chart: ECharts | undefined
let resizeObserver: ResizeObserver | undefined

const renderChart = async () => {
  await nextTick()
  if (!chartRef.value) return

  if (!chart) {
    chart = echarts.init(chartRef.value)
  }

  chart.setOption(props.option, true)
  chart.resize()
}

onMounted(() => {
  renderChart()
  window.addEventListener('resize', renderChart)

  if (chartRef.value) {
    resizeObserver = new ResizeObserver(() => renderChart())
    resizeObserver.observe(chartRef.value)
  }
})

watch(
  () => props.option,
  () => {
    renderChart()
  },
  { deep: true }
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', renderChart)
  resizeObserver?.disconnect()
  chart?.dispose()
})
</script>
