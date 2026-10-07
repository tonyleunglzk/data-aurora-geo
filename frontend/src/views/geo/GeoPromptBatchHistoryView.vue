<template>
  <section class="batch-history">
    <article class="surface-card section-card reveal-up">
      <div class="batch-history__head">
        <div>
          <h3>批量历史</h3>
          <p>旧版和新版 Prompt Engine 的后台批量任务都会记录在这里，生成完成后可随时下载 ZIP。</p>
        </div>
        <el-button :loading="loading" type="primary" plain @click="loadJobs()">刷新</el-button>
      </div>
    </article>

    <div class="batch-history__grid">
      <article class="surface-card section-card batch-history__list reveal-up" style="--delay: 0.08s">
        <div v-if="jobs.length === 0 && !loading" class="batch-empty">
          <div class="batch-empty__title">暂无批量任务</div>
          <p>在旧版或新版 Prompt Engine 中选择“批量生成”后，任务会出现在这里。</p>
        </div>

        <button
          v-for="job in jobs"
          :key="job.id"
          :class="['batch-job-card', { active: selectedJob?.id === job.id }]"
          @click="selectJob(job.id)"
        >
          <div class="batch-job-card__top">
            <span>#{{ job.id }} · {{ getEngineLabel(job.engineType) }}</span>
            <el-tag :type="getBatchStatusType(job.status)" effect="light" round>
              {{ getBatchStatusLabel(job.status) }}
            </el-tag>
          </div>
          <h4>{{ job.profileName }}</h4>
          <p v-if="job.versionName">版本：{{ job.versionName }}</p>
          <p>{{ formatDisplayTime(job.createdAt) }}</p>
          <el-progress :percentage="job.progress" :stroke-width="8" />
          <div class="batch-job-card__stats">
            <span>成功 {{ job.successCount }}</span>
            <span>失败 {{ job.failedCount }}</span>
            <span>总数 {{ job.requestedCount }}</span>
          </div>
        </button>
      </article>

      <article class="surface-card section-card batch-history__detail reveal-up" style="--delay: 0.14s">
        <template v-if="selectedJob">
          <div class="batch-detail__head">
            <div>
              <h3>{{ selectedJob.profileName }}</h3>
              <p>
                #{{ selectedJob.id }} · {{ getEngineLabel(selectedJob.engineType) }}
                <span v-if="selectedJob.versionName"> · {{ selectedJob.versionName }}</span>
              </p>
            </div>
            <div class="batch-detail__actions">
              <el-tag :type="getBatchStatusType(selectedJob.status)" effect="light" round>
                {{ getBatchStatusLabel(selectedJob.status) }}
              </el-tag>
              <el-button
                :disabled="!selectedJob.canDownload"
                type="primary"
                @click="downloadBatch(selectedJob)"
              >
                下载 ZIP
              </el-button>
            </div>
          </div>

          <div class="batch-detail__metrics">
            <div>
              <strong>{{ selectedJob.requestedCount }}</strong>
              <span>请求篇数</span>
            </div>
            <div>
              <strong>{{ selectedJob.successCount }}</strong>
              <span>成功</span>
            </div>
            <div>
              <strong>{{ selectedJob.failedCount }}</strong>
              <span>失败</span>
            </div>
            <div>
              <strong>{{ selectedJob.sequenceStart ?? '-' }} - {{ selectedJob.sequenceEnd ?? '-' }}</strong>
              <span>文件序号</span>
            </div>
          </div>

          <el-progress :percentage="selectedJob.progress" :stroke-width="10" striped />

          <div v-if="selectedJob.lastError" class="batch-error">
            最近失败：{{ selectedJob.lastError }}
          </div>

          <el-table
            v-loading="detailLoading"
            :data="selectedJob.items || []"
            class="batch-item-table"
            empty-text="暂无明细"
          >
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="batch-item-expand">
                  <template v-if="row.promptText">
                    <h4>Prompt 内容</h4>
                    <pre>{{ row.promptText }}</pre>
                  </template>
                  <template v-else>
                    <h4>{{ row.status === 'RUNNING' ? '生成进度' : '失败原因' }}</h4>
                    <p>{{ row.errorMessage || '暂无状态详情' }}</p>
                  </template>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="篇次" prop="itemIndex" width="80" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="getItemStatusType(row.status)" effect="light" round>
                  {{ getItemStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="序号" width="90">
              <template #default="{ row }">{{ row.sequence ?? '-' }}</template>
            </el-table-column>
            <el-table-column label="文件名" min-width="220">
              <template #default="{ row }">{{ row.fileName || '-' }}</template>
            </el-table-column>
            <el-table-column label="状态详情" min-width="260">
              <template #default="{ row }">{{ row.errorMessage || '-' }}</template>
            </el-table-column>
          </el-table>
        </template>

        <div v-else class="batch-empty">
          <div class="batch-empty__title">选择一个批量任务</div>
          <p>左侧列表会按创建时间倒序展示最近 100 个任务。</p>
        </div>
      </article>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  downloadGeoPromptBatch,
  getGeoPromptBatch,
  getGeoPromptBatches,
} from '@/api/geo'
import type {
  GeoPromptBatchEngineType,
  GeoPromptBatchItemStatus,
  GeoPromptBatchJob,
  GeoPromptBatchJobStatus,
} from '@/types/geo'

const jobs = ref<GeoPromptBatchJob[]>([])
const selectedJob = ref<GeoPromptBatchJob | null>(null)
const loading = ref(false)
const detailLoading = ref(false)
let pollingTimer: number | null = null

const loadJobs = async (silent = false) => {
  if (!silent) loading.value = true

  try {
    jobs.value = await getGeoPromptBatches()

    if (!selectedJob.value && jobs.value.length > 0) {
      await selectJob(jobs.value[0].id)
      return
    }

    if (selectedJob.value) {
      const updated = jobs.value.find((item) => item.id === selectedJob.value?.id)
      if (updated) {
        selectedJob.value = {
          ...selectedJob.value,
          ...updated,
        }
      }
    }
  } catch (error) {
    if (!silent) {
      ElMessage.error(error instanceof Error ? error.message : '批量历史加载失败')
    }
  } finally {
    loading.value = false
  }
}

const selectJob = async (id: number) => {
  detailLoading.value = true

  try {
    selectedJob.value = await getGeoPromptBatch(id)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '批量任务详情加载失败')
  } finally {
    detailLoading.value = false
  }
}

