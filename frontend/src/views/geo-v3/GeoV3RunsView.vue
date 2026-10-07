<template>
  <section class="geo-v3-page">
    <article class="surface-card section-card geo-v3-toolbar reveal-up">
      <div>
        <h3>生成记录</h3>
        <p>每次 V3 生成都会保留版本、变量抽取、产品抽取和最终 Prompt 快照。</p>
      </div>
      <el-button :loading="loading" type="primary" plain @click="loadRuns">刷新</el-button>
    </article>

    <section class="geo-v3-workbench">
      <article v-loading="loading" class="surface-card section-card geo-v3-list reveal-up" style="--delay: 0.08s">
        <div v-if="runs.length === 0 && !loading" class="geo-v3-empty">
          <strong>暂无生成记录</strong>
          <span>在 Prompt 生成页生成后会出现在这里。</span>
        </div>

        <button
          v-for="item in runs"
          :key="item.id"
          :class="['geo-v3-list-item', { active: selectedRun?.id === item.id }]"
          type="button"
          @click="selectRun(item.id)"
        >
          <div class="geo-v3-list-item__top">
            <strong>#{{ item.id }} · {{ item.mode === 'BATCH' ? '批量' : '单条' }}</strong>
            <div class="geo-v3-run-tags">
              <el-tag :type="getFixedRulesModeType(item.fixedRulesMode)" effect="light" round size="small">
                {{ getFixedRulesModeLabel(item.fixedRulesMode) }}
              </el-tag>
              <el-tag :type="getRunStatusType(item.status)" effect="light" round size="small">
                {{ getRunStatusLabel(item.status) }}
              </el-tag>
            </div>
          </div>
          <p>{{ item.versionName }} · {{ item.productProfileName }}</p>
          <span>{{ item.successCount }}/{{ item.requestedCount }} 成功 · {{ formatDate(item.createdAt) }}</span>
        </button>
      </article>

      <article class="surface-card section-card reveal-up" style="--delay: 0.12s">
        <template v-if="selectedRun">
          <div class="geo-v3-form-head">
            <div>
              <h3>记录 #{{ selectedRun.id }}</h3>
              <p>{{ selectedRun.versionName }} · {{ selectedRun.variableSetName }} · {{ selectedRun.productProfileName }}</p>
            </div>
            <div class="geo-v3-actions">
              <el-tag :type="getRunStatusType(selectedRun.status)" effect="light" round>
                {{ getRunStatusLabel(selectedRun.status) }}
              </el-tag>
              <el-tag :type="getFixedRulesModeType(selectedRun.fixedRulesMode)" effect="light" round>
                {{ getFixedRulesModeLabel(selectedRun.fixedRulesMode) }}
              </el-tag>
              <el-button :disabled="!selectedRun.canDownload" type="primary" @click="downloadSelectedRun">
                下载 ZIP
              </el-button>
            </div>
          </div>

          <div class="geo-v3-result-metrics">
            <div>
              <strong>{{ selectedRun.requestedCount }}</strong>
              <span>请求数量</span>
            </div>
            <div>
              <strong>{{ selectedRun.successCount }}</strong>
              <span>成功</span>
            </div>
            <div>
              <strong>{{ selectedRun.failedCount }}</strong>
              <span>失败</span>
            </div>
            <div>
              <strong>{{ selectedRun.itemCount }}</strong>
              <span>明细数量</span>
            </div>
          </div>

          <el-table v-loading="detailLoading" :data="selectedRun.items || []" empty-text="暂无明细">
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="geo-v3-expand">
                  <h4>Prompt 内容</h4>
                  <pre>{{ row.promptText || getItemPlaceholderText(row) }}</pre>
                  <div class="geo-v3-snapshot-grid">
                    <section>
                      <h4>抽中的差异化内容</h4>
                      <ul>
                        <li v-for="value in flattenSelectedVariables(row)" :key="value">{{ value }}</li>
                      </ul>
                    </section>
                    <section>
                      <h4>产品内容快照</h4>
                      <h5>必须写</h5>
                      <ul>
                        <li v-for="value in row.selectedProductContent.requiredContent" :key="value">{{ value }}</li>
                      </ul>
                      <h5>主打卖点</h5>
                      <ul>
                        <li v-for="value in row.selectedProductContent.sellingPoints || []" :key="value">{{ value }}</li>
                      </ul>
                      <h5>强调点</h5>
                      <ul>
                        <li v-for="value in row.selectedProductContent.emphasis || []" :key="value">{{ value }}</li>
                      </ul>
                      <h5>品牌池</h5>
                      <ul>
                        <li v-for="value in row.selectedProductContent.brandPool || []" :key="value">{{ value }}</li>
                      </ul>
                      <h5>补充内容</h5>
                      <ul>
                        <li v-for="value in row.selectedProductContent.randomContent" :key="value">{{ value }}</li>
                      </ul>
                    </section>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="篇次" prop="itemIndex" width="90" />
            <el-table-column label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="getItemStatusType(row.status)" effect="light" round>
                  {{ getItemStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="文件名" prop="fileName" min-width="240" />
            <el-table-column label="创建时间" width="180">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
        </template>

        <div v-else class="geo-v3-empty">
          <strong>选择一条生成记录</strong>
          <span>右侧会展示生成明细、随机快照和 Prompt 内容。</span>
        </div>
      </article>
    </section>
  </section>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { downloadGeoV3Run, getGeoV3Run, getGeoV3Runs } from '@/api/geo'
import type {
  GeoV3GenerationItem,
  GeoV3GenerationRun,
  GeoV3FixedRulesMode,
  GeoV3ItemStatus,
  GeoV3RunStatus,
} from '@/types/geo'

const runs = ref<GeoV3GenerationRun[]>([])
const selectedRun = ref<GeoV3GenerationRun | null>(null)
const loading = ref(false)
const detailLoading = ref(false)
let refreshTimer: number | undefined

const loadRuns = async () => {
  loading.value = true
  try {
    runs.value = await getGeoV3Runs()
    if (!selectedRun.value && runs.value.length > 0) {
      await selectRun(runs.value[0].id)
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '生成记录加载失败')
  } finally {
    loading.value = false
  }
}

const selectRun = async (id: number) => {
  detailLoading.value = true
  try {
    selectedRun.value = await getGeoV3Run(id)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '记录详情加载失败')
  } finally {
    detailLoading.value = false
  }
}

const refreshRunningRuns = async () => {
  if (!runs.value.some((item) => item.status === 'RUNNING') && selectedRun.value?.status !== 'RUNNING') return

  const selectedId = selectedRun.value?.id
  await loadRuns()
  if (selectedId) await selectRun(selectedId)
}

const downloadSelectedRun = async () => {
  if (!selectedRun.value) return
  try {
    const { blob, fileName } = await downloadGeoV3Run(selectedRun.value.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '下载失败')
  }
}

const flattenSelectedVariables = (item: GeoV3GenerationItem) => {
  return item.selectedVariables.flatMap((variable) => variable.values)
}

const getRunStatusLabel = (status: GeoV3RunStatus) => {
  const labels: Record<GeoV3RunStatus, string> = {
    RUNNING: '生成中',
    COMPLETED: '已完成',
    PARTIAL_FAILED: '部分失败',
    FAILED: '失败',
  }
  return labels[status]
}

const getRunStatusType = (status: GeoV3RunStatus) => {
  if (status === 'COMPLETED') return 'success'
  if (status === 'RUNNING') return 'warning'
  if (status === 'PARTIAL_FAILED') return 'warning'
  return 'danger'
}

const getFixedRulesModeLabel = (mode?: GeoV3FixedRulesMode) => {
  return mode === 'NONE' ? '纯版本' : '标准'
}

const getFixedRulesModeType = (mode?: GeoV3FixedRulesMode) => {
  return mode === 'NONE' ? 'warning' : 'success'
}

const getItemStatusLabel = (status: GeoV3ItemStatus) => {
  const labels: Record<GeoV3ItemStatus, string> = {
    QUEUED: '等待中',
    RUNNING: '生成中',
    SUCCEEDED: '成功',
    FAILED: '失败',
  }
  return labels[status]
}

const getItemStatusType = (status: GeoV3ItemStatus) => {
  if (status === 'SUCCEEDED') return 'success'
  if (status === 'FAILED') return 'danger'
  return 'warning'
}

const getItemPlaceholderText = (item: GeoV3GenerationItem) => {
  if (item.status === 'FAILED') return item.errorMessage || '本条 Prompt 生成失败'
  if (item.status === 'RUNNING') return '正在生成本条 Prompt...'
  return '等待生成本条 Prompt...'
}

const formatDate = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false })

