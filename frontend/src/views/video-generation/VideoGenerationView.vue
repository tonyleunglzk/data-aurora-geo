<template>
  <PageHeader
    description="图片可选，支持单条、批量和分镜脚本生成，任务会进入右侧队列。"
    eyebrow="Seedance"
    title="视频生成"
  />

  <section class="video-simple-grid">
    <article class="surface-card section-card reveal-up video-simple-panel" style="--delay: 0.04s">
      <div class="video-simple-head">
        <div>
          <h3>视频生成</h3>
          <p>提交后会进入右侧任务队列，刷新页面后仍可继续查看。</p>
        </div>
        <div class="video-specs">
          <el-tag effect="light" round>{{ selectedModel?.shortLabel || 'Seedance 1.5 Pro' }}</el-tag>
          <el-tag effect="plain" round>{{ form.duration }} 秒</el-tag>
          <el-tag effect="plain" round>{{ generationCount }} 条</el-tag>
          <el-tag effect="plain" round>{{ form.generateAudio ? '声音' : '无声' }}</el-tag>
          <el-tag effect="plain" round>9:16</el-tag>
          <el-tag effect="plain" round>720p</el-tag>
        </div>
      </div>

      <div :class="['video-form-grid', { 'is-storyboard': form.mode === 'storyboard' }]">
        <section v-if="form.mode !== 'storyboard'" class="image-field">
          <label class="field-label" for="video-image-input">图片（可选）</label>
          <div class="native-file-row">
            <input
              id="video-image-input"
              ref="fileInputRef"
              accept="image/png,image/jpeg,image/jpg,image/webp,.png,.jpg,.jpeg,.webp"
              class="native-file-input"
              type="file"
              @change="handleFileChange"
            />
            <el-button :disabled="!selectedFile" :icon="Delete" plain @click="clearImage">清空</el-button>
          </div>

          <div class="image-preview">
            <img v-if="previewUrl" :src="previewUrl" alt="" />
            <div v-else class="image-empty">
              <el-icon><UploadFilled /></el-icon>
              <strong>未选择图片</strong>
              <span>上传后作为首帧；不上传则按提示词直接生成。</span>
            </div>
          </div>

          <div class="file-meta">
            <template v-if="selectedFile">
              {{ selectedFile.name }} · {{ formatFileSize(selectedFile.size) }}
            </template>
            <template v-else>可选上传 1 张图片作为首帧。</template>
          </div>
        </section>

        <section v-else class="storyboard-import">
          <div class="storyboard-import__head">
            <label class="field-label" for="storyboard-script-input">分镜脚本</label>
            <el-button :disabled="!storyboardScript.trim()" plain @click="parseStoryboard">
              解析分镜
            </el-button>
          </div>
          <el-input
            id="storyboard-script-input"
            v-model="storyboardScript"
            :autosize="{ minRows: 13, maxRows: 18 }"
            maxlength="12000"
            placeholder="粘贴完整分镜脚本，例如：镜头 2｜10-20秒｜提出问题..."
            show-word-limit
            type="textarea"
          />
          <div class="file-meta">
            系统只负责拆分镜头和校准时长，不会改写你的提示词内容。
          </div>
        </section>

        <el-form class="prompt-form" label-position="top">
          <el-form-item label="生成模式">
            <el-radio-group v-model="form.mode">
              <el-radio-button label="single">单条生成</el-radio-button>
              <el-radio-button label="batch">批量生成</el-radio-button>
              <el-radio-button label="storyboard">分镜生成</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="生成模型">
            <el-select v-model="form.model">
              <el-option
                v-for="model in modelOptions"
                :key="model.value"
                :label="model.label"
                :value="model.value"
              >
                <span>{{ model.label }}</span>
                <em class="select-option-meta">{{ model.description }}</em>
              </el-option>
            </el-select>
          </el-form-item>

          <el-form-item label="视频时长">
            <el-select
              v-model="form.duration"
              placeholder="选择时长"
              @change="handleFormDurationChange"
            >
              <el-option
                v-for="duration in durationOptions"
                :key="duration"
                :label="`${duration} 秒`"
                :value="duration"
              />
            </el-select>
            <div class="form-help">{{ modelDurationSummary }}</div>
          </el-form-item>

          <el-form-item label="声音">
            <div class="audio-switch-row">
              <el-switch
                v-model="form.generateAudio"
                active-text="生成声音"
                inactive-text="无声视频"
                inline-prompt
              />
              <span>简单版先让模型原生生成声音，旁白不保证逐字朗读。</span>
            </div>
          </el-form-item>

          <el-form-item v-if="form.mode !== 'storyboard'" :label="form.mode === 'batch' ? '批量提示词' : '视频提示词'">
            <el-input
              v-if="form.mode === 'single'"
              v-model="form.prompt"
              :autosize="{ minRows: 7, maxRows: 10 }"
              maxlength="1200"
              placeholder="例如：以这张图作为首帧，镜头缓慢推进，展示产品质感和使用场景，画面真实自然。"
              show-word-limit
              type="textarea"
            />
            <el-input
              v-else
              v-model="form.batchPromptText"
              :autosize="{ minRows: 8, maxRows: 12 }"
              maxlength="6000"
              placeholder="每行一个视频提示词，最多 10 条。"
              show-word-limit
              type="textarea"
            />
          </el-form-item>

          <template v-else>
            <div v-if="storyboardScenes.length" class="storyboard-scenes">
              <div
                v-for="scene in storyboardScenes"
                :key="scene.id"
                class="storyboard-scene"
              >
                <div class="storyboard-scene__head">
                  <div>
                    <strong>{{ scene.shotLabel || '未命名镜头' }}</strong>
                    <span>{{ scene.timeRange || '未填写时间段' }}</span>
                  </div>
                  <div class="storyboard-scene__actions">
                    <el-select
                      v-model="scene.duration"
                      class="scene-duration-select"
                      size="small"
                      @change="handleSceneDurationChange(scene)"
                    >
                      <el-option
                        v-for="duration in durationOptions"
                        :key="duration"
                        :label="`${duration} 秒`"
                        :value="duration"
                      />
                    </el-select>
                    <el-button
                      :disabled="isBusy || !buildScenePrompt(scene)"
                      :loading="isBusy && creatingTotal === 1"
                      plain
                      size="small"
                      @click="handleGenerateScene(scene)"
                    >
                      单独生成
                    </el-button>
                  </div>
                </div>
                <div v-if="scene.durationNotice" class="scene-notice">{{ scene.durationNotice }}</div>

                <el-input v-model="scene.title" placeholder="镜头主题" />
                <el-input
                  v-model="scene.visual"
                  :autosize="{ minRows: 3, maxRows: 6 }"
                  placeholder="画面提示词"
                  type="textarea"
                />
                <el-input
                  v-model="scene.subtitles"
                  :autosize="{ minRows: 2, maxRows: 4 }"
                  placeholder="屏幕字幕"
                  type="textarea"
                />
                <el-input
                  v-model="scene.narration"
                  :autosize="{ minRows: 2, maxRows: 4 }"
                  placeholder="旁白"
                  type="textarea"
                />

                <div class="scene-image-row">
                  <input
                    :key="scene.imageInputKey"
                    accept="image/png,image/jpeg,image/jpg,image/webp,.png,.jpg,.jpeg,.webp"
                    class="native-file-input"
                    type="file"
                    @change="handleSceneFileChange(scene, $event)"
                  />
                  <el-button :disabled="!scene.imageFile" :icon="Delete" plain size="small" @click="clearSceneImage(scene)">
                    清空图片
                  </el-button>
                </div>
                <div v-if="scene.imagePreviewUrl" class="scene-image-preview">
                  <img :src="scene.imagePreviewUrl" alt="" />
                </div>
                <div v-if="scene.imageFile" class="file-meta">
                  {{ scene.imageFile.name }} · {{ formatFileSize(scene.imageFile.size) }}
                </div>
              </div>
            </div>
            <div v-else class="storyboard-empty">
              粘贴脚本后点击“解析分镜”，镜头会在这里变成可编辑卡片。
            </div>
          </template>

          <div v-if="durationWarningText" class="video-warning">{{ durationWarningText }}</div>
          <div v-if="noticeText" class="video-notice">{{ noticeText }}</div>

          <div class="video-actions">
            <span>{{ actionHint }}</span>
            <el-button
              :disabled="!canGenerate"
              :icon="VideoPlay"
              :loading="isBusy"
              type="primary"
              @click="handleGenerate"
            >
              {{ generateButtonText }}
            </el-button>
          </div>
        </el-form>
      </div>
    </article>

    <aside class="surface-card section-card reveal-up video-result-panel" style="--delay: 0.1s">
      <div class="video-simple-head compact">
        <div>
          <h3>任务队列</h3>
          <p>{{ queueSummary }}</p>
        </div>
        <div class="queue-toolbar">
          <el-button :icon="Refresh" :loading="queueLoading" plain @click="loadRecentTasks()">刷新</el-button>
          <el-button :icon="Refresh" :loading="refreshingAll" plain @click="refreshRunningQueue()">刷新运行中</el-button>
        </div>
      </div>

      <div v-if="downloadableTasks.length" class="download-toolbar">
        <el-checkbox
          :indeterminate="isDownloadSelectionIndeterminate"
          :model-value="isAllDownloadableSelected"
          @change="toggleAllDownloadSelection"
        >
          已选 {{ selectedDownloadTasks.length }}/{{ downloadableTasks.length }}
        </el-checkbox>
        <el-button
          :disabled="!selectedDownloadTasks.length"
          :icon="Download"
          :loading="batchDownloading"
          plain
          @click="downloadSelectedVideos"
        >
          批量下载
        </el-button>
      </div>

      <div class="queue-preview">
        <div class="queue-preview-head">
          <strong>{{ task ? formatTaskTitle(task) : '未选择任务' }}</strong>
          <el-tag v-if="task" :type="getTaskStatusType(task.status)" effect="light" round>
            {{ getTaskStatusLabel(task.status) }}
          </el-tag>
        </div>

        <video v-if="task?.videoUrl" :src="task.videoUrl" class="video-player" controls />
      <el-alert
        v-else-if="visibleErrorMessage"
        :closable="false"
        :title="visibleErrorMessage"
        show-icon
        type="error"
      />
      <div v-else class="result-empty">
        {{ emptyResultText }}
      </div>

        <div class="result-actions">
          <el-button :disabled="!task" :icon="Refresh" :loading="refreshing" plain @click="refreshTask">
            刷新当前
          </el-button>
          <el-button
            :disabled="!task?.videoUrl"
            :icon="Download"
            :loading="downloadingCurrent"
            plain
            @click="downloadVideo"
          >
            下载
          </el-button>
          <el-button :disabled="!task?.videoUrl" :icon="LinkIcon" plain @click="copyVideoUrl">复制链接</el-button>
        </div>
      </div>

      <div v-if="recentTasks.length" class="task-list">
        <div
          v-for="item in recentTasks"
          :key="item.id"
          :class="['task-row', { active: task?.id === item.id }]"
          role="button"
          tabindex="0"
          @click="selectTask(item)"
          @keydown.enter.prevent="selectTask(item)"
          @keydown.space.prevent="selectTask(item)"
        >
          <el-checkbox
            class="task-row__check"
            :disabled="!isDownloadableTask(item)"
            :model-value="isDownloadSelected(item.id)"
            @change="handleTaskDownloadCheckboxChange(item, $event)"
            @click.stop
          />
          <span class="task-row__main">
            <strong>{{ formatTaskTitle(item) }}</strong>
            <span>{{ formatTaskTime(item.createdAt) }} · {{ item.duration }}s · {{ item.resolution }}</span>
            <em v-if="item.status === 'FAILED'">{{ formatTaskErrorMessage(item.errorMessage) }}</em>
          </span>
          <el-tag :type="getTaskStatusType(item.status)" effect="light" round size="small">
            {{ getTaskStatusLabel(item.status) }}
          </el-tag>
        </div>
      </div>
      <div v-else class="result-empty compact">
        暂无任务。
      </div>
    </aside>
  </section>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Delete,
  Download,
  Link as LinkIcon,
  Refresh,
  UploadFilled,
  VideoPlay,
} from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import {
  createSeedanceTask,
  getRecentVideoGenerationTasks,
  refreshRunningVideoGenerationTasks,
  refreshVideoGenerationTask,
  uploadVideoGenerationImage,
} from '@/api/videoGeneration'
import type {
  SeedanceContentItem,
  VideoGenerationTask,
  VideoGenerationTaskStatus,
} from '@/api/videoGeneration'

