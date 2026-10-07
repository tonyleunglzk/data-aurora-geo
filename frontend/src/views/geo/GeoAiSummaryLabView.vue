<template>
  <section class="geo-ai-lab-layout">
    <div class="geo-ai-lab-sidebar">
      <article class="surface-card section-card reveal-up" style="--delay: 0.08s">
        <div class="geo-ai-lab-card-head">
          <div>
            <h3>AI 总结测试台</h3>
            <p>这里专门观察某个研究项目在模型侧的原始流式返回，不会覆盖正式 AI 总结，也不会生成规则卡。</p>
          </div>
          <el-tag effect="light" round type="warning">仅测试，不落库</el-tag>
        </div>

        <el-form label-position="top">
          <el-form-item label="研究项目">
            <el-select
              v-model="selectedProjectId"
              filterable
              placeholder="选择一个已解剖的研究项目"
              @change="handleProjectChange"
            >
              <el-option
                v-for="project in projects"
                :key="project.id"
                :label="`${project.keyword} · ${project.category}`"
                :value="project.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="测试模型">
            <el-select
              v-model="testForm.model"
              allow-create
              clearable
              default-first-option
              filterable
              placeholder="如：claude-opus-4-6-20250219"
            >
              <el-option
                v-for="item in modelOptions"
                :key="item"
                :label="item"
                :value="item"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="保底链路">
            <div class="geo-ai-lab-switch-row">
              <el-switch v-model="testForm.allowFallback" />
              <span>
                {{ testForm.allowFallback ? '启用' : '关闭' }}
              </span>
            </div>
          </el-form-item>
        </el-form>

        <div class="geo-ai-lab-actions">
          <el-button
            :disabled="!canStartTest"
            :loading="testing"
            type="primary"
            @click="startTest"
          >
            开始测试
          </el-button>
          <el-button :disabled="!testing" @click="stopTest">停止</el-button>
          <el-button :disabled="testing" @click="resetOutput">清空输出</el-button>
        </div>

        <div class="geo-ai-lab-inline-note">
          {{
            testForm.allowFallback
              ? '开启后会优先尝试主模型，失败时再切到保底链路，但页面会保留前面的 Opus 原始输出，不会再清空。'
              : '关闭后只跑你指定的模型，适合单独观察 Opus 为什么超时、结构化失败或直接报错。'
          }}
        </div>
      </article>

      <article v-loading="loadingProject" class="surface-card section-card reveal-up" style="--delay: 0.14s">
        <div class="geo-ai-lab-card-head">
          <div>
            <h3>项目概况</h3>
            <p>先确认当前项目里有没有足够的已解剖样本，否则模型测试本身就不会成立。</p>
          </div>
        </div>

        <template v-if="activeProject">
          <div class="geo-ai-lab-project-meta">
            <span>关键词：{{ activeProject.keyword }}</span>
            <span>品类：{{ activeProject.category }}</span>
            <span>模式：{{ activeProject.engine === 'manual' ? '手动模式' : '自动模式' }}</span>
            <span>已解剖文章：{{ analyzedResultCount }}</span>
          </div>

          <div class="geo-ai-lab-project-note">
            {{ activeProject.statusMessage || '项目已经完成基础解剖，可以直接进入模型测试。' }}
          </div>
        </template>

        <el-empty
          v-else
          description="先选择一个研究项目，这里会展示它是否适合拿来做模型测试。"
        />
      </article>
    </div>

    <div class="geo-ai-lab-main">
      <article class="surface-card section-card reveal-up" style="--delay: 0.1s">
        <div class="geo-ai-lab-card-head">
          <div>
            <h3>测试状态</h3>
            <p>这里会实时显示当前阶段、请求模型、实际生成模型，以及有没有发生回退。</p>
          </div>
        </div>

        <div class="geo-ai-lab-status-grid">
          <div class="geo-ai-lab-metric">
            <span>当前状态</span>
            <strong>{{ currentStatusLabel }}</strong>
          </div>
          <div class="geo-ai-lab-metric">
            <span>请求模型</span>
            <strong>{{ requestedModelDisplay }}</strong>
          </div>
          <div class="geo-ai-lab-metric">
            <span>实际生成模型</span>
            <strong>{{ actualModelDisplay }}</strong>
          </div>
          <div class="geo-ai-lab-metric">
            <span>保底链路</span>
            <strong>{{ draftSummary?.fallbackUsed ? '已触发' : testForm.allowFallback ? '已开启' : '未开启' }}</strong>
          </div>
        </div>

        <el-alert
          v-if="errorMessage"
          :closable="false"
          show-icon
          :title="errorMessage"
          type="error"
        />
        <el-alert
          v-else-if="statusMessage"
          :closable="false"
          show-icon
          :title="statusMessage"
          type="info"
        />
      </article>

      <article class="surface-card section-card reveal-up" style="--delay: 0.16s">
        <div class="geo-ai-lab-card-head">
          <div>
            <h3>Opus 原始流式返回</h3>
            <p>这里直接展示模型实时吐出来的原始文本。就算后面切到保底链路，前面的 Opus 输出也会保留下来方便对照。</p>
          </div>
        </div>

        <pre v-if="streamText" class="geo-ai-lab-stream-output">{{ streamText }}</pre>
        <el-empty
          v-else
          description="还没有开始测试。点击左侧“开始测试”后，这里会实时出现模型原始输出。"
        />
      </article>

      <article v-loading="loadingPromptPreview" class="surface-card section-card reveal-up" style="--delay: 0.2s">
        <div class="geo-ai-lab-card-head">
          <div>
            <h3>发送给模型的 Prompt</h3>
            <p>这里直接展示后端实际组装出来、准备发给当前测试模型的 prompt，方便你检查引号、格式要求和输入上下文。</p>
          </div>
          <el-button :disabled="!selectedProjectId" plain @click="loadPromptPreview">刷新 Prompt</el-button>
        </div>

        <template v-if="promptPreview">
          <div class="geo-ai-lab-result-meta">
            <span>请求模型：{{ promptPreview.requestedModel }}</span>
            <span>保底模型：{{ promptPreview.fallbackModel }}</span>
            <span>已解剖文章总数：{{ promptPreview.analyzedCount }}</span>
            <span>主 Prompt 使用：{{ promptPreview.primaryIncludedCount }} 篇</span>
            <span>压缩重试使用：{{ promptPreview.retryIncludedCount }} 篇</span>
            <span>成功补全文：{{ promptPreview.fullTextIncludedCount }} 篇</span>
            <span>回退摘录：{{ promptPreview.excerptFallbackCount }} 篇</span>
          </div>

          <div class="geo-ai-lab-inline-note">
            当前主/重试 Prompt 都会优先带完整正文；只有某篇文章补抓全文失败时，才会回退为已有摘录。
          </div>

          <div class="geo-ai-lab-prompt-grid">
            <div class="geo-ai-lab-prompt-block">
              <h5>System Prompt</h5>
              <pre>{{ promptPreview.systemPrompt }}</pre>
            </div>
            <div class="geo-ai-lab-prompt-block">
              <h5>User Prompt</h5>
              <pre>{{ promptPreview.userPrompt }}</pre>
            </div>
          </div>

          <div v-if="testForm.allowFallback" class="geo-ai-lab-prompt-block geo-ai-lab-prompt-block--full">
            <h5>保底重试 Prompt</h5>
            <pre>{{ promptPreview.retryUserPrompt }}</pre>
          </div>
        </template>

        <el-empty
          v-else
          description="选中项目后，这里会展示当前真正发给模型的 Prompt。"
        />
      </article>

      <article class="surface-card section-card reveal-up" style="--delay: 0.24s">
        <div class="geo-ai-lab-card-head">
          <div>
            <h3>结构化结果预览</h3>
            <p>只有当模型最终成功形成完整结构化结果时，这里才会出现预览；测试页仍然不会把它写进数据库。</p>
          </div>
        </div>

        <template v-if="draftSummary">
          <div class="geo-ai-lab-result-meta">
            <span>请求模型：{{ draftSummary.requestedModel }}</span>
            <span>实际生成模型：{{ draftSummary.model }}</span>
            <span>回退：{{ draftSummary.fallbackUsed ? '是' : '否' }}</span>
          </div>

          <div
            v-if="draftSummary.fallbackUsed && draftSummary.fallbackReason"
            class="geo-ai-lab-inline-note geo-ai-lab-inline-note--warning"
          >
            {{ draftSummary.fallbackReason }}
          </div>

          <div class="geo-ai-lab-result-summary">
            {{ draftSummary.rawSummary }}
          </div>

          <div class="geo-ai-lab-result-grid">
            <div
              v-for="section in summarySections"
              :key="section.key"
              class="geo-ai-lab-result-block"
            >
              <h5>{{ section.title }}</h5>
              <ul>
                <li v-for="item in section.items" :key="item">{{ item }}</li>
              </ul>
            </div>
          </div>
        </template>

        <el-empty
          v-else
          description="当测试拿到完整结构化结果后，这里会直接展示，不需要等正式保存。"
        />
      </article>

      <article class="surface-card section-card reveal-up" style="--delay: 0.28s">
        <div class="geo-ai-lab-card-head">
          <div>
            <h3>事件日志</h3>
            <p>这里按时间记录测试过程中的状态事件、重置、报错和完成信息，方便我们复盘。</p>
          </div>
        </div>

        <div v-if="eventLogs.length > 0" class="geo-ai-lab-log-list">
          <article
            v-for="item in eventLogs"
            :key="item.id"
            :class="['geo-ai-lab-log-item', `geo-ai-lab-log-item--${item.level}`]"
          >
            <div class="geo-ai-lab-log-item__top">
              <strong>{{ item.label }}</strong>
              <span>{{ item.time }}</span>
            </div>
            <p>{{ item.message }}</p>
            <span v-if="item.model" class="geo-ai-lab-log-item__model">模型：{{ item.model }}</span>
          </article>
        </div>

        <el-empty
          v-else
          description="测试开始后，这里会持续记录模型状态和回退信息。"
        />
      </article>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getGeoSerpProjectAiSummaryTestPrompt,
  getGeoProviderConfig,
  getGeoSerpProject,
  getGeoSerpProjects,
  streamGeoSerpProjectAiSummaryTest,
} from '@/api/geo'
import type {
  GeoProviderConfigView,
  GeoSerpAiSummaryDraft,
  GeoSerpAiSummaryTestPrompt,
  GeoSerpProjectDetail,
  GeoSerpProjectSummary,
} from '@/types/geo'