const downloadBatch = async (job: GeoPromptBatchJob) => {
  try {
    const { blob, fileName } = await downloadGeoPromptBatch(job.id)
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

const getEngineLabel = (type: GeoPromptBatchEngineType) => {
  return type === 'V2' ? '新版' : '旧版'
}

const getBatchStatusLabel = (status: GeoPromptBatchJobStatus) => {
  const labels: Record<GeoPromptBatchJobStatus, string> = {
    QUEUED: '排队中',
    RUNNING: '生成中',
    COMPLETED: '已完成',
    PARTIAL_FAILED: '部分失败',
    FAILED: '失败',
  }

  return labels[status]
}

const getBatchStatusType = (status: GeoPromptBatchJobStatus) => {
  if (status === 'COMPLETED') return 'success'
  if (status === 'PARTIAL_FAILED') return 'warning'
  if (status === 'FAILED') return 'danger'
  return 'info'
}

const getItemStatusLabel = (status: GeoPromptBatchItemStatus) => {
  const labels: Record<GeoPromptBatchItemStatus, string> = {
    QUEUED: '排队',
    RUNNING: '生成中',
    SUCCEEDED: '成功',
    FAILED: '失败',
  }

  return labels[status]
}

const getItemStatusType = (status: GeoPromptBatchItemStatus) => {
  if (status === 'SUCCEEDED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'RUNNING') return 'warning'
  return 'info'
}

const formatDisplayTime = (value: string) => {
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  })
}

onMounted(async () => {
  await loadJobs()
  pollingTimer = window.setInterval(() => {
    void loadJobs(true)
    if (selectedJob.value && !['COMPLETED', 'PARTIAL_FAILED', 'FAILED'].includes(selectedJob.value.status)) {
      void selectJob(selectedJob.value.id)
    }
  }, 4000)
})

onUnmounted(() => {
  if (pollingTimer) {
    window.clearInterval(pollingTimer)
  }
})
</script>

<style scoped>
.batch-history {
  display: grid;
  gap: 18px;
}

.batch-history__head,
.batch-detail__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.batch-history__head h3,
.batch-detail__head h3 {
  margin: 0 0 8px;
  color: #4e3e44;
}

.batch-history__head p,
.batch-detail__head p,
.batch-empty p {
  margin: 0;
  color: #7f6b72;
  line-height: 1.7;
  font-size: 13px;
}

.batch-history__grid {
  display: grid;
  grid-template-columns: minmax(280px, 0.42fr) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.batch-history__list {
  display: grid;
  gap: 12px;
}

.batch-job-card {
  display: grid;
  gap: 10px;
  width: 100%;
  padding: 16px;
  text-align: left;
  border: 1px solid rgba(225, 205, 200, 0.82);
  border-radius: 18px;
  background: rgba(255, 252, 250, 0.86);
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.batch-job-card:hover,
.batch-job-card.active {
  transform: translateY(-1px);
  border-color: rgba(209, 112, 118, 0.42);
  box-shadow: 0 16px 32px rgba(161, 104, 100, 0.12);
}

.batch-job-card h4 {
  margin: 0;
  color: #514146;
  font-size: 15px;
}

.batch-job-card p {
  margin: 0;
  color: #8a747b;
  font-size: 12px;
}

.batch-job-card__top,
.batch-job-card__stats,
.batch-detail__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: space-between;
}

.batch-job-card__top span,
.batch-job-card__stats span {
  color: #7f6870;
  font-size: 12px;
}

.batch-detail__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 18px 0;
}

.batch-detail__metrics div {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 248, 245, 0.88);
  border: 1px solid rgba(229, 205, 198, 0.76);
}

.batch-detail__metrics strong {
  color: #523f46;
  font-size: 20px;
}

.batch-detail__metrics span {
  color: #8a747b;
  font-size: 12px;
}

.batch-error {
  padding: 12px;
  margin-top: 14px;
  border-radius: 14px;
  background: rgba(245, 108, 108, 0.08);
  color: #a84848;
  font-size: 12px;
  line-height: 1.7;
}

.batch-item-table {
  margin-top: 18px;
}

.batch-item-expand {
  padding: 8px 18px 16px;
}

.batch-item-expand h4 {
  margin: 0 0 10px;
  color: #5b464d;
}

.batch-item-expand pre {
  max-height: 360px;
  padding: 14px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  border-radius: 14px;
  background: rgba(255, 248, 245, 0.92);
  color: #4f3d42;
  font-size: 12px;
  line-height: 1.8;
}

.batch-empty {
  display: grid;
  gap: 10px;
  padding: 28px 0;
}

.batch-empty__title {
  color: #514146;
  font-weight: 700;
}

@media (max-width: 1280px) {
  .batch-history__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .batch-detail__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