const DEFAULT_MODEL = 'doubao-seedance-1.5-pro'
const VIDEO_RATIO = '9:16'
const VIDEO_RESOLUTION = '720p'
const DEFAULT_VIDEO_DURATION = 12
const MAX_SOURCE_SIZE = 30 * 1024 * 1024
const MAX_UPLOAD_SIZE = 8 * 1024 * 1024
const TARGET_UPLOAD_SIZE = 7.5 * 1024 * 1024
const IMAGE_LOAD_TIMEOUT = 15000
const CANVAS_TIMEOUT = 12000
const MAX_BATCH_PROMPTS = 10
const MAX_STORYBOARD_SCENES = 20
const TASK_QUEUE_LIMIT = 30

type GenerationMode = 'single' | 'batch' | 'storyboard'

interface VideoModelOption {
  label: string
  shortLabel: string
  value: string
  description: string
  durations: number[]
  maxImages: number
  supportsTextToVideo: boolean
  supportsImageToVideo: boolean
}

interface StoryboardScene {
  id: number
  shotLabel: string
  timeRange: string
  sourceDuration: number | null
  duration: number
  durationNotice: string
  title: string
  visual: string
  subtitles: string
  narration: string
  rawText: string
  imageFile: File | null
  imagePreviewUrl: string
  imageInputKey: number
}

interface PendingGenerationItem {
  label: string
  text: string
  duration: number
  imageFile: File | null
}

const modelOptions = [
  {
    label: 'Doubao-Seedance-1.5-pro',
    shortLabel: 'Seedance 1.5 Pro',
    value: 'doubao-seedance-1.5-pro',
    description: '旧版兼容',
    durations: [4, 5, 6, 8, 10, 12],
    maxImages: 9,
    supportsTextToVideo: true,
    supportsImageToVideo: true,
  },
] satisfies VideoModelOption[]

const compressPlans = [
  { maxEdge: 1600, quality: 0.86 },
  { maxEdge: 1280, quality: 0.78 },
  { maxEdge: 1024, quality: 0.72 },
] as const

