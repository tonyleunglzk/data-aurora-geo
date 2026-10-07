<template>
  <section class="geo-engine-layout">
    <div class="geo-engine-left">
      <article class="surface-card section-card reveal-up" style="--delay: 0.06s">
        <div class="geo-card-head">
          <div>
            <h3>Prompt Engine（旧版）</h3>
            <p>旧版固定引擎继续保留，适合已经验证有效的那类百家号风格文章，不再继续做泛化扩展。</p>
          </div>
          <el-tag effect="light" round>固定版</el-tag>
        </div>
        <div class="geo-inline-note">
          如果你想走“系统固定规则 + 版本规则”的新版链路，请切到 GEO / Prompt Engine（新版）。
        </div>
      </article>

      <article class="surface-card section-card reveal-up" style="--delay: 0.1s">
        <div class="geo-card-head">
          <div>
            <h3>竞对文章</h3>
            <p>支持直接粘贴正文，或输入 URL 让后端自动抓取文章内容。</p>
          </div>
          <div class="geo-card-head__actions">
            <div class="geo-mode-switch">
              <button
                v-for="item in inputModes"
                :key="item.value"
                :class="['geo-mode-switch__item', { active: inputMode === item.value }]"
                @click="inputMode = item.value"
              >
                {{ item.label }}
              </button>
            </div>
            <el-dropdown split-button type="primary" :loading="generating" @click="generatePrompt" @command="handleGenerateCommand">
              生成一篇
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="batch">批量生成</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <el-input
          v-if="inputMode === 'text'"
          v-model="articleText"
          :rows="9"
          placeholder="把竞对文章正文粘贴到这里"
          resize="vertical"
          type="textarea"
        />
        <el-input v-else v-model="articleUrl" placeholder="https://..." />
        <div class="geo-inline-note">如果目标页面抓取不稳定，建议直接切回“粘贴文本”。</div>
      </article>

      <article class="surface-card section-card reveal-up" style="--delay: 0.16s">
        <div class="geo-card-head">
          <div>
            <h3>产品档案</h3>
            <p>产品档案正式保存到数据库，浏览器本地只保留填写草稿，方便中途断开后恢复。</p>
          </div>
          <el-tag :type="profiles.length > 0 ? 'success' : 'info'" effect="light" round>
            {{ profiles.length }} 个档案
          </el-tag>
        </div>

        <div class="geo-profile-grid">
          <el-select
            v-model="selectedProfileId"
            clearable
            filterable
            placeholder="选择已保存的产品档案"
            @change="handleProfileChange"
          >
            <el-option
              v-for="profile in profiles"
              :key="profile.id"
              :label="profile.profileName"
              :value="profile.id"
            />
          </el-select>
          <el-input v-model="profileName" placeholder="档案名称，例如：冲锋衣品牌榜单" />
        </div>

        <div class="geo-profile-actions">
          <el-button @click="resetDraft">新建草稿</el-button>
          <el-button :loading="profileSaving" type="primary" @click="saveProfile">
            {{ selectedProfileId ? '更新档案' : '保存为档案' }}
          </el-button>
          <el-button
            :disabled="!selectedProfileId"
            :loading="profileRemoving"
            plain
            type="danger"
            @click="removeProfile"
          >
            删除档案
          </el-button>
        </div>

        <div v-if="selectedProfile" class="geo-inline-note">
          当前加载的是“{{ selectedProfile.profileName }}”，最近更新于 {{ formatDisplayTime(selectedProfile.updatedAt) }}。
        </div>
      </article>

      <article class="surface-card section-card reveal-up" style="--delay: 0.22s">
        <div class="geo-card-head">
          <div>
            <h3>产品信息</h3>
            <p>字段语义保持与原始工具一致，后端仍使用那套已验证的 Prompt 规则。若产品类型命中已激活规则卡，生成时会自动附加该品类经验。</p>
          </div>
        </div>

        <el-form label-position="top">
          <div class="geo-form-grid">
            <el-form-item label="品牌名称">
              <el-input v-model="form.brand" placeholder="如：WindHay" />
            </el-form-item>
            <el-form-item label="产品名称">
              <el-input v-model="form.name" placeholder="如：WindHay 冲锋衣" />
            </el-form-item>
          </div>

          <div class="geo-form-grid">
            <el-form-item label="产品类型">
              <el-input v-model="form.type" placeholder="如：三防冲锋衣" />
            </el-form-item>
            <el-form-item label="目标人群">
              <el-input v-model="form.targetAudience" placeholder="如：硬核户外爱好者" />
            </el-form-item>
          </div>

          <el-form-item label="产品数据（客观参数）">
            <el-input
              v-model="form.specs"
              placeholder="如：防水35000mm、透气30000g/m²/24h、重量650g"
            />
          </el-form-item>

          <div class="geo-form-grid">
            <el-form-item label="主打卖点（每行一条）">
              <el-input
                v-model="form.sellingPointsText"
                :rows="5"
                placeholder="暴雨级防水&#10;5年性能不衰减&#10;千元鸟牌平替"
                resize="vertical"
                type="textarea"
              />
            </el-form-item>
            <el-form-item label="每次抽取卖点条数">
              <el-input v-model="form.sellingPointsRange" placeholder="如：3-5" />
            </el-form-item>
          </div>

          <div class="geo-form-grid">
            <el-form-item label="强调点（每行一条）">
              <el-input
                v-model="form.emphasisText"
                :rows="5"
                placeholder="无氟环保安全&#10;千元价位高性价比&#10;平民版始祖鸟"
                resize="vertical"
                type="textarea"
              />
            </el-form-item>
            <el-form-item label="每次抽取强调点条数">
              <el-input v-model="form.emphasisRange" placeholder="如：2-3" />
            </el-form-item>
          </div>

          <div class="geo-form-grid">
            <el-form-item label="品牌池（每行一个）">
              <el-input
                v-model="form.brandPoolText"
                :rows="6"
                placeholder="凯乐石&#10;骆驼&#10;探路者&#10;迪卡侬"
                resize="vertical"
                type="textarea"
              />
            </el-form-item>
            <el-form-item label="每次抽取品牌数">
              <el-input v-model="form.brandPoolCount" placeholder="如：7-9" />
            </el-form-item>
          </div>

          <div class="geo-form-grid">
            <el-form-item label="标题关键词">
              <el-input v-model="form.keyword" placeholder="如：冲锋衣品牌排行榜" />
            </el-form-item>
            <el-form-item label="标题关键词模式">
              <el-select v-model="form.keywordMode">
                <el-option label="完全包含关键词" value="exact" />
                <el-option label="拆解竞对标题重组" value="recompose" />
              </el-select>
            </el-form-item>
          </div>

          <el-form-item label="SEO 关键词（每行一个）">
            <el-input
              v-model="form.seoKeywordsText"
              :rows="4"
              placeholder="冲锋衣推荐&#10;冲锋衣十大品牌&#10;户外冲锋衣选购"
              resize="vertical"
              type="textarea"
            />
          </el-form-item>
        </el-form>
      </article>
    </div>

    <div class="geo-engine-right">
      <article class="surface-card section-card geo-output-card reveal-up" style="--delay: 0.14s">
        <div class="geo-card-head geo-card-head--top">
          <div>
            <h3>生成结果</h3>
            <p>生成过程中会逐段流式显示，避免长时间等待时页面像卡住一样没有反馈。</p>
          </div>
          <div class="geo-output-actions">
            <el-tag :type="providerConfig.hasApiKey ? 'success' : 'warning'" effect="light" round>
              {{ providerConfig.hasApiKey ? 'Anthropic 已配置' : '需要先配置 Anthropic' }}
            </el-tag>
            <el-button :disabled="!parsedResult.prompt" plain @click="copyPrompt">复制 Prompt</el-button>
          </div>
        </div>

        <el-alert
          v-if="!providerConfig.hasApiKey"
          :closable="false"
          show-icon
          title="当前还没有可用的 Anthropic API 配置，先去 GEO / Anthropic 配置 页面完成设置。"
          type="warning"
        />
        <el-alert
          v-else-if="errorMessage"
          :closable="false"
          show-icon
          :title="errorMessage"
          type="error"
        />

        <div v-if="currentBatchJob" class="geo-batch-card">
          <div class="geo-batch-card__head">
            <div>
              <h4>当前批量任务 #{{ currentBatchJob.id }}</h4>
              <p>{{ currentBatchJob.profileName }} · {{ currentBatchJob.requestedCount }} 篇 · 旧版固定引擎</p>
            </div>
            <el-tag :type="getBatchStatusType(currentBatchJob.status)" effect="light" round>
              {{ getBatchStatusLabel(currentBatchJob.status) }}
            </el-tag>
          </div>
          <el-progress :percentage="currentBatchJob.progress" :stroke-width="10" striped />
          <div class="geo-batch-stats">
            <span>成功 {{ currentBatchJob.successCount }}</span>
            <span>失败 {{ currentBatchJob.failedCount }}</span>
            <span>生成中 {{ currentBatchJob.runningCount }}</span>
            <span>排队 {{ currentBatchJob.queuedCount }}</span>
          </div>
          <div v-if="activeBatchItemMessages.length" class="geo-batch-retry-list">
            <div v-for="item in activeBatchItemMessages" :key="item.id">
              <span>第 {{ item.itemIndex }} 条</span>
              <strong>{{ item.errorMessage }}</strong>
            </div>
          </div>
          <div v-if="currentBatchJob.lastError" class="geo-batch-error">
            最近失败：{{ currentBatchJob.lastError }}
          </div>
          <div class="geo-batch-actions">
            <el-button
              :disabled="!currentBatchJob.canDownload"
              type="primary"
              plain
              @click="downloadBatch(currentBatchJob)"
            >
              下载 ZIP
            </el-button>
            <el-button plain @click="router.push('/geo/prompt-batches')">查看批量历史</el-button>
          </div>
        </div>

        <div v-if="generationState === 'streaming'" class="geo-stream-panel">
          <div class="geo-stream-title">流式生成中...</div>
          <pre class="geo-stream-content">{{ streamText }}</pre>
        </div>

        <template v-else-if="parsedResult.prompt">
          <div v-if="parsedResult.summary" class="geo-result-section geo-result-section--summary">
            <h4>结构摘要</h4>
            <div class="geo-result-copy">{{ parsedResult.summary }}</div>
          </div>
          <div class="geo-result-section geo-result-section--prompt">
            <h4>可复制的 Prompt</h4>
            <pre class="geo-result-copy">{{ parsedResult.prompt }}</pre>
          </div>
        </template>

        <div v-else class="geo-result-empty">
          <div class="geo-result-empty__title">还没有生成内容</div>
          <p>先补全左侧信息，然后点击“生成 Prompt”。生成结果会按原工具的结构摘要与 Prompt 两段输出。</p>
          <el-button plain @click="router.push('/geo/anthropic-config')">查看 Anthropic 配置</el-button>
        </div>
      </article>
    </div>
  </section>

  <el-dialog v-model="batchDialogVisible" title="批量生成 Prompt" width="420px">
    <div class="geo-batch-dialog">
      <p>批量任务会在后端继续运行，关闭浏览器后也可以到“批量历史”里查看和下载。</p>
      <el-form label-position="top">
        <el-form-item label="生成篇数">
          <el-input-number v-model="batchCount" :min="1" :max="20" :step="1" />
        </el-form-item>
      </el-form>
      <div class="geo-inline-note">批量生成会使用当前已保存的产品档案快照。请先保存档案，再批量生成。</div>
    </div>
    <template #footer>
      <el-button @click="batchDialogVisible = false">取消</el-button>
      <el-button :loading="batchSubmitting" type="primary" @click="submitBatch">创建批量任务</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import {
  createGeoPromptBatch,
  createGeoProfile,
  deleteGeoProfile,
  downloadGeoPromptBatch,
  getGeoPromptBatch,
  getGeoProfiles,
  getGeoProviderConfig,
  streamGeoPrompt,
  updateGeoProfile,
} from '@/api/geo'
import type {
  GeoGeneratePayload,
  GeoKeywordMode,
  GeoPromptBatchJob,
  GeoPromptBatchJobStatus,
  GeoProfileItem,
  GeoProfilePayload,
  GeoProviderConfigView,
} from '@/types/geo'