type LabEventLog = {
  id: number
  time: string
  label: string
  message: string
  model?: string
  level: 'info' | 'warning' | 'error' | 'success'
}

const OPUS_MODEL = 'claude-opus-4-6-20250219'

const providerConfig = ref<GeoProviderConfigView | null>(null)
const projects = ref<GeoSerpProjectSummary[]>([])
const selectedProjectId = ref<number | null>(null)
const activeProject = ref<GeoSerpProjectDetail | null>(null)
const loadingProjects = ref(false)
const loadingProject = ref(false)
const testing = ref(false)
const streamText = ref('')
const statusMessage = ref('')
const errorMessage = ref('')
const currentPhase = ref<'idle' | 'running' | 'completed' | 'failed'>('idle')
const requestedModel = ref('')
const actualModel = ref('')
const draftSummary = ref<GeoSerpAiSummaryDraft | null>(null)
const promptPreview = ref<GeoSerpAiSummaryTestPrompt | null>(null)
const loadingPromptPreview = ref(false)
const eventLogs = ref<LabEventLog[]>([])

const testForm = reactive({
  model: '',
  allowFallback: false,
})

let abortController: AbortController | null = null
let eventId = 0

const analyzedResultCount = computed(() => {
  return activeProject.value?.results.filter((item) => item.fetchStatus === 'ANALYZED').length ?? 0
})