const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp']
const allowedExtensions = ['png', 'jpg', 'jpeg', 'webp']

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const previewUrl = ref('')
const noticeText = ref('')
const errorMessage = ref('')
const task = ref<VideoGenerationTask | null>(null)
const recentTasks = ref<VideoGenerationTask[]>([])
const selectedDownloadIds = ref<number[]>([])
const pollingTimer = ref<number | null>(null)
const stage = ref<'idle' | 'uploading' | 'creating' | 'running'>('idle')
const refreshing = ref(false)
const refreshingAll = ref(false)
const queueLoading = ref(false)
const downloadingCurrent = ref(false)
const batchDownloading = ref(false)
const creatingIndex = ref(0)
const creatingTotal = ref(0)
const storyboardScript = ref('')
const storyboardScenes = ref<StoryboardScene[]>([])
const sceneIdSeed = ref(1)

const form = reactive({
  mode: 'single' as GenerationMode,
  model: DEFAULT_MODEL,
  duration: DEFAULT_VIDEO_DURATION,
  generateAudio: true,
  prompt: '',
  batchPromptText: '',
})

const selectedModel = computed(() => modelOptions.find((model) => model.value === form.model))
const durationOptions = computed(() => selectedModel.value?.durations ?? [DEFAULT_VIDEO_DURATION])
const maxModelDuration = computed(() => Math.max(...durationOptions.value))
const minModelDuration = computed(() => Math.min(...durationOptions.value))
const modelDurationSummary = computed(() => {
  const durations = durationOptions.value.map((item) => `${item}秒`).join(' / ')
  return `当前模型支持：${durations}。超出范围会自动调整。`
})
const promptText = computed(() => form.prompt.trim())
const batchPromptItems = computed(() => parseBatchPrompts(form.batchPromptText))
const storyboardReadyScenes = computed(() => storyboardScenes.value.filter((scene) => Boolean(buildScenePrompt(scene))))
const promptItems = computed(() => {
  if (form.mode === 'storyboard') return storyboardReadyScenes.value.map(buildScenePrompt)
  if (form.mode === 'batch') return batchPromptItems.value
  return promptText.value ? [promptText.value] : []
})
const generationCount = computed(() => promptItems.value.length)
const hasTooManyBatchPrompts = computed(() => form.mode === 'batch' && batchPromptItems.value.length > MAX_BATCH_PROMPTS)
const hasTooManyStoryboardScenes = computed(() => form.mode === 'storyboard' && storyboardReadyScenes.value.length > MAX_STORYBOARD_SCENES)
const isBusy = computed(() => stage.value !== 'idle')
const canGenerate = computed(() =>
  Boolean(generationCount.value > 0 && !hasTooManyBatchPrompts.value && !hasTooManyStoryboardScenes.value && !isBusy.value)
)
const generateButtonText = computed(() => {
  if (form.mode === 'batch') return `批量生成 ${promptItems.value.length} 个任务`
  if (form.mode === 'storyboard') return `生成 ${storyboardReadyScenes.value.length} 个镜头`
  return `生成 ${form.duration} 秒视频`
})
const actionHint = computed(() => {
  if (stage.value === 'uploading') return '图片正在上传。'
  if (stage.value === 'creating') {
    if (creatingTotal.value > 1) return `正在创建第 ${creatingIndex.value} / ${creatingTotal.value} 个任务。`
    return '任务正在提交给模型。'
  }
  if (stage.value === 'running') return '任务已提交，右侧会自动刷新状态。'
  if (generationCount.value === 0) {
    return form.mode === 'storyboard' ? '先粘贴脚本并解析分镜。' : '填写提示词后即可生成。'
  }
  if (hasTooManyBatchPrompts.value) return `一次最多 ${MAX_BATCH_PROMPTS} 个任务。`
  if (hasTooManyStoryboardScenes.value) return `一次最多 ${MAX_STORYBOARD_SCENES} 个镜头。`
  if (form.mode !== 'storyboard' && !selectedFile.value) return '不上传图片会直接按提示词生成。'
  if (form.mode === 'storyboard') return '可生成全部镜头，也可以在镜头卡片里单独生成。'
  return '点击生成后才会上传图片。'
})
const durationWarningText = computed(() => {
  if (form.mode === 'storyboard') {
    const adjustedCount = storyboardScenes.value.filter((scene) => scene.durationNotice).length
    return adjustedCount ? `${adjustedCount} 个镜头的原始时长已按当前模型能力调整。` : ''
  }

  const warnings = promptItems.value
    .map((item) => createPromptDurationWarning(item, form.duration))
    .filter(Boolean)
  return warnings[0] || ''
})
const runningTaskCount = computed(() => recentTasks.value.filter((item) => !isTerminalTask(item)).length)
const queueSummary = computed(() => {
  if (!recentTasks.value.length) return '最近任务会显示在这里。'
  const succeeded = recentTasks.value.filter((item) => item.status === 'SUCCEEDED').length
  const failed = recentTasks.value.filter((item) => item.status === 'FAILED').length
  return `${recentTasks.value.length} 个最近任务 · ${runningTaskCount.value} 个生成中 · ${succeeded} 个完成 · ${failed} 个失败`
})
const downloadableTasks = computed(() => recentTasks.value.filter(isDownloadableTask))
const selectedDownloadTasks = computed(() => {
  const selectedIds = new Set(selectedDownloadIds.value)
  return downloadableTasks.value.filter((item) => selectedIds.has(item.id))
})
const isAllDownloadableSelected = computed(() => {
  return downloadableTasks.value.length > 0 && downloadableTasks.value.every((item) => selectedDownloadIds.value.includes(item.id))
})
const isDownloadSelectionIndeterminate = computed(() => {
  return selectedDownloadTasks.value.length > 0 && !isAllDownloadableSelected.value
})
const visibleErrorMessage = computed(() => {
  if (errorMessage.value) return errorMessage.value
  if (task.value?.status === 'FAILED') return formatTaskErrorMessage(task.value.errorMessage)
  return ''
})
const emptyResultText = computed(() => {
  if (!task.value) return '点击下方任务查看预览。'
  if (stage.value === 'running' || !isTerminalTask(task.value)) return '任务生成完成后这里会显示视频。'
  return '暂无视频。'
})

const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  errorMessage.value = ''
  noticeText.value = ''

  if (!isAllowedImageFile(file)) {
    clearNativeInput()
    ElMessage.warning('仅支持 PNG、JPG、WebP 图片')
    return
  }

  if (file.size > MAX_SOURCE_SIZE) {
    clearNativeInput()
    ElMessage.warning('图片不能超过 30MB')
    return
  }

  revokePreview()
  selectedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
  if (file.size > MAX_UPLOAD_SIZE) {
    noticeText.value = '这张图超过 8MB，生成前会自动压缩后再上传。'
  }
}

const handleGenerate = async () => {
  const items = createPendingGenerationItems()

  if (items.length === 0) {
    ElMessage.warning(form.mode === 'storyboard' ? '请先解析分镜并保留至少一个镜头' : '请填写视频提示词')
    return
  }
  if (form.mode === 'batch' && items.length > MAX_BATCH_PROMPTS) {
    ElMessage.warning(`一次最多生成 ${MAX_BATCH_PROMPTS} 个视频任务`)
    return
  }
  if (form.mode === 'storyboard' && items.length > MAX_STORYBOARD_SCENES) {
    ElMessage.warning(`一次最多生成 ${MAX_STORYBOARD_SCENES} 个镜头`)
    return
  }

  await submitGenerationItems(items)
}