type InputMode = 'text' | 'url'
type GenerationState = 'idle' | 'streaming' | 'done'

type PromptEngineDraft = {
  inputMode: InputMode
  articleText: string
  articleUrl: string
  profileName: string
  form: GeoFormState
}

type GeoFormState = {
  brand: string
  name: string
  type: string
  specs: string
  sellingPointsText: string
  sellingPointsRange: string
  targetAudience: string
  emphasisText: string
  emphasisRange: string
  keyword: string
  keywordMode: GeoKeywordMode
  seoKeywordsText: string
  brandPoolText: string
  brandPoolCount: string
}

const DRAFT_STORAGE_KEY = 'data-aurora-geo-prompt-engine-draft'

const router = useRouter()
const inputModes: { label: string; value: InputMode }[] = [
  { label: '粘贴文本', value: 'text' },
  { label: '输入 URL', value: 'url' },
]

const defaultForm = (): GeoFormState => ({
  brand: '',
  name: '',
  type: '',
  specs: '',
  sellingPointsText: '',
  sellingPointsRange: '',
  targetAudience: '',
  emphasisText: '',
  emphasisRange: '',
  keyword: '',
  keywordMode: 'exact',
  seoKeywordsText: '',
  brandPoolText: '',
  brandPoolCount: '',
})