const canStartTest = computed(() => {
  return Boolean(selectedProjectId.value && analyzedResultCount.value > 0)
})

const modelOptions = computed(() => {
  const values = new Set<string>([
    providerConfig.value?.model || '',
    OPUS_MODEL,
    'claude-opus-4-6',
    'claude-3-5-sonnet-20241022',
  ])

  if (testForm.model.trim()) {
    values.add(testForm.model.trim())
  }

  return Array.from(values).filter(Boolean)
})

const currentStatusLabel = computed(() => {
  if (currentPhase.value === 'running') return '测试进行中'
  if (currentPhase.value === 'completed') return '测试完成'
  if (currentPhase.value === 'failed') return '测试失败'
  return '待开始'
})

const requestedModelDisplay = computed(() => {
  return draftSummary.value?.requestedModel || requestedModel.value || testForm.model.trim() || providerConfig.value?.model || OPUS_MODEL
})

const actualModelDisplay = computed(() => {
  return draftSummary.value?.model || actualModel.value || '等待结果'
})

const summarySections = computed(() => {
  if (!draftSummary.value) return []

  return [
    { key: 'titlePatterns', title: '标题模式', items: draftSummary.value.titlePatterns },
    { key: 'leadPatterns', title: '开头切入', items: draftSummary.value.leadPatterns },
    { key: 'sectionBlueprint', title: '主体结构', items: draftSummary.value.sectionBlueprint },
    { key: 'keywordPlacement', title: '关键词布局', items: draftSummary.value.keywordPlacement },
    { key: 'sellingPointOrder', title: '卖点顺序', items: draftSummary.value.sellingPointOrder },
    { key: 'trustSignals', title: '信任建立', items: draftSummary.value.trustSignals },
    { key: 'endingPatterns', title: '结尾方式', items: draftSummary.value.endingPatterns },
    { key: 'antiPatterns', title: '明显禁忌点', items: draftSummary.value.antiPatterns },
    { key: 'rankingHypotheses', title: '排名解释', items: draftSummary.value.rankingHypotheses },
  ]
})