const handleGenerateScene = async (scene: StoryboardScene) => {
  const text = buildScenePrompt(scene)
  if (!text) {
    ElMessage.warning('这个镜头还没有可生成的提示词')
    return
  }

  await submitGenerationItems([
    {
      label: scene.shotLabel || '当前镜头',
      text,
      duration: scene.duration,
      imageFile: scene.imageFile,
    },
  ])
}

const submitGenerationItems = async (items: PendingGenerationItem[]) => {
  stopPolling()
  errorMessage.value = ''
  setTask(null)
  creatingIndex.value = 0
  creatingTotal.value = items.length

  try {
    stage.value = 'creating'
    noticeText.value = '正在创建视频任务。'
    const createdTasks: VideoGenerationTask[] = []
    const failedMessages: string[] = []
    const uploadCache = new Map<File, string>()

    for (const [index, item] of items.entries()) {
      creatingIndex.value = index + 1

      try {
        let uploadedImageUrl = ''

        if (item.imageFile) {
          stage.value = 'uploading'
          noticeText.value = `${item.label}：${item.imageFile.size > MAX_UPLOAD_SIZE ? '正在压缩并上传图片。' : '正在上传图片。'}`
          uploadedImageUrl = await uploadImageForGeneration(item.imageFile, uploadCache)
        }

        stage.value = 'creating'
        noticeText.value = uploadedImageUrl
          ? `${item.label}：图片已上传，正在创建视频任务。`
          : `${item.label}：未上传图片，正在按提示词创建视频任务。`
        const content: SeedanceContentItem[] = [
          { type: 'text', text: item.text },
        ]
        if (uploadedImageUrl) {
          content.push({
            type: 'image_url',
            image_url: { url: uploadedImageUrl },
            role: 'first_frame',
          })
        }

        const result = await createSeedanceTask({
          model: form.model,
          content,
          generate_audio: form.generateAudio,
          ratio: VIDEO_RATIO,
          duration: normalizeDurationForModel(item.duration),
          watermark: false,
          resolution: VIDEO_RESOLUTION,
        })

        if (!result.localTask) {
          throw new Error('任务已提交，但后端没有返回本地任务记录')
        }

        createdTasks.push(result.localTask)
        mergeTaskIntoQueue(result.localTask)
      } catch (error) {
        failedMessages.push(formatTaskErrorMessage(error instanceof Error ? error.message : '视频任务创建失败'))
      }
    }

    await loadRecentTasks(false)
    if (createdTasks.length === 0) {
      throw new Error(failedMessages[0] || '视频任务创建失败')
    }

    noticeText.value = failedMessages.length
      ? `已提交 ${createdTasks.length} 个任务，${failedMessages.length} 个失败。`
      : `已提交 ${createdTasks.length} 个任务，系统会自动刷新状态。`
    if (failedMessages.length) {
      errorMessage.value = `部分任务创建失败：${failedMessages[0]}`
      ElMessage.warning(errorMessage.value)
    }
    if (createdTasks.some((item) => !isTerminalTask(item))) {
      stage.value = 'running'
      startPolling()
    } else {
      stage.value = 'idle'
    }
    ElMessage.success(createdTasks.length > 1 ? `已提交 ${createdTasks.length} 个视频任务` : '视频任务已提交')
  } catch (error) {
    stage.value = 'idle'
    errorMessage.value = formatTaskErrorMessage(error instanceof Error ? error.message : '视频生成失败')
    noticeText.value = ''
    ElMessage.error(errorMessage.value)
  } finally {
    creatingIndex.value = 0
    creatingTotal.value = 0
  }
}

const createPendingGenerationItems = (): PendingGenerationItem[] => {
  if (form.mode === 'storyboard') {
    return storyboardReadyScenes.value.map((scene) => ({
      label: scene.shotLabel || '分镜',
      text: buildScenePrompt(scene),
      duration: scene.duration,
      imageFile: scene.imageFile,
    }))
  }

  return promptItems.value.map((text, index) => ({
    label: form.mode === 'batch' ? `任务 ${index + 1}` : '当前任务',
    text,
    duration: form.duration,
    imageFile: selectedFile.value,
  }))
}

const uploadImageForGeneration = async (file: File, cache: Map<File, string>) => {
  const cachedUrl = cache.get(file)
  if (cachedUrl) return cachedUrl

  const uploadFile = await createUploadFile(file)
  if (uploadFile.size > MAX_UPLOAD_SIZE) {
    throw new Error('图片压缩后仍超过 8MB，请换一张更小的图片')
  }

  const uploaded = await uploadVideoGenerationImage(uploadFile)
  cache.set(file, uploaded.url)
  return uploaded.url
}

const parseStoryboard = () => {
  errorMessage.value = ''
  noticeText.value = ''
  clearStoryboardScenes()

  const scenes = parseStoryboardScript(storyboardScript.value)
  if (!scenes.length) {
    ElMessage.warning('没有识别到分镜，请确认脚本里包含“镜头 1｜0-10秒”这类格式')
    return
  }

  storyboardScenes.value = scenes
  const adjustedCount = scenes.filter((scene) => scene.durationNotice).length
  noticeText.value = adjustedCount
    ? `已解析 ${scenes.length} 个镜头，其中 ${adjustedCount} 个时长已按模型能力调整。`
    : `已解析 ${scenes.length} 个镜头。`
}

const parseStoryboardScript = (value: string) => {
  const normalizedText = value.replace(/\r\n/g, '\n').trim()
  if (!normalizedText) return []

  const lines = normalizedText.split('\n')
  const blocks: string[] = []
  let currentBlock: string[] = []

  lines.forEach((line) => {
    if (isStoryboardHeaderLine(line) && currentBlock.length) {
      blocks.push(currentBlock.join('\n').trim())
      currentBlock = [line]
      return
    }
    currentBlock.push(line)
  })

  if (currentBlock.length) blocks.push(currentBlock.join('\n').trim())

  return blocks
    .filter((block) => isStoryboardHeaderLine(block.split('\n')[0] || ''))
    .slice(0, MAX_STORYBOARD_SCENES)
    .map(createSceneFromBlock)
}

const isStoryboardHeaderLine = (line: string) => /镜头\s*[\d一二三四五六七八九十]+[^\n]*[｜|]/.test(line.trim())

const createSceneFromBlock = (block: string): StoryboardScene => {
  const lines = block.split('\n')
  const rawHeader = lines.shift()?.trim() || ''
  const header = rawHeader.slice(Math.max(0, rawHeader.search(/镜头/))).trim()
  const parts = header.split(/[｜|]/).map((item) => item.trim()).filter(Boolean)
  const shotLabel = parts[0] || `镜头 ${sceneIdSeed.value}`
  const timeRange = parts[1] || ''
  const title = parts.slice(2).join('｜')
  const body = lines.join('\n').trim()
  const sourceDuration = parseDurationFromTimeRange(timeRange)
  const duration = normalizeDurationForModel(sourceDuration ?? form.duration)
  const durationNotice = createDurationNotice(sourceDuration, duration)

  return {
    id: sceneIdSeed.value++,
    shotLabel,
    timeRange,
    sourceDuration,
    duration,
    durationNotice,
    title,
    visual: extractStoryboardSection(body, '画面提示词') || body,
    subtitles: extractStoryboardSection(body, '屏幕字幕'),
    narration: extractStoryboardSection(body, '旁白'),
    rawText: block,
    imageFile: null,
    imagePreviewUrl: '',
    imageInputKey: 0,
  }
}