const form = reactive<GeoFormState>(defaultForm())
const inputMode = ref<InputMode>('text')
const articleText = ref('')
const articleUrl = ref('')
const profileName = ref('')
const profiles = ref<GeoProfileItem[]>([])
const selectedProfileId = ref<number | null>(null)
const profileSaving = ref(false)
const profileRemoving = ref(false)
const generating = ref(false)
const generationState = ref<GenerationState>('idle')
const streamText = ref('')
const errorMessage = ref('')
const batchDialogVisible = ref(false)
const DEFAULT_BATCH_COUNT = 10
const batchCount = ref(DEFAULT_BATCH_COUNT)
const batchSubmitting = ref(false)
const currentBatchJob = ref<GeoPromptBatchJob | null>(null)
let batchPollingTimer: number | null = null
const providerConfig = reactive<GeoProviderConfigView>({
  model: '',
  hasApiKey: false,
  hasBaseUrl: false,
  apiKeyHint: '',
  baseUrlHint: '',
})

const selectedProfile = computed(() => {
  return profiles.value.find((item) => item.id === selectedProfileId.value) ?? null
})

const activeBatchItemMessages = computed(() => {
  return (currentBatchJob.value?.items ?? [])
    .filter((item) => item.status === 'RUNNING' && item.errorMessage.trim())
    .slice(0, 4)
})