const pushLog = (log: Omit<LabEventLog, 'id' | 'time'>) => {
  eventLogs.value.unshift({
    ...log,
    id: ++eventId,
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
  })
}

const loadProjects = async () => {
  loadingProjects.value = true

  try {
    const [config, projectList] = await Promise.all([
      getGeoProviderConfig(),
      getGeoSerpProjects(),
    ])

    providerConfig.value = config
    projects.value = projectList

    if (!testForm.model.trim()) {
      testForm.model = config.model.trim().toLowerCase().includes('opus') ? config.model : OPUS_MODEL
    }

    const fallbackProjectId = projectList[0]?.id ?? null
    if (!selectedProjectId.value && fallbackProjectId) {
      selectedProjectId.value = fallbackProjectId
      await loadProjectDetail(fallbackProjectId)
    }
  } finally {
    loadingProjects.value = false
  }
}

const loadProjectDetail = async (id: number) => {
  loadingProject.value = true

  try {
    activeProject.value = await getGeoSerpProject(id)
  } finally {
    loadingProject.value = false
  }
}

const loadPromptPreview = async () => {
  if (!selectedProjectId.value) {
    promptPreview.value = null
    return
  }

  loadingPromptPreview.value = true

  try {
    promptPreview.value = await getGeoSerpProjectAiSummaryTestPrompt(selectedProjectId.value, {
      model: testForm.model.trim() || providerConfig.value?.model || OPUS_MODEL,
      allowFallback: testForm.allowFallback,
    })
  } finally {
    loadingPromptPreview.value = false
  }
}