const extractStoryboardSection = (body: string, label: string) => {
  const labels = ['画面提示词', '屏幕字幕', '旁白']
  const otherLabels = labels.filter((item) => item !== label).join('|')
  const pattern = new RegExp(`${label}\\s*[:：]?\\s*([\\s\\S]*?)(?=\\n\\s*(?:${otherLabels})\\s*[:：]|$)`)
  const match = body.match(pattern)
  return match?.[1]?.trim() || ''
}

const parseDurationFromTimeRange = (value: string) => {
  const rangeMatch = value.match(/(\d+(?:\.\d+)?)\s*(?:-|~|—|–|至|到)\s*(\d+(?:\.\d+)?)/)
  if (rangeMatch) {
    const start = Number(rangeMatch[1])
    const end = Number(rangeMatch[2])
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) return Math.round(end - start)
  }

  const singleMatch = value.match(/(\d+(?:\.\d+)?)\s*(?:秒|s)/i)
  if (!singleMatch) return null
  const duration = Number(singleMatch[1])
  return Number.isFinite(duration) ? Math.round(duration) : null
}

const normalizeDurationForModel = (duration: number) => {
  const sortedDurations = [...durationOptions.value].sort((first, second) => first - second)
  if (!sortedDurations.length) return DEFAULT_VIDEO_DURATION
  if (!Number.isFinite(duration)) return form.duration

  const roundedDuration = Math.max(1, Math.round(duration))
  return sortedDurations.find((item) => item >= roundedDuration) ?? sortedDurations[sortedDurations.length - 1]
}

const createDurationNotice = (sourceDuration: number | null, actualDuration: number) => {
  if (!sourceDuration || sourceDuration === actualDuration) return ''
  if (sourceDuration > maxModelDuration.value) {
    return `原脚本 ${sourceDuration} 秒，当前模型最多 ${maxModelDuration.value} 秒，已调整为 ${actualDuration} 秒。`
  }
  if (sourceDuration < minModelDuration.value) {
    return `原脚本 ${sourceDuration} 秒，当前模型最少 ${minModelDuration.value} 秒，已调整为 ${actualDuration} 秒。`
  }
  return `原脚本 ${sourceDuration} 秒，已匹配到模型支持的 ${actualDuration} 秒。`
}

const handleFormDurationChange = () => {
  form.duration = normalizeDurationForModel(form.duration)
}

const handleSceneDurationChange = (scene: StoryboardScene) => {
  scene.duration = normalizeDurationForModel(scene.duration)
  scene.durationNotice = createDurationNotice(scene.sourceDuration, scene.duration)
}

const buildScenePrompt = (scene: StoryboardScene) => {
  const sections = [
    `${scene.shotLabel}${scene.title ? `｜${scene.title}` : ''}`,
    scene.timeRange ? `原始时间段：${scene.timeRange}` : '',
    scene.visual ? `画面提示词：\n${scene.visual}` : '',
    scene.subtitles ? `屏幕字幕：\n${scene.subtitles}` : '',
    scene.narration ? `旁白：\n${scene.narration}` : '',
  ]

  return sections.filter(Boolean).join('\n\n').trim()
}

const createPromptDurationWarning = (text: string, actualDuration: number) => {
  const durations = extractDurationMentions(text)
  if (!durations.length) return ''
  const largestDuration = Math.max(...durations)
  if (largestDuration <= maxModelDuration.value && durationOptions.value.includes(largestDuration)) return ''
  if (largestDuration > maxModelDuration.value) {
    return `提示词里出现 ${largestDuration} 秒，当前模型最多支持 ${maxModelDuration.value} 秒，本次会按表单选择的 ${actualDuration} 秒提交。`
  }
  if (!durationOptions.value.includes(largestDuration)) {
    const normalizedDuration = normalizeDurationForModel(largestDuration)
    return `提示词里出现 ${largestDuration} 秒，当前模型不支持该精确时长；可用时长已按 ${normalizedDuration} 秒兜底。`
  }
  return ''
}

const extractDurationMentions = (text: string) => {
  const durations: number[] = []
  const matches = text.matchAll(/(\d+(?:\.\d+)?)\s*(?:秒|s)/gi)
  for (const match of matches) {
    const value = Number(match[1])
    if (Number.isFinite(value)) durations.push(Math.round(value))
  }
  return durations
}

const handleSceneFileChange = (scene: StoryboardScene, event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  errorMessage.value = ''
  noticeText.value = ''

  if (!isAllowedImageFile(file)) {
    input.value = ''
    ElMessage.warning('仅支持 PNG、JPG、WebP 图片')
    return
  }

  if (file.size > MAX_SOURCE_SIZE) {
    input.value = ''
    ElMessage.warning('图片不能超过 30MB')
    return
  }

  clearSceneImage(scene, false)
  scene.imageFile = file
  scene.imagePreviewUrl = URL.createObjectURL(file)
  if (file.size > MAX_UPLOAD_SIZE) {
    noticeText.value = `${scene.shotLabel} 的图片超过 8MB，生成前会自动压缩。`
  }
}

const clearSceneImage = (scene: StoryboardScene, resetInput = true) => {
  if (scene.imagePreviewUrl) {
    URL.revokeObjectURL(scene.imagePreviewUrl)
    scene.imagePreviewUrl = ''
  }
  scene.imageFile = null
  if (resetInput) scene.imageInputKey += 1
}

const clearStoryboardScenes = () => {
  storyboardScenes.value.forEach((scene) => clearSceneImage(scene, false))
  storyboardScenes.value = []
}

const refreshTask = async () => {
  if (!task.value) return
  refreshing.value = true
  try {
    const updatedTask = await refreshVideoGenerationTask(task.value.id)
    mergeTaskIntoQueue(updatedTask)
    setTask(updatedTask)
    if (isTerminalTask(updatedTask) && runningTaskCount.value === 0) stopPolling()
  } catch (error) {
    errorMessage.value = formatTaskErrorMessage(error instanceof Error ? error.message : '刷新失败')
    ElMessage.error(errorMessage.value)
  } finally {
    refreshing.value = false
  }
}

const loadRecentTasks = async (showLoading = true) => {
  if (showLoading) queueLoading.value = true
  errorMessage.value = ''
  try {
    const tasks = await getRecentVideoGenerationTasks(TASK_QUEUE_LIMIT)
    recentTasks.value = tasks
    pruneDownloadSelection()

    if (task.value) {
      const updatedSelectedTask = tasks.find((item) => item.id === task.value?.id)
      if (updatedSelectedTask) setTask(updatedSelectedTask)
    }

    if (tasks.some((item) => !isTerminalTask(item))) {
      startPolling()
    } else {
      stopPolling()
      if (stage.value === 'running') stage.value = 'idle'
    }
  } catch (error) {
    errorMessage.value = formatTaskErrorMessage(error instanceof Error ? error.message : '任务列表加载失败')
    ElMessage.error(errorMessage.value)
  } finally {
    if (showLoading) queueLoading.value = false
  }
}