const parsedResult = computed(() => {
  const promptMarker = '### 生成提示词'
  const rawText = streamText.value.trim()

  if (!rawText || generationState.value === 'streaming') {
    return {
      summary: '',
      prompt: '',
    }
  }

  const index = rawText.indexOf(promptMarker)

  if (index === -1) {
    return {
      summary: '',
      prompt: rawText,
    }
  }

  return {
    summary: rawText.substring(0, index).replace(/^###\s*结构摘要\s*\n?/, '').trim(),
    prompt: rawText
      .substring(index + promptMarker.length)
      .trim()
      .replace(/^```[\s\S]*?\n/, '')
      .replace(/\n```\s*$/, '')
      .trim(),
  }
})

const toMultiline = (values: string[]) => values.join('\n')

const toStringArray = (text: string) => {
  return text
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

const buildProductPayload = (): GeoProfilePayload | GeoGeneratePayload['product'] => {
  return {
    brand: form.brand.trim(),
    name: form.name.trim(),
    type: form.type.trim(),
    specs: form.specs.trim(),
    sellingPoints: toStringArray(form.sellingPointsText),
    sellingPointsRange: form.sellingPointsRange.trim(),
    targetAudience: form.targetAudience.trim(),
    emphasis: toStringArray(form.emphasisText),
    emphasisRange: form.emphasisRange.trim(),
    keyword: form.keyword.trim(),
    keywordMode: form.keywordMode,
    seoKeywords: toStringArray(form.seoKeywordsText),
    brandPool: toStringArray(form.brandPoolText),
    brandPoolCount: form.brandPoolCount.trim(),
  }
}

const applyProfile = (profile: GeoProfileItem) => {
  selectedProfileId.value = profile.id
  profileName.value = profile.profileName
  articleUrl.value = profile.articleUrl ?? ''
  if (profile.articleUrl?.trim()) {
    inputMode.value = 'url'
  }
  form.brand = profile.product.brand
  form.name = profile.product.name
  form.type = profile.product.type
  form.specs = profile.product.specs
  form.sellingPointsText = toMultiline(profile.product.sellingPoints)
  form.sellingPointsRange = profile.product.sellingPointsRange
  form.targetAudience = profile.product.targetAudience
  form.emphasisText = toMultiline(profile.product.emphasis)
  form.emphasisRange = profile.product.emphasisRange
  form.keyword = profile.product.keyword
  form.keywordMode = profile.product.keywordMode
  form.seoKeywordsText = toMultiline(profile.product.seoKeywords)
  form.brandPoolText = toMultiline(profile.product.brandPool)
  form.brandPoolCount = profile.product.brandPoolCount
}

const resetForm = () => {
  Object.assign(form, defaultForm())
}

const resetDraft = () => {
  selectedProfileId.value = null
  profileName.value = ''
  inputMode.value = 'text'
  articleText.value = ''
  articleUrl.value = ''
  resetForm()
  generationState.value = 'idle'
  streamText.value = ''
  errorMessage.value = ''
}

const persistDraft = () => {
  const payload: PromptEngineDraft = {
    inputMode: inputMode.value,
    articleText: articleText.value,
    articleUrl: articleUrl.value,
    profileName: profileName.value,
    form: { ...form },
  }

  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload))
}