onMounted(() => {
  void loadRuns()
  refreshTimer = window.setInterval(() => {
    void refreshRunningRuns()
  }, 5000)
})

onBeforeUnmount(() => {
  if (refreshTimer) window.clearInterval(refreshTimer)
})
</script>

<style scoped>
.geo-v3-page {
  display: grid;
  gap: 14px;
}

.geo-v3-toolbar,
.geo-v3-form-head,
.geo-v3-list-item__top,
.geo-v3-actions {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.geo-v3-toolbar h3,
.geo-v3-form-head h3 {
  margin: 0 0 6px;
  font-size: 16px;
  color: var(--brand-ink);
}

.geo-v3-toolbar p,
.geo-v3-form-head p,
.geo-v3-list-item p,
.geo-v3-empty span {
  margin: 0;
  font-size: 12px;
  line-height: 1.65;
  color: var(--brand-muted);
}

.geo-v3-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.geo-v3-run-tags {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.geo-v3-workbench {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.geo-v3-list {
  display: grid;
  gap: 10px;
}

.geo-v3-list-item {
  width: 100%;
  padding: 13px;
  text-align: left;
  border: 1px solid rgba(217, 107, 114, 0.14);
  border-radius: 8px;
  color: inherit;
  background: rgba(255, 252, 251, 0.72);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    transform 0.2s ease;
}

.geo-v3-list-item:hover,
.geo-v3-list-item.active {
  border-color: rgba(217, 107, 114, 0.34);
  background: #fff3f2;
  transform: translateY(-1px);
}

.geo-v3-list-item strong {
  color: #4d393e;
  font-size: 13px;
}

.geo-v3-list-item span {
  display: block;
  margin-top: 8px;
  font-size: 11px;
  color: #9a8186;
}

.geo-v3-empty {
  display: grid;
  gap: 6px;
  padding: 24px;
  text-align: center;
  border: 1px dashed rgba(217, 107, 114, 0.2);
  border-radius: 8px;
  background: #fff8f7;
}

.geo-v3-result-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 14px 0;
}

.geo-v3-result-metrics > div {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid rgba(217, 107, 114, 0.12);
  border-radius: 8px;
  background: #fff8f7;
}

.geo-v3-result-metrics strong {
  font-size: 21px;
  color: var(--brand-primary-strong);
}

.geo-v3-result-metrics span {
  font-size: 12px;
  color: var(--brand-muted);
}

.geo-v3-expand {
  display: grid;
  gap: 12px;
  padding: 8px 14px 14px;
}

.geo-v3-expand h4,
.geo-v3-expand h5 {
  margin: 0;
  font-size: 13px;
  color: var(--brand-ink);
}

.geo-v3-expand h5 {
  margin-top: 10px;
  font-size: 12px;
}

.geo-v3-expand pre {
  max-height: 480px;
  margin: 0;
  padding: 14px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  border: 1px solid rgba(217, 107, 114, 0.16);
  border-radius: 8px;
  background: #fffaf9;
  color: #4d393e;
  font-size: 12px;
  line-height: 1.75;
}

.geo-v3-snapshot-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.geo-v3-snapshot-grid section {
  padding: 12px;
  border: 1px solid rgba(217, 107, 114, 0.12);
  border-radius: 8px;
  background: #fff8f7;
}

.geo-v3-snapshot-grid ul {
  margin: 8px 0 0;
  padding-left: 18px;
  color: var(--brand-muted);
  font-size: 12px;
  line-height: 1.7;
}
</style>