const setTask = (value: VideoGenerationTask | null) => {
  task.value = value
}

const selectTask = (value: VideoGenerationTask) => {
  errorMessage.value = ''
  setTask(value)
}

const mergeTaskIntoQueue = (value: VideoGenerationTask) => {
  const next = recentTasks.value.filter((item) => item.id !== value.id)
  recentTasks.value = [value, ...next].slice(0, TASK_QUEUE_LIMIT)
  pruneDownloadSelection()
}

const isDownloadableTask = (value: VideoGenerationTask) => {
  return value.status === 'SUCCEEDED' && Boolean(value.videoUrl)
}

const isDownloadSelected = (id: number) => selectedDownloadIds.value.includes(id)

const handleTaskDownloadCheckboxChange = (value: VideoGenerationTask, checked: boolean | string | number) => {
  toggleTaskDownloadSelection(value, checked)
}

const toggleTaskDownloadSelection = (value: VideoGenerationTask, checked: boolean | string | number) => {
  if (!isDownloadableTask(value)) return
  const shouldSelect = Boolean(checked)
  if (shouldSelect && !selectedDownloadIds.value.includes(value.id)) {
    selectedDownloadIds.value = [...selectedDownloadIds.value, value.id]
    return
  }
  if (!shouldSelect) {
    selectedDownloadIds.value = selectedDownloadIds.value.filter((id) => id !== value.id)
  }
}

const toggleAllDownloadSelection = (checked: boolean | string | number) => {
  selectedDownloadIds.value = Boolean(checked) ? downloadableTasks.value.map((item) => item.id) : []
}

const pruneDownloadSelection = () => {
  const downloadableIds = new Set(recentTasks.value.filter(isDownloadableTask).map((item) => item.id))
  selectedDownloadIds.value = selectedDownloadIds.value.filter((id) => downloadableIds.has(id))
}

const refreshRunningQueue = async (showLoading = true) => {
  if (showLoading) refreshingAll.value = true
  errorMessage.value = ''
  try {
    const updatedTasks = await refreshRunningVideoGenerationTasks()
    updatedTasks.forEach(mergeTaskIntoQueue)
    await loadRecentTasks(false)
  } catch (error) {
    errorMessage.value = formatTaskErrorMessage(error instanceof Error ? error.message : '运行中任务刷新失败')
    ElMessage.error(errorMessage.value)
  } finally {
    if (showLoading) refreshingAll.value = false
  }
}

const startPolling = () => {
  stopPolling()
  pollingTimer.value = window.setInterval(() => {
    void refreshRunningQueue(false)
  }, 8000)
}

const stopPolling = () => {
  if (pollingTimer.value === null) return
  window.clearInterval(pollingTimer.value)
  pollingTimer.value = null
}

const clearImage = () => {
  selectedFile.value = null
  noticeText.value = ''
  errorMessage.value = ''
  revokePreview()
  clearNativeInput()
}

const clearNativeInput = () => {
  if (fileInputRef.value) fileInputRef.value.value = ''
}

const revokePreview = () => {
  if (!previewUrl.value) return
  URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}

const getExtension = (file: File) => file.name.split('.').pop()?.toLowerCase() || ''

const parseBatchPrompts = (value: string) =>
  value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)

const isAllowedImageFile = (file: File) => {
  const mimeType = file.type.toLowerCase()
  return allowedMimeTypes.includes(mimeType) || mimeType === 'image/jpg' || allowedExtensions.includes(getExtension(file))
}

const createUploadFile = async (file: File) => {
  if (file.size <= TARGET_UPLOAD_SIZE && allowedMimeTypes.includes(file.type.toLowerCase())) {
    return file
  }

  const image = await loadImage(file)
  let fallbackBlob: Blob | null = null

  for (const plan of compressPlans) {
    const blob = await renderCompressedBlob(image, plan.maxEdge, plan.quality)
    if (!blob) continue
    fallbackBlob = blob
    if (blob.size <= TARGET_UPLOAD_SIZE) break
  }

  if (!fallbackBlob) return file

  const name = file.name.replace(/\.[^.]+$/, '') || 'video-image'
  return new File([fallbackBlob], `${name}.jpg`, { type: 'image/jpeg' })
}

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    const timeout = window.setTimeout(() => {
      URL.revokeObjectURL(url)
      reject(new Error('图片读取超时，请换一张 JPG/PNG/WebP 图片'))
    }, IMAGE_LOAD_TIMEOUT)

    image.onload = () => {
      window.clearTimeout(timeout)
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      window.clearTimeout(timeout)
      URL.revokeObjectURL(url)
      reject(new Error('图片读取失败，请确认文件是 PNG、JPG 或 WebP 格式'))
    }
    image.src = url
  })

const renderCompressedBlob = async (image: HTMLImageElement, maxEdge: number, quality: number) => {
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) return null
  context.drawImage(image, 0, 0, width, height)

  return new Promise<Blob | null>((resolve) => {
    const timeout = window.setTimeout(() => resolve(null), CANVAS_TIMEOUT)
    canvas.toBlob((result) => {
      window.clearTimeout(timeout)
      resolve(result)
    }, 'image/jpeg', quality)
  })
}