const restoreDraft = () => {
  const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
  if (!raw) return

  try {
    const draft = JSON.parse(raw) as Partial<PromptEngineDraft>
    if (draft.inputMode === 'text' || draft.inputMode === 'url') inputMode.value = draft.inputMode
    articleText.value = draft.articleText ?? ''
    articleUrl.value = draft.articleUrl ?? ''
    profileName.value = draft.profileName ?? ''
    Object.assign(form, defaultForm(), draft.form ?? {})
  } catch {
    localStorage.removeItem(DRAFT_STORAGE_KEY)
  }
}

const loadProfiles = async () => {
  profiles.value = await getGeoProfiles()

  if (selectedProfileId.value) {
    const nextProfile = profiles.value.find((item) => item.id === selectedProfileId.value)
    if (nextProfile) applyProfile(nextProfile)
  }
}

const loadProviderConfig = async () => {
  const config = await getGeoProviderConfig()
  providerConfig.model = config.model
  providerConfig.hasApiKey = config.hasApiKey
  providerConfig.hasBaseUrl = config.hasBaseUrl
  providerConfig.apiKeyHint = config.apiKeyHint
  providerConfig.baseUrlHint = config.baseUrlHint
}

const handleProfileChange = (value: number | null) => {
  if (!value) {
    selectedProfileId.value = null
    return
  }

  const profile = profiles.value.find((item) => item.id === value)
  if (profile) applyProfile(profile)
}