const handleProjectChange = async (value: number | null) => {
  if (!value) {
    activeProject.value = null
    promptPreview.value = null
    return
  }

  await loadProjectDetail(value)
  await loadPromptPreview()
}

const resetOutput = () => {
  streamText.value = ''
  statusMessage.value = ''
  errorMessage.value = ''
  currentPhase.value = 'idle'
  requestedModel.value = ''
  actualModel.value = ''
  draftSummary.value = null
  eventLogs.value = []
}

const stopTest = () => {
  abortController?.abort()
  abortController = null
  testing.value = false
  currentPhase.value = 'failed'
  statusMessage.value = '测试已手动停止'
  pushLog({
    label: '手动停止',
    message: '本次测试已手动终止。',
    level: 'warning',
  })
}

const startTest = async () => {
  if (!selectedProjectId.value) {
    ElMessage.warning('请先选择一个研究项目')
    return
  }

  if (!canStartTest.value) {
    ElMessage.warning('当前项目至少需要一篇已解剖文章，才能测试 AI 总结')
    return
  }

  abortController?.abort()
  abortController = new AbortController()
  resetOutput()

  requestedModel.value = testForm.model.trim() || providerConfig.value?.model || OPUS_MODEL
  currentPhase.value = 'running'
  testing.value = true
  pushLog({
    label: '开始测试',
    message: `准备使用 ${requestedModel.value} 进行 AI 总结测试。`,
    model: requestedModel.value,
    level: 'info',
  })

  try {
    await streamGeoSerpProjectAiSummaryTest(
      selectedProjectId.value,
      {
        model: requestedModel.value,
        allowFallback: testForm.allowFallback,
      },
      {
        signal: abortController.signal,
        onEvent: (event) => {
          if (event.type === 'text') {
            streamText.value += event.content || ''
            return
          }

          if (event.type === 'status') {
            statusMessage.value = event.content || ''
            if (event.model) {
              actualModel.value = event.model
            }

            if (event.phase === 'fallback') {
              streamText.value += '\n\n[系统提示] 主模型未稳定完成，以下将继续显示保底链路的输出。\n\n'
            } else if (event.phase === 'repairing') {
              streamText.value += '\n\n[系统提示] 主模型已经返回内容，正在修复结构化格式。\n\n'
            }

            pushLog({
              label: '状态更新',
              message: event.content || '模型状态已更新。',
              model: event.model || undefined,
              level: event.phase === 'fallback' || event.phase === 'repairing' ? 'warning' : 'info',
            })
            return
          }

          if (event.type === 'reset') {
            streamText.value = ''
            pushLog({
              label: '预览重置',
              message: '流式预览已清空，准备切换到新的生成链路。',
              level: 'warning',
            })
            return
          }

          if (event.type === 'result' && event.summary) {
            draftSummary.value = event.summary
            actualModel.value = event.summary.model
            currentPhase.value = 'completed'
            pushLog({
              label: '结构化结果',
              message: '已经拿到完整结构化结果，本页仅展示，不会落库。',
              model: event.summary.model,
              level: 'success',
            })
            return
          }

          if (event.type === 'error') {
            errorMessage.value = event.content || '测试失败'
            currentPhase.value = 'failed'
            pushLog({
              label: '错误',
              message: errorMessage.value,
              level: 'error',
            })
            return
          }

          if (event.type === 'done') {
            if (currentPhase.value !== 'failed') {
              currentPhase.value = 'completed'
            }
            pushLog({
              label: '完成',
              message: '本次流式测试已经结束。',
              level: currentPhase.value === 'failed' ? 'warning' : 'success',
            })
          }
        },
      }
    )
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return
    }

    errorMessage.value = error instanceof Error ? error.message : '测试失败'
    currentPhase.value = 'failed'
    pushLog({
      label: '请求失败',
      message: errorMessage.value,
      level: 'error',
    })
  } finally {
    testing.value = false
    abortController = null
  }
}