const isTerminalTask = (value: VideoGenerationTask) =>
  ['SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(value.status)

const formatTaskErrorMessage = (message: string) => {
  const value = message.trim()
  if (!value) return '视频生成失败'

  const lowerValue = value.toLowerCase()
  const requestId = extractRequestId(value)
  const appendRequestId = (text: string) => (requestId ? `${text} Request id: ${requestId}` : text)

  if (value.includes('HTTP 413') || lowerValue.includes('request entity too large')) {
    return '上传内容过大：请换一张更小的图片，或把提示词/分镜拆成更少的任务后重试。'
  }

  if (lowerValue.includes('duration') && lowerValue.includes('not valid')) {
    return appendRequestId(`当前模型不支持这个视频时长，请选择 ${durationOptions.value.join(' / ')} 秒后重试。`)
  }

  if (
    lowerValue.includes('generate_audio') ||
    lowerValue.includes('audio') ||
    lowerValue.includes('voice') ||
    value.includes('声音') ||
    value.includes('音频')
  ) {
    return appendRequestId('模型声音生成失败：当前模型可能不支持这个音频参数，或声音内容被限制。可以先关闭“生成声音”再重试。')
  }

  if (value.includes('ARK_VIDEO_API_KEY') || value.includes('ARK_AGENT_PLAN_API_KEY') || value.includes('ARK_API_KEY')) {
    return '后端视频模型 Key 未配置或未生效，请检查服务器环境变量后重启后端服务。'
  }

  if (lowerValue.includes('unauthorized') || lowerValue.includes('forbidden') || lowerValue.includes('permission')) {
    return appendRequestId('模型服务鉴权失败或当前账号没有该模型权限，请检查 Agent Plan API Key 和模型权限。')
  }

  if (lowerValue.includes('quota') || lowerValue.includes('insufficient') || value.includes('额度') || value.includes('余额')) {
    return appendRequestId('模型额度不足或计费受限，请检查 Agent Plan 套餐额度、超额后付费或账户余额。')
  }

  if (lowerValue.includes('timeout') || value.includes('超时')) {
    return appendRequestId('模型响应超时：任务可能较复杂，请稍后重试，或减少分镜数量、缩短提示词。')
  }

  if (value.includes('copyright restrictions') || value.includes('OutputVideoSensitiveContentDetected')) {
    return appendRequestId('视频生成失败：输出内容可能触发版权或内容安全限制，请换一张图片或把动作提示写得更通用。')
  }

  if (lowerValue.includes('real person')) {
    return appendRequestId('视频生成失败：输入图片可能包含真实人物，模型拒绝处理。可以改用不含真人的产品图，或不上传图片直接文生视频。')
  }

  if (lowerValue.includes('sensitive') || lowerValue.includes('safety') || value.includes('敏感')) {
    return appendRequestId('视频生成失败：内容可能触发安全策略，请调整图片或把提示词写得更中性。')
  }

  if (lowerValue.includes('failed to fetch') || value.includes('NetworkError')) {
    return '请求后端失败：请检查网络、后端服务或 nginx /api 代理。'
  }

  return value
}

const extractRequestId = (message: string) =>
  message.match(/Request id:\s*([^\s]+)/i)?.[1] || message.match(/request_id["':\s]+([A-Za-z0-9_-]+)/i)?.[1] || ''

const getTaskStatusLabel = (status: VideoGenerationTaskStatus) => {
  const map: Record<VideoGenerationTaskStatus, string> = {
    CREATED: '已创建',
    QUEUED: '排队中',
    RUNNING: '生成中',
    SUCCEEDED: '已完成',
    FAILED: '失败',
    CANCELLED: '已取消',
    EXPIRED: '已过期',
  }
  return map[status] || status
}

const getTaskStatusType = (status: VideoGenerationTaskStatus) => {
  if (status === 'SUCCEEDED') return 'success'
  if (status === 'FAILED' || status === 'CANCELLED' || status === 'EXPIRED') return 'danger'
  if (status === 'RUNNING' || status === 'QUEUED') return 'warning'
  return 'info'
}

const formatTaskTitle = (value: VideoGenerationTask) => {
  const text = value.promptText.trim() || value.providerTaskId
  return text.length > 34 ? `${text.slice(0, 34)}...` : text
}

const formatTaskTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

const formatFileSize = (size: number) => {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}MB`
  return `${Math.max(1, Math.round(size / 1024))}KB`
}

const downloadVideo = async () => {
  if (!task.value?.videoUrl || downloadingCurrent.value) return
  downloadingCurrent.value = true
  try {
    await downloadVideoFile(task.value.videoUrl, createVideoFileName(task.value, 1))
    ElMessage.success('已开始下载视频')
  } catch {
    ElMessage.error('下载失败，请复制链接后重试')
  } finally {
    downloadingCurrent.value = false
  }
}

const downloadSelectedVideos = async () => {
  if (!selectedDownloadTasks.value.length || batchDownloading.value) return
  batchDownloading.value = true
  const usedNames = new Map<string, number>()
  const tasks = sortTasksForBatchDownload(selectedDownloadTasks.value)

  try {
    for (const [index, item] of tasks.entries()) {
      if (!item.videoUrl) continue
      const fileName = createUniqueFileName(createVideoFileName(item, index + 1), usedNames)
      noticeText.value = `正在下载第 ${index + 1} / ${tasks.length} 个视频：${fileName}`
      await downloadVideoFile(item.videoUrl, fileName)
      await sleep(450)
    }
    noticeText.value = `已触发 ${tasks.length} 个视频下载。`
    ElMessage.success(`已开始下载 ${tasks.length} 个视频`)
  } catch {
    ElMessage.error('批量下载中断，请稍后重试')
  } finally {
    batchDownloading.value = false
  }
}

const downloadVideoFile = async (url: string, fileName: string) => {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    triggerDownload(objectUrl, fileName)
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
    return
  } catch {
    triggerDownload(url, fileName)
  }
}

const triggerDownload = (url: string, fileName: string) => {
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
}

const createVideoFileName = (value: VideoGenerationTask, fallbackIndex: number) => {
  const index = extractTaskSceneIndex(value) ?? fallbackIndex
  return `分镜头${padDownloadIndex(index)}.mp4`
}

const sortTasksForBatchDownload = (tasks: VideoGenerationTask[]) => {
  const originalOrder = new Map(tasks.map((item, index) => [item.id, index]))
  return [...tasks].sort((first, second) => {
    const firstSceneIndex = extractTaskSceneIndex(first)
    const secondSceneIndex = extractTaskSceneIndex(second)
    if (firstSceneIndex !== null && secondSceneIndex !== null && firstSceneIndex !== secondSceneIndex) {
      return firstSceneIndex - secondSceneIndex
    }
    if (firstSceneIndex !== null && secondSceneIndex === null) return -1
    if (firstSceneIndex === null && secondSceneIndex !== null) return 1
    return (originalOrder.get(first.id) ?? 0) - (originalOrder.get(second.id) ?? 0)
  })
}

const createUniqueFileName = (fileName: string, usedNames: Map<string, number>) => {
  const count = usedNames.get(fileName) ?? 0
  usedNames.set(fileName, count + 1)
  if (count === 0) return fileName
  return fileName.replace(/\.mp4$/i, `-${count + 1}.mp4`)
}

const extractTaskSceneIndex = (value: VideoGenerationTask) => {
  const match = value.promptText.match(/镜头\s*([0-9]+|[一二两三四五六七八九十]+)/)
  if (!match) return null
  const rawIndex = match[1]
  if (/^\d+$/.test(rawIndex)) return Number(rawIndex)
  return parseChineseSceneIndex(rawIndex)
}

const parseChineseSceneIndex = (value: string) => {
  const digits: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  }
  if (value === '十') return 10
  if (value.includes('十')) {
    const [tens, ones] = value.split('十')
    const tenValue = tens ? digits[tens] : 1
    const oneValue = ones ? digits[ones] : 0
    if (!tenValue && !oneValue) return null
    return tenValue * 10 + oneValue
  }
  return digits[value] ?? null
}

const padDownloadIndex = (value: number) => String(Math.max(1, value)).padStart(2, '0')

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const copyVideoUrl = async () => {
  if (!task.value?.videoUrl) return
  try {
    await navigator.clipboard.writeText(task.value.videoUrl)
    ElMessage.success('视频链接已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

watch(
  () => form.model,
  () => {
    form.duration = normalizeDurationForModel(form.duration)
    storyboardScenes.value.forEach((scene) => {
      scene.duration = normalizeDurationForModel(scene.duration)
      scene.durationNotice = createDurationNotice(scene.sourceDuration, scene.duration)
    })
  }
)

watch(
  () => form.mode,
  () => {
    errorMessage.value = ''
    noticeText.value = ''
    setTask(null)
  }
)

onMounted(() => {
  void loadRecentTasks()
})

onBeforeUnmount(() => {
  stopPolling()
  revokePreview()
  clearStoryboardScenes()
})
</script>

<style scoped>
.video-simple-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(360px, 0.65fr);
  gap: 18px;
  align-items: start;
}

.video-simple-panel,
.video-result-panel {
  min-width: 0;
}

.video-simple-head,
.video-actions,
.result-actions {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.video-simple-head {
  margin-bottom: 18px;
}

.video-simple-head.compact {
  align-items: center;
}

.video-simple-head h3 {
  margin: 0;
  color: var(--brand-ink);
  font-size: 17px;
}

.video-simple-head p,
.video-actions span,
.file-meta,
.video-notice {
  margin: 5px 0 0;
  color: var(--brand-muted);
  font-size: 12px;
  line-height: 1.6;
}

.video-specs,
.queue-toolbar,
.result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.video-form-grid {
  display: grid;
  grid-template-columns: minmax(300px, 0.45fr) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.video-form-grid.is-storyboard {
  grid-template-columns: minmax(300px, 0.42fr) minmax(0, 1fr);
}

.image-field,
.prompt-form,
.storyboard-import {
  min-width: 0;
}

.field-label {
  display: block;
  margin-bottom: 8px;
  color: var(--brand-ink);
  font-size: 13px;
  font-weight: 700;
}

.native-file-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.native-file-input {
  width: 100%;
  min-width: 0;
  padding: 7px 10px;
  border: 1px solid rgba(216, 178, 180, 0.38);
  border-radius: 8px;
  background: #fff;
  color: var(--brand-ink);
  font-size: 13px;
}

.image-preview {
  display: flex;
  width: 100%;
  min-height: 260px;
  align-items: center;
  justify-content: center;
  margin-top: 12px;
  overflow: hidden;
  border: 1px dashed rgba(217, 107, 114, 0.42);
  border-radius: 8px;
  background: rgba(255, 247, 246, 0.72);
}

.image-preview img {
  display: block;
  width: 100%;
  max-height: 360px;
  object-fit: contain;
  background: #fff;
}

.image-empty {
  display: grid;
  gap: 9px;
  justify-items: center;
  padding: 28px;
  text-align: center;
}

.image-empty .el-icon {
  color: var(--brand-primary);
  font-size: 30px;
}

.image-empty strong {
  color: var(--brand-ink);
  font-size: 14px;
}

.image-empty span {
  max-width: 220px;
  color: var(--brand-muted);
  font-size: 12px;
  line-height: 1.65;
}

.file-meta {
  min-height: 20px;
  word-break: break-all;
}

.prompt-form :deep(.el-form-item) {
  margin-bottom: 14px;
}

.prompt-form :deep(.el-select) {
  width: 100%;
}

.form-help {
  margin-top: 6px;
  color: var(--brand-muted);
  font-size: 12px;
  line-height: 1.5;
}

.audio-switch-row {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--brand-muted);
  font-size: 12px;
  line-height: 1.5;
}

.select-option-meta {
  float: right;
  color: var(--brand-muted);
  font-size: 12px;
  font-style: normal;
}

.video-notice {
  padding: 9px 11px;
  margin: 0 0 12px;
  border: 1px solid rgba(234, 179, 8, 0.26);
  border-radius: 8px;
  background: rgba(255, 247, 237, 0.78);
  color: #9a5c00;
}

.video-warning {
  padding: 9px 11px;
  margin: 0 0 12px;
  border: 1px solid rgba(217, 107, 114, 0.22);
  border-radius: 8px;
  background: rgba(255, 241, 241, 0.72);
  color: #9a4a50;
  font-size: 12px;
  line-height: 1.55;
}

.storyboard-import__head,
.storyboard-scene__head,
.storyboard-scene__actions,
.scene-image-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.storyboard-import__head {
  margin-bottom: 8px;
}

.storyboard-empty {
  display: grid;
  min-height: 160px;
  place-items: center;
  padding: 18px;
  border: 1px dashed rgba(217, 107, 114, 0.34);
  border-radius: 8px;
  background: rgba(255, 247, 246, 0.64);
  color: var(--brand-muted);
  font-size: 13px;
  text-align: center;
}

.storyboard-scenes {
  display: grid;
  max-height: 680px;
  gap: 12px;
  overflow: auto;
  padding-right: 4px;
}

.storyboard-scene {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(216, 178, 180, 0.34);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
}

.storyboard-scene__head {
  align-items: flex-start;
}

.storyboard-scene__head strong,
.storyboard-scene__head span {
  display: block;
  min-width: 0;
  line-height: 1.45;
}

.storyboard-scene__head strong {
  color: var(--brand-ink);
  font-size: 13px;
}

.storyboard-scene__head span {
  color: var(--brand-muted);
  font-size: 12px;
}

.storyboard-scene__actions {
  flex: 0 0 auto;
}

.scene-duration-select {
  width: 100px;
}

.scene-notice {
  padding: 7px 9px;
  border: 1px solid rgba(234, 179, 8, 0.24);
  border-radius: 8px;
  background: rgba(255, 247, 237, 0.72);
  color: #9a5c00;
  font-size: 12px;
  line-height: 1.45;
}

.scene-image-row {
  align-items: stretch;
}

.scene-image-preview {
  width: 96px;
  height: 128px;
  overflow: hidden;
  border: 1px solid rgba(216, 178, 180, 0.32);
  border-radius: 8px;
  background: #fff;
}

.scene-image-preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-actions {
  align-items: center;
  padding-top: 4px;
}

.video-player {
  display: block;
  width: 100%;
  max-height: 430px;
  border-radius: 8px;
  background: #111;
}

.queue-preview {
  display: grid;
  gap: 12px;
}

.download-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: -2px 0 14px;
  padding: 9px 10px;
  border: 1px solid rgba(216, 178, 180, 0.34);
  border-radius: 8px;
  background: rgba(255, 247, 246, 0.72);
}

.queue-preview-head {
  display: flex;
  min-height: 30px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.queue-preview-head strong {
  min-width: 0;
  color: var(--brand-ink);
  font-size: 13px;
  line-height: 1.45;
}

.result-empty {
  display: grid;
  min-height: 260px;
  place-items: center;
  padding: 18px;
  border: 1px solid rgba(216, 178, 180, 0.32);
  border-radius: 8px;
  background: rgba(255, 247, 246, 0.64);
  color: var(--brand-muted);
  font-size: 13px;
  text-align: center;
}

.result-empty.compact {
  min-height: 132px;
  margin-top: 14px;
}

.result-actions {
  justify-content: flex-start;
}

.task-list {
  display: grid;
  max-height: 520px;
  gap: 8px;
  margin-top: 16px;
  overflow: auto;
  padding-right: 4px;
}

.task-row {
  display: grid;
  width: 100%;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  padding: 10px 11px;
  border: 1px solid rgba(216, 178, 180, 0.34);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.task-row__check {
  margin-top: 1px;
}

.task-row:hover,
.task-row.active {
  border-color: rgba(217, 107, 114, 0.52);
  background: rgba(255, 241, 241, 0.72);
  box-shadow: 0 10px 22px rgba(154, 73, 79, 0.08);
}

.task-row__main {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.task-row__main strong {
  overflow: hidden;
  color: var(--brand-ink);
  font-size: 13px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-row__main span,
.task-row__main em {
  overflow: hidden;
  color: var(--brand-muted);
  font-size: 12px;
  font-style: normal;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-row__main em {
  color: #b42318;
}

@media (max-width: 1180px) {
  .video-simple-grid,
  .video-form-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .video-simple-head,
  .video-actions,
  .result-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .video-specs,
  .queue-toolbar,
  .result-actions {
    justify-content: flex-start;
  }

  .native-file-row {
    grid-template-columns: 1fr;
  }

  .audio-switch-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .storyboard-scene__head,
  .storyboard-scene__actions,
  .scene-image-row {
    align-items: stretch;
    flex-direction: column;
  }

  .scene-duration-select {
    width: 100%;
  }
}
</style>