const saveProfile = async () => {
  const payload = buildProductPayload()
  const isEditing = Boolean(selectedProfileId.value)

  if (!profileName.value.trim()) {
    ElMessage.warning('请先填写档案名称')
    return
  }

  profileSaving.value = true

  try {
    const nextPayload = {
      profileName: profileName.value.trim(),
      articleUrl: articleUrl.value.trim(),
      ...payload,
    }
    const currentProfileId = selectedProfileId.value

    const savedProfile = isEditing && currentProfileId !== null
      ? await updateGeoProfile(currentProfileId, nextPayload)
      : await createGeoProfile(nextPayload)

    await loadProfiles()
    applyProfile(savedProfile)
    ElMessage.success(isEditing ? '产品档案已更新' : '产品档案已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '产品档案保存失败')
  } finally {
    profileSaving.value = false
  }
}

const removeProfile = async () => {
  if (!selectedProfile.value) return

  try {
    await ElMessageBox.confirm(`确定删除「${selectedProfile.value.profileName}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  profileRemoving.value = true

  try {
    await deleteGeoProfile(selectedProfile.value.id)
    await loadProfiles()
    resetDraft()
    ElMessage.success('产品档案已删除')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '产品档案删除失败')
  } finally {
    profileRemoving.value = false
  }
}

const generatePrompt = async () => {
  if (!providerConfig.hasApiKey) {
    ElMessage.warning('请先完成 Anthropic 配置')
    router.push('/geo/anthropic-config')
    return
  }

  const payload: GeoGeneratePayload = {
    product: buildProductPayload(),
  }

  if (inputMode.value === 'text') {
    payload.articleText = articleText.value.trim()
  } else {
    payload.articleUrl = articleUrl.value.trim()
  }

  if (!payload.articleText && !payload.articleUrl) {
    ElMessage.warning('请先输入竞对文章内容或 URL')
    return
  }

  generating.value = true
  generationState.value = 'streaming'
  streamText.value = ''
  errorMessage.value = ''

  let streamError = ''

  try {
    await streamGeoPrompt(payload, {
      onEvent: (event) => {
        if (event.type === 'text') {
          streamText.value += event.content ?? ''
          return
        }

        if (event.type === 'error') {
          streamError = event.content ?? '生成失败'
        }
      },
    })

    if (streamError) {
      throw new Error(streamError)
    }

    generationState.value = 'done'
    ElMessage.success('Prompt 已生成完成')
  } catch (error) {
    generationState.value = 'idle'
    errorMessage.value = error instanceof Error ? error.message : '生成失败，请稍后重试'
  } finally {
    generating.value = false
  }
}

const handleGenerateCommand = (command: string) => {
  if (command === 'batch') {
    openBatchDialog()
  }
}

const buildArticlePayload = (): Pick<GeoGeneratePayload, 'articleText' | 'articleUrl'> => {
  if (inputMode.value === 'text') {
    return { articleText: articleText.value.trim() }
  }

  return { articleUrl: articleUrl.value.trim() }
}

const openBatchDialog = () => {
  if (!providerConfig.hasApiKey) {
    ElMessage.warning('请先完成 Anthropic 配置')
    router.push('/geo/anthropic-config')
    return
  }

  if (!selectedProfileId.value) {
    ElMessage.warning('批量生成必须先选择已保存的产品档案')
    return
  }

  const articlePayload = buildArticlePayload()

  if (!articlePayload.articleText && !articlePayload.articleUrl) {
    ElMessage.warning('请先输入竞对文章内容或 URL')
    return
  }

  batchCount.value = DEFAULT_BATCH_COUNT
  batchDialogVisible.value = true
}

const submitBatch = async () => {
  if (!selectedProfileId.value) {
    ElMessage.warning('批量生成必须先选择已保存的产品档案')
    return
  }

  const articlePayload = buildArticlePayload()

  if (!articlePayload.articleText && !articlePayload.articleUrl) {
    ElMessage.warning('请先输入竞对文章内容或 URL')
    return
  }

  batchSubmitting.value = true

  try {
    const job = await createGeoPromptBatch({
      engineType: 'LEGACY',
      profileId: selectedProfileId.value,
      count: batchCount.value,
      ...articlePayload,
    })

    currentBatchJob.value = job
    batchDialogVisible.value = false
    startBatchPolling(job.id)
    ElMessage.success('批量任务已创建，后端会继续生成')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '批量任务创建失败')
  } finally {
    batchSubmitting.value = false
  }
}

const startBatchPolling = (jobId: number) => {
  stopBatchPolling()
  batchPollingTimer = window.setInterval(() => {
    void refreshBatchJob(jobId)
  }, 2500)
}

const stopBatchPolling = () => {
  if (batchPollingTimer) {
    window.clearInterval(batchPollingTimer)
    batchPollingTimer = null
  }
}

const refreshBatchJob = async (jobId: number) => {
  try {
    const job = await getGeoPromptBatch(jobId)
    currentBatchJob.value = job

    if (isBatchTerminal(job.status)) {
      stopBatchPolling()
    }
  } catch (error) {
    stopBatchPolling()
    ElMessage.error(error instanceof Error ? error.message : '批量任务状态刷新失败')
  }
}

const isBatchTerminal = (status: GeoPromptBatchJobStatus) => {
  return status === 'COMPLETED' || status === 'PARTIAL_FAILED' || status === 'FAILED'
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

const copyPrompt = async () => {
  const prompt = parsedResult.value.prompt
  if (!prompt) return

  const fallbackCopyText = (value: string) => {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.top = '-9999px'
    textarea.style.left = '-9999px'
    textarea.style.opacity = '0'

    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, value.length)

    const succeeded = document.execCommand('copy')
    document.body.removeChild(textarea)

    return succeeded
  }

  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(prompt)
      ElMessage.success('Prompt 已复制')
      return
    }

    if (fallbackCopyText(prompt)) {
      ElMessage.success('Prompt 已复制')
      return
    }

    ElMessage.error('复制失败，请手动选择文本')
  } catch {
    if (fallbackCopyText(prompt)) {
      ElMessage.success('Prompt 已复制')
      return
    }

    ElMessage.error('复制失败，请手动选择文本')
  }
}

const formatDisplayTime = (value: string) => {
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  })
}

watch(
  [inputMode, articleText, articleUrl, profileName, () => ({ ...form })],
  () => {
    persistDraft()
  },
  {
    deep: true,
  }
)

onMounted(async () => {
  restoreDraft()

  try {
    await Promise.all([loadProfiles(), loadProviderConfig()])
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'GEO 数据加载失败')
  }
})

onUnmounted(() => {
  stopBatchPolling()
})
</script>

<style scoped>
.geo-engine-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(360px, 0.82fr);
  gap: 20px;
  align-items: start;
}

.geo-engine-left {
  display: grid;
  gap: 18px;
}

.geo-engine-right {
  position: sticky;
  top: 112px;
}

.geo-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.geo-card-head__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.geo-card-head h3 {
  margin: 0;
  font-size: 18px;
  color: #4f3c41;
}

.geo-card-head p {
  margin: 7px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: #7c686d;
}

.geo-card-head--top {
  align-items: center;
}

.geo-mode-switch {
  display: inline-flex;
  gap: 8px;
  padding: 4px;
  border-radius: 12px;
  background: rgba(255, 243, 241, 0.78);
}

.geo-mode-switch__item {
  padding: 7px 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  color: #7d676d;
  background: transparent;
  transition:
    color 0.24s ease,
    background 0.24s ease,
    border-color 0.24s ease,
    transform 0.24s ease;
}

.geo-mode-switch__item.active {
  color: #c95a62;
  border-color: rgba(217, 107, 114, 0.2);
  background: rgba(255, 252, 251, 0.95);
  box-shadow: 0 8px 18px rgba(176, 102, 108, 0.08);
}

.geo-inline-note {
  margin-top: 12px;
  font-size: 12px;
  line-height: 1.7;
  color: #8f7a7f;
}

.geo-profile-grid {
  display: grid;
  grid-template-columns: minmax(220px, 0.9fr) minmax(220px, 1.1fr);
  gap: 12px;
}

.geo-profile-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

.geo-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.geo-output-card {
  min-height: 620px;
}

.geo-output-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.geo-stream-panel,
.geo-result-section {
  padding: 18px;
  margin-top: 18px;
  border-radius: 18px;
}

.geo-stream-panel {
  background: linear-gradient(180deg, rgba(255, 250, 249, 0.98), rgba(255, 244, 242, 0.92));
  border: 1px solid rgba(227, 200, 194, 0.74);
}

.geo-stream-title,
.geo-result-section h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #735f64;
}

.geo-result-section--summary {
  background: rgba(255, 250, 249, 0.96);
  border: 1px solid rgba(226, 205, 201, 0.8);
}

.geo-result-section--prompt {
  background: linear-gradient(180deg, rgba(255, 246, 244, 0.98), rgba(255, 238, 235, 0.92));
  border: 1px solid rgba(224, 188, 183, 0.78);
}

.geo-result-copy,
.geo-stream-content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family:
    'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 1.9;
  color: #4f3d42;
}

.geo-result-empty {
  display: grid;
  gap: 12px;
  place-items: start;
  padding: 28px 0 6px;
}

.geo-result-empty__title {
  font-size: 15px;
  font-weight: 700;
  color: #5a454b;
}

.geo-result-empty p {
  margin: 0;
  font-size: 13px;
  line-height: 1.75;
  color: #816d72;
}

.geo-batch-card {
  display: grid;
  gap: 14px;
  padding: 18px;
  margin-top: 18px;
  border: 1px solid rgba(225, 197, 190, 0.78);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 252, 249, 0.98), rgba(255, 244, 238, 0.92));
}

.geo-batch-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.geo-batch-card__head h4 {
  margin: 0 0 6px;
  font-size: 15px;
  color: #59434a;
}

.geo-batch-card__head p,
.geo-batch-dialog p {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: #816d72;
}

.geo-batch-stats,
.geo-batch-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.geo-batch-stats span {
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: #6d555c;
  font-size: 12px;
}

.geo-batch-retry-list {
  display: grid;
  gap: 8px;
}

.geo-batch-retry-list div {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 9px 11px;
  border: 1px solid rgba(230, 162, 60, 0.22);
  border-radius: 12px;
  background: rgba(230, 162, 60, 0.08);
  color: #8a5b17;
  font-size: 12px;
  line-height: 1.6;
}

.geo-batch-retry-list span {
  flex: 0 0 auto;
  font-weight: 700;
}

.geo-batch-retry-list strong {
  font-weight: 500;
}

.geo-batch-error {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(245, 108, 108, 0.08);
  color: #a84848;
  font-size: 12px;
  line-height: 1.65;
}

.geo-batch-dialog {
  display: grid;
  gap: 14px;
}

@media (max-width: 1440px) {
  .geo-engine-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .geo-engine-right {
    position: static;
  }
}
</style>