onMounted(async () => {
  await loadProjects()
})

onBeforeUnmount(() => {
  abortController?.abort()
})
</script>

<style scoped>
.geo-ai-lab-layout {
  display: grid;
  gap: 22px;
  grid-template-columns: 360px minmax(0, 1fr);
}

.geo-ai-lab-sidebar,
.geo-ai-lab-main {
  display: grid;
  gap: 22px;
}

.geo-ai-lab-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.geo-ai-lab-card-head h3 {
  margin: 0;
  font-size: 20px;
  color: #20243a;
}

.geo-ai-lab-card-head p {
  margin: 8px 0 0;
  color: #667085;
  line-height: 1.6;
}

.geo-ai-lab-switch-row {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #56627a;
}

.geo-ai-lab-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.geo-ai-lab-inline-note {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255, 122, 89, 0.08);
  color: #93472b;
  line-height: 1.7;
}

.geo-ai-lab-inline-note--warning {
  background: rgba(245, 158, 11, 0.14);
  color: #8a5200;
}

.geo-ai-lab-project-meta,
.geo-ai-lab-result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  margin-bottom: 16px;
  color: #56627a;
  font-size: 13px;
}

.geo-ai-lab-project-note,
.geo-ai-lab-result-summary {
  padding: 16px 18px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(255, 248, 243, 0.96), rgba(255, 255, 255, 0.98));
  border: 1px solid rgba(255, 122, 89, 0.14);
  color: #3d4662;
  line-height: 1.8;
}

.geo-ai-lab-status-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.geo-ai-lab-metric {
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(255, 248, 243, 0.76);
  border: 1px solid rgba(255, 122, 89, 0.12);
}

.geo-ai-lab-metric span {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  color: #7b859d;
}

.geo-ai-lab-metric strong {
  color: #20243a;
  font-size: 16px;
}

.geo-ai-lab-stream-output {
  min-height: 220px;
  margin: 0;
  padding: 18px;
  overflow: auto;
  border-radius: 18px;
  background: #111827;
  color: #f9fafb;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.geo-ai-lab-result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.geo-ai-lab-prompt-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.geo-ai-lab-prompt-block {
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.geo-ai-lab-prompt-block--full {
  margin-top: 14px;
}

.geo-ai-lab-prompt-block h5 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #20243a;
}

.geo-ai-lab-prompt-block pre {
  margin: 0;
  max-height: 420px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
  color: #44506a;
}

.geo-ai-lab-result-block {
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.geo-ai-lab-result-block h5 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #20243a;
}

.geo-ai-lab-result-block ul {
  margin: 0;
  padding-left: 18px;
  color: #56627a;
  line-height: 1.7;
}

.geo-ai-lab-log-list {
  display: grid;
  gap: 12px;
}

.geo-ai-lab-log-item {
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.94);
}

.geo-ai-lab-log-item--warning {
  background: rgba(255, 247, 237, 0.92);
}

.geo-ai-lab-log-item--error {
  background: rgba(254, 242, 242, 0.94);
}

.geo-ai-lab-log-item--success {
  background: rgba(240, 253, 244, 0.94);
}

.geo-ai-lab-log-item__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  color: #20243a;
}

.geo-ai-lab-log-item p {
  margin: 0;
  color: #56627a;
  line-height: 1.7;
}

.geo-ai-lab-log-item__model {
  display: inline-flex;
  margin-top: 10px;
  color: #7b859d;
  font-size: 12px;
}

@media (max-width: 1120px) {
  .geo-ai-lab-layout {
    grid-template-columns: 1fr;
  }

  .geo-ai-lab-status-grid,
  .geo-ai-lab-prompt-grid,
  .geo-ai-lab-result-grid {
    grid-template-columns: 1fr;
  }
}
</style>
