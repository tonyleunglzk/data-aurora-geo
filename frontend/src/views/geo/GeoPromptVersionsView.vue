<template>
  <PageHeader
    description="系统级固定规则放在顶部统一维护，下面用版本列表和右侧编辑区管理不同写法版本；支持手动新建、AI 对话生成草稿和 Markdown 导入草稿。"
    eyebrow="Prompt Engine V2"
    title="版本管理"
  >
    <template #actions>
      <el-button v-if="appStore.isAdmin" plain @click="openManualCreate">手动新建</el-button>
      <el-button v-if="appStore.isAdmin" @click="openChatDialog">AI 对话创建</el-button>
      <el-button v-if="appStore.isAdmin" type="primary" @click="triggerImport">导入版本</el-button>
    </template>
  </PageHeader>

  <input
    ref="fileInputRef"
    accept=".md,text/markdown"
    class="visually-hidden"
    type="file"
    @change="handleFileImport"
  />

  <section class="prompt-version-layout">
    <article class="surface-card section-card reveal-up" style="--delay: 0.08s">
      <div class="prompt-version-card-head">
        <div>
          <h3>系统级固定规则</h3>
          <p>这部分对新版 Prompt Engine 的所有版本都会生效，是全局共享的底线约束。</p>
        </div>
        <div class="prompt-version-card-actions">
          <el-button :loading="loading" @click="loadData">重新读取</el-button>
          <el-button
            v-if="appStore.isAdmin"
            :loading="savingFixedRules"
            type="primary"
            @click="saveFixedRules"
          >
            保存固定规则
          </el-button>
        </div>
      </div>

      <el-input
        v-model="fixedRulesText"
        :autosize="{ minRows: 8, maxRows: 16 }"
        :disabled="!appStore.isAdmin"
        placeholder="在这里维护全局固定规则"
        resize="vertical"
        type="textarea"
      />

      <div class="prompt-version-inline-note">
        {{ fixedRulesUpdatedAt ? `最近更新于 ${formatDisplayTime(fixedRulesUpdatedAt)}` : '固定规则尚未加载' }}
      </div>
    </article>

    <section class="prompt-version-workbench">
      <article v-loading="loading" class="surface-card section-card reveal-up" style="--delay: 0.12s">
        <div class="prompt-version-card-head">
          <div>
            <h3>版本列表</h3>
            <p>左侧可以切换新版版本，也可以直接查看旧版固定引擎规则。</p>
          </div>
          <el-tag effect="light" round>{{ versions.length + 1 }} 个条目</el-tag>
        </div>

        <div class="prompt-version-list">
          <button
            :class="['prompt-version-list-item', 'prompt-version-list-item--legacy', { active: isLegacySelected }]"
            type="button"
            @click="selectLegacyRules"
          >
            <div class="prompt-version-list-item__top">
              <strong>Prompt Engine（旧版固定引擎）</strong>
              <el-tag effect="light" round size="small" type="warning">只读</el-tag>
            </div>
            <div class="prompt-version-list-item__meta">
              <span>固定骨架</span>
              <span>动态规则可叠加</span>
            </div>
            <p>{{ legacyRulesSummary || '查看旧版 Prompt Engine 的核心规则骨架和动态追加说明。' }}</p>
          </button>

          <div class="prompt-version-folder-tree">
            <section v-for="category in groupedVersions" :key="category.key" class="prompt-version-folder">
              <div class="prompt-version-folder__head">
                <strong>{{ category.category }}</strong>
                <el-tag effect="light" round size="small">{{ category.count }} 个版本</el-tag>
              </div>

              <section v-for="group in category.groups" :key="group.key" class="prompt-version-folder__branch">
                <div class="prompt-version-folder__branch-head">
                  <span>{{ group.platform }}</span>
                  <em>{{ group.items.length }}</em>
                </div>

                <button
                  v-for="{ item, displayName } in group.items"
                  :key="item.id"
                  :class="['prompt-version-list-item', { active: selectedVersionKey === item.id }]"
                  type="button"
                  @click="selectVersion(item)"
                >
                  <div class="prompt-version-list-item__top">
                    <strong>{{ displayName }}</strong>
                    <el-tag :type="item.isActive ? 'success' : 'info'" effect="light" round size="small">
                      {{ item.isActive ? '启用中' : '已停用' }}
                    </el-tag>
                  </div>
                  <div class="prompt-version-list-item__meta">
                    <span>{{ item.articleUrl ? '有默认 URL' : '无默认 URL' }}</span>
                    <span>{{ item.articleText ? '有默认正文' : '无默认正文' }}</span>
                    <span>{{ formatDisplayTime(item.updatedAt) }}</span>
                  </div>
                  <p>{{ item.description || item.name }}</p>
                </button>
              </section>
            </section>
          </div>
        </div>
      </article>

      <article v-if="isLegacySelected" class="surface-card section-card reveal-up" style="--delay: 0.16s">
        <div class="prompt-version-card-head prompt-version-card-head--top">
          <div>
            <h3>查看旧版规则</h3>
            <p>旧版 Prompt Engine 的核心规则骨架保存在系统提示词里，运行时还会根据输入条件动态追加更多约束。</p>
          </div>
        </div>

        <p class="prompt-version-inline-note prompt-version-inline-note--block">
          {{ legacyRulesSummary || '旧版固定引擎规则尚未加载。' }}
        </p>

        <el-form label-position="top">
          <div class="dialog-form-grid">
            <el-form-item label="版本名称">
              <el-input model-value="Prompt Engine（旧版固定引擎）" disabled />
            </el-form-item>
            <el-form-item label="来源">
              <div class="prompt-version-inline-note prompt-version-inline-note--plain">旧版固定规则</div>
            </el-form-item>
          </div>

          <el-form-item label="简要说明">
            <el-input
              :model-value="legacyRulesSummary"
              :rows="3"
              disabled
              resize="vertical"
              type="textarea"
            />
          </el-form-item>

          <el-form-item label="规则内容">
            <el-input
              v-model="legacyRulesText"
              :autosize="{ minRows: 18, maxRows: 32 }"
              disabled
              placeholder="旧版固定引擎规则会显示在这里"
              resize="vertical"
              type="textarea"
            />
          </el-form-item>
        </el-form>

        <div v-if="legacyConditionalNotes.length > 0" class="prompt-version-inline-note">
          <strong>运行时还会动态追加：</strong>
          <ul class="prompt-version-note-list">
            <li v-for="item in legacyConditionalNotes" :key="item">{{ item }}</li>
          </ul>
        </div>
      </article>

      <article v-else class="surface-card section-card reveal-up" style="--delay: 0.16s">
        <div class="prompt-version-card-head prompt-version-card-head--top">
          <div>
            <h3>{{ form.id ? '编辑版本' : '新建版本草稿' }}</h3>
            <p>版本名称和规则内容都直接可见、可编辑。AI 对话和 Markdown 导入的结果也会先填到这里。</p>
          </div>
          <div v-if="appStore.isAdmin" class="prompt-version-card-actions">
            <el-button :disabled="!form.id" plain @click="toggleVersionActive">
              {{ form.isActive ? '停用版本' : '启用版本' }}
            </el-button>
            <el-button :disabled="!form.id" plain type="danger" @click="removeVersion">
              删除版本
            </el-button>
            <el-button :loading="savingVersion" type="primary" @click="saveVersion">保存版本</el-button>
          </div>
        </div>

        <el-form label-position="top">
          <div class="dialog-form-grid">
            <el-form-item label="版本名称">
              <el-input v-model="form.name" :disabled="!appStore.isAdmin" placeholder="如：百家号榜单版" />
            </el-form-item>
          </div>

          <div class="dialog-form-grid">
            <el-form-item label="启用状态">
              <el-switch v-model="form.isActive" :disabled="!appStore.isAdmin" />
            </el-form-item>
            <el-form-item label="来源">
              <div class="prompt-version-inline-note prompt-version-inline-note--plain">
                {{ draftSourceLabel }}
              </div>
            </el-form-item>
          </div>

          <el-form-item label="简要说明">
            <el-input
              v-model="form.description"
              :disabled="!appStore.isAdmin"
              :rows="3"
              placeholder="概括这个版本适合什么文章、想解决什么问题"
              resize="vertical"
              type="textarea"
            />
          </el-form-item>

          <el-form-item label="默认竞对文章 URL">
            <el-input
              v-model="form.articleUrl"
              :disabled="!appStore.isAdmin"
              clearable
              placeholder="https://...；选择该版本生成时会自动填入，留空则继续使用产品档案 URL"
            />
          </el-form-item>

          <el-form-item label="默认竞对文章正文">
            <el-input
              v-model="form.articleText"
              :autosize="{ minRows: 5, maxRows: 12 }"
              :disabled="!appStore.isAdmin"
              placeholder="可选。生成页选择“粘贴文本”时，切换到该版本会自动填入这段正文"
              resize="vertical"
              type="textarea"
            />
          </el-form-item>

          <el-form-item label="版本规则内容">
            <el-input
              v-model="form.ruleText"
              :autosize="{ minRows: 18, maxRows: 32 }"
              :disabled="!appStore.isAdmin"
              placeholder="在这里写这个版本的规则内容"
              resize="vertical"
              type="textarea"
            />
          </el-form-item>
        </el-form>
      </article>
    </section>
  </section>

  <el-dialog v-model="chatDialogVisible" title="AI 对话创建版本" width="1180px">
    <div class="version-chat-layout">
      <aside class="version-chat-session-panel">
        <div class="version-chat-session-head">
          <div>
            <strong>会话草稿</strong>
            <p>刷新页面后也可以回来继续聊。</p>
          </div>
          <el-button :loading="creatingChatSession" size="small" type="primary" @click="createChatSession">
            新建
          </el-button>
        </div>

        <div v-loading="loadingChatSessions" class="version-chat-session-list">
          <button
            v-for="session in chatSessions"
            :key="session.id"
            :class="['version-chat-session-item', { active: selectedChatSessionId === session.id }]"
            type="button"
            @click="selectChatSession(session.id)"
          >
            <div class="version-chat-session-item__top">
              <strong>{{ session.title }}</strong>
              <el-tag :type="session.status === 'APPLIED' ? 'success' : 'info'" effect="light" round size="small">
                {{ session.status === 'APPLIED' ? '已应用' : '草稿' }}
              </el-tag>
            </div>
            <div class="version-chat-session-item__meta">
              <span>{{ session.ownerName || '未标记创建人' }}</span>
              <span>{{ formatChatModel(session.model) }}</span>
              <span>{{ formatDisplayTime(session.updatedAt) }}</span>
            </div>
            <p>{{ session.lastMessagePreview || session.notes || '还没有对话内容。' }}</p>
          </button>

          <el-empty v-if="chatSessions.length === 0 && !loadingChatSessions" description="暂无会话" />
        </div>
      </aside>

      <div class="version-chat-sidebar">
        <el-form label-position="top">
          <el-form-item label="会话标题">
            <el-input
              v-model="chatSessionTitle"
              :disabled="!selectedChatSessionId"
              placeholder="给这次讨论起个名字"
              @input="scheduleSaveChatSession()"
            />
          </el-form-item>

          <el-form-item label="版本名称（正式保存用）">
            <el-input
              v-model="chatVersionName"
              :disabled="!selectedChatSessionId || savingVersion"
              placeholder="保存到版本列表时显示的名称，可与会话标题不同"
              @input="scheduleSaveChatSession()"
            />
            <div class="prompt-version-inline-note prompt-version-inline-note--plain">
              会话标题只管理聊天记录；正式版本会使用这里的名称。
            </div>
          </el-form-item>

          <el-form-item label="对话模型">
            <el-select
              v-model="chatModel"
              :disabled="!selectedChatSessionId || chatStreaming"
              placeholder="选择模型"
              @change="scheduleSaveChatSession()"
            >
              <el-option v-for="model in chatModelOptions" :key="model" :label="model" :value="model" />
            </el-select>
            <div class="prompt-version-inline-note prompt-version-inline-note--plain">
              仅影响 AI 建版对话和应用草稿；新旧 Prompt Engine 正式生成仍使用 Anthropic 配置页的模型。
            </div>
          </el-form-item>
        </el-form>

        <div class="geo-mode-switch">
          <button
            v-for="item in inputModes"
            :key="item.value"
            :class="['geo-mode-switch__item', { active: chatInputMode === item.value }]"
            @click="setChatInputMode(item.value)"
          >
            {{ item.label }}
          </button>
        </div>

        <el-input
          v-if="chatInputMode === 'text'"
              v-model="chatArticleText"
              :rows="8"
              placeholder="可选：贴一篇参考文章，让 AI 帮你总结这个版本应该怎么写"
              resize="vertical"
              type="textarea"
              @input="scheduleSaveChatSession(true)"
            />
            <el-input
              v-else
              v-model="chatArticleUrl"
              placeholder="https://..."
              @input="scheduleSaveChatSession(true)"
            />

            <el-input
              v-model="chatNotes"
              :rows="4"
              placeholder="补充要求：例如偏榜单感、保留 TOP 编号、不要写得太百科……"
              resize="vertical"
              type="textarea"
              @input="scheduleSaveChatSession(true)"
            />

        <div class="prompt-version-inline-note">
          {{ chatSaveStateText }}
        </div>
      </div>

      <div class="version-chat-main">
        <div class="version-chat-stream">
          <article
            v-for="(message, index) in chatMessages"
            :key="`${message.role}-${index}`"
            :class="['version-chat-bubble', `version-chat-bubble--${message.role}`]"
          >
            <strong>{{ message.role === 'user' ? '你' : 'AI' }}</strong>
            <p>{{ message.content }}</p>
          </article>

          <el-empty v-if="chatMessages.length === 0" description="选择一个会话，开始和 AI 讨论版本规则。" />
        </div>

        <el-input
          v-model="chatInput"
          :rows="4"
          placeholder="和模型聊这个版本应该怎么写，例如：标题要更像榜单、主体每个品牌要带适合人群和推荐理由……"
          resize="vertical"
          type="textarea"
        />

        <div class="version-chat-actions">
          <el-button :disabled="!selectedChatSessionId || chatStreaming" plain type="danger" @click="removeChatSession">
            删除会话
          </el-button>
          <el-button :disabled="!selectedChatSessionId || chatStreaming" @click="resetChatDraft">清空消息</el-button>
          <el-button :disabled="!selectedChatSessionId" :loading="chatStreaming" type="primary" @click="sendChatMessage">
            发送
          </el-button>
          <el-button
            :disabled="!selectedChatSessionId || chatMessages.length === 0"
            :loading="applyingChatDraft"
            plain
            @click="applyChatDraft"
          >
            应用结果到草稿
          </el-button>
          <el-button
            v-if="appStore.isAdmin"
            :disabled="!canSaveChatSessionAsVersion"
            :loading="applyingChatDraft || savingVersion"
            type="success"
            @click="saveChatSessionAsVersion"
          >
            保存为正式版本
          </el-button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import { groupGeoNamedItemsByCategory } from '@/utils/geoVersionGroups'
import {
  applyGeoPromptEngineV2VersionDraftSession,
  createGeoPromptEngineV2VersionDraftSession,
  createGeoPromptEngineV2Version,
  deleteGeoPromptEngineV2VersionDraftSession,
  deleteGeoPromptEngineV2Version,
  getGeoProviderConfig,
  getGeoPromptEngineV2VersionDraftSession,
  getGeoPromptEngineV2VersionDraftSessions,
  getGeoPromptEngineLegacyRules,
  getGeoPromptEngineV2FixedRules,
  getGeoPromptEngineV2Versions,
  importGeoPromptEngineV2VersionDraft,
  streamGeoPromptEngineV2VersionDraftSessionChat,
  updateGeoPromptEngineV2VersionDraftSession,
  updateGeoPromptEngineV2FixedRules,
  updateGeoPromptEngineV2Version,
} from '@/api/geo'
import { useAppStore } from '@/stores/app'
import type {
  GeoPromptEngineVersion,
  GeoPromptEngineVersionDraftMessage,
  GeoPromptEngineVersionDraftSession,
  GeoPromptEngineVersionDraftSessionPayload,
  GeoProviderConfigView,
} from '@/types/geo'

type InputMode = 'text' | 'url'
type DraftSource = 'manual' | 'ai_chat' | 'markdown_import'

const CHAT_MODEL_OPTIONS = ['claude-opus-4.7', 'claude-opus-4-6', 'claude-sonnet-4-6'] as const
const DEFAULT_CHAT_MODEL = CHAT_MODEL_OPTIONS[0]

const appStore = useAppStore()
const inputModes: { label: string; value: InputMode }[] = [
  { label: '粘贴文本', value: 'text' },
  { label: '输入 URL', value: 'url' },
]

const loading = ref(false)
const savingFixedRules = ref(false)
const savingVersion = ref(false)
const versions = ref<GeoPromptEngineVersion[]>([])
const fixedRulesText = ref('')
const fixedRulesUpdatedAt = ref('')
const legacyRulesSummary = ref('')
const legacyRulesText = ref('')
const legacyConditionalNotes = ref<string[]>([])
const selectedVersionKey = ref<number | 'legacy' | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const form = reactive({
  id: null as number | null,
  name: '',
  description: '',
  articleUrl: '',
  articleText: '',
  ruleText: '',
  isActive: true,
  sortOrder: 0,
})
const draftSource = ref<DraftSource>('manual')

const chatDialogVisible = ref(false)
const chatInputMode = ref<InputMode>('text')
const chatArticleText = ref('')
const chatArticleUrl = ref('')
const chatNotes = ref('')
const chatModel = ref('')
const chatInput = ref('')
const chatMessages = ref<GeoPromptEngineVersionDraftMessage[]>([])
const chatSessionTitle = ref('')
const chatVersionName = ref('')
const chatSessions = ref<GeoPromptEngineVersionDraftSession[]>([])
const providerConfig = ref<GeoProviderConfigView | null>(null)
const selectedChatSessionId = ref<number | null>(null)
const chatStreaming = ref(false)
const applyingChatDraft = ref(false)
const loadingChatSessions = ref(false)
const creatingChatSession = ref(false)
const chatAutoSaving = ref(false)
const chatLastSavedAt = ref('')
let chatSaveTimer: number | null = null
let chatSaveQueue = Promise.resolve<GeoPromptEngineVersionDraftSession | null>(null)

const draftSourceLabel = computed(() => {
  if (draftSource.value === 'ai_chat') return 'AI 对话草稿'
  if (draftSource.value === 'markdown_import') return 'Markdown 导入草稿'
  return form.id ? '已保存版本' : '手动新建草稿'
})

const isLegacySelected = computed(() => selectedVersionKey.value === 'legacy')

const groupedVersions = computed(() => (
  groupGeoNamedItemsByCategory(versions.value, (item) => item.name, (item) => item.id)
))

const selectedChatSession = computed(() => {
  return chatSessions.value.find((item) => item.id === selectedChatSessionId.value) ?? null
})

const normalizeChatModel = (model?: string | null) => {
  const value = model?.trim()
  return CHAT_MODEL_OPTIONS.find((item) => item === value) ?? DEFAULT_CHAT_MODEL
}

const defaultChatModel = computed(() => normalizeChatModel(providerConfig.value?.model))

const chatModelOptions = computed(() => {
  return [...CHAT_MODEL_OPTIONS]
})

const formatChatModel = (model?: string | null) => normalizeChatModel(model)

const chatSaveStateText = computed(() => {
  if (!selectedChatSessionId.value) return '请先新建或选择一个会话。'
  if (chatAutoSaving.value) return '正在自动保存会话...'
  if (chatLastSavedAt.value) return `已自动保存于 ${formatDisplayTime(chatLastSavedAt.value)}`
  return '会话会自动保存。'
})

const canSaveChatSessionAsVersion = computed(() => {
  if (!selectedChatSessionId.value || chatStreaming.value) return false
  return Boolean(selectedChatSession.value?.suggestedRuleText?.trim() || chatMessages.value.length > 0)
})

const loadData = async () => {
  loading.value = true

  try {
    const [legacyRules, fixedRules, nextVersions, nextProviderConfig] = await Promise.all([
      getGeoPromptEngineLegacyRules(),
      getGeoPromptEngineV2FixedRules(),
      getGeoPromptEngineV2Versions(),
      getGeoProviderConfig(),
    ])

    legacyRulesSummary.value = legacyRules.summary
    legacyRulesText.value = legacyRules.ruleText
    legacyConditionalNotes.value = legacyRules.conditionalNotes
    fixedRulesText.value = fixedRules.ruleText
    fixedRulesUpdatedAt.value = fixedRules.updatedAt
    versions.value = nextVersions
    providerConfig.value = nextProviderConfig

    if (!chatModel.value.trim()) {
      chatModel.value = defaultChatModel.value
    }

    if (selectedVersionKey.value === 'legacy') {
      return
    }

    if (typeof selectedVersionKey.value === 'number') {
      const matched = versions.value.find((item) => item.id === selectedVersionKey.value)
      if (matched) {
        selectVersion(matched)
        return
      }
    }

    if (!form.id && versions.value.length > 0) {
      selectVersion(versions.value[0])
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '版本数据加载失败')
  } finally {
    loading.value = false
  }
}

const applyVersionToForm = (version: GeoPromptEngineVersion) => {
  form.id = version.id
  form.name = version.name
  form.description = version.description
  form.articleUrl = version.articleUrl
  form.articleText = version.articleText
  form.ruleText = version.ruleText
  form.isActive = version.isActive
  form.sortOrder = version.sortOrder
  draftSource.value = 'manual'
}

const selectVersion = (version: GeoPromptEngineVersion) => {
  selectedVersionKey.value = version.id
  applyVersionToForm(version)
}

const selectLegacyRules = () => {
  selectedVersionKey.value = 'legacy'
}

const openManualCreate = () => {
  selectedVersionKey.value = null
  form.id = null
  form.name = ''
  form.description = ''
  form.articleUrl = ''
  form.articleText = ''
  form.ruleText = ''
  form.isActive = true
  form.sortOrder = versions.value.length
  draftSource.value = 'manual'
}

const saveFixedRules = async () => {
  savingFixedRules.value = true

  try {
    const saved = await updateGeoPromptEngineV2FixedRules(fixedRulesText.value)
    fixedRulesText.value = saved.ruleText
    fixedRulesUpdatedAt.value = saved.updatedAt
    ElMessage.success('固定规则已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '固定规则保存失败')
  } finally {
    savingFixedRules.value = false
  }
}

const saveVersion = async () => {
  if (!form.name.trim()) {
    ElMessage.warning('请先填写版本名称')
    return false
  }

  if (!form.ruleText.trim()) {
    ElMessage.warning('请先填写版本规则内容')
    return false
  }

  savingVersion.value = true

  try {
    const isEditing = Boolean(form.id)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      articleUrl: form.articleUrl.trim(),
      articleText: form.articleText.trim(),
      ruleText: form.ruleText.trim(),
      isActive: form.isActive,
      sortOrder: form.sortOrder,
    }

    const saved = form.id
      ? await updateGeoPromptEngineV2Version(form.id, payload)
      : await createGeoPromptEngineV2Version(payload)

    await loadData()
    selectVersion(saved)
    ElMessage.success(isEditing ? '版本已更新' : '版本已创建')
    return true
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '版本保存失败')
    return false
  } finally {
    savingVersion.value = false
  }
}

const toggleVersionActive = async () => {
  if (!form.id) return

  savingVersion.value = true

  try {
    const saved = await updateGeoPromptEngineV2Version(form.id, {
      isActive: !form.isActive,
    })

    await loadData()
    selectVersion(saved)
    ElMessage.success(saved.isActive ? '版本已启用' : '版本已停用')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '版本状态更新失败')
  } finally {
    savingVersion.value = false
  }
}

const removeVersion = async () => {
  if (!form.id) return

  try {
    await ElMessageBox.confirm(`确定删除「${form.name}」吗？`, '删除版本', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  savingVersion.value = true

  try {
    await deleteGeoPromptEngineV2Version(form.id)
    await loadData()
    openManualCreate()
    ElMessage.success('版本已删除')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '版本删除失败')
  } finally {
    savingVersion.value = false
  }
}

const updateChatSessionInList = (session: GeoPromptEngineVersionDraftSession) => {
  const index = chatSessions.value.findIndex((item) => item.id === session.id)
  if (index === -1) {
    chatSessions.value = [session, ...chatSessions.value]
    return
  }

  const nextSessions = [...chatSessions.value]
  nextSessions[index] = session
  chatSessions.value = nextSessions.sort((first, second) => {
    return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
  })
}

const applyChatSessionToForm = (session: GeoPromptEngineVersionDraftSession) => {
  if (chatSaveTimer) {
    window.clearTimeout(chatSaveTimer)
    chatSaveTimer = null
  }

  selectedChatSessionId.value = session.id
  chatSessionTitle.value = session.title
  chatArticleText.value = session.articleText
  chatArticleUrl.value = session.articleUrl
  chatNotes.value = session.notes
  chatModel.value = normalizeChatModel(session.model || defaultChatModel.value)
  chatInputMode.value = session.articleUrl && !session.articleText ? 'url' : 'text'
  chatMessages.value = session.messages
  chatVersionName.value = session.suggestedName
  chatInput.value = ''
  chatLastSavedAt.value = session.updatedAt
}

const buildChatSessionPayload = (
  messages: GeoPromptEngineVersionDraftMessage[] = chatMessages.value,
  options: { resetSuggestion?: boolean } = {}
): GeoPromptEngineVersionDraftSessionPayload => {
  const payload: GeoPromptEngineVersionDraftSessionPayload = {
    title: chatSessionTitle.value.trim() || selectedChatSession.value?.title || 'AI 建版会话',
    articleText: chatInputMode.value === 'text' ? chatArticleText.value.trim() : '',
    articleUrl: chatInputMode.value === 'url' ? chatArticleUrl.value.trim() : '',
    notes: chatNotes.value.trim(),
    model: normalizeChatModel(chatModel.value || defaultChatModel.value),
    messages,
    ownerUserId: appStore.currentUser.id || null,
    ownerName: appStore.currentUser.name || appStore.currentUser.username || '',
  }

  if (options.resetSuggestion) {
    payload.status = 'ACTIVE'
    payload.suggestedName = chatVersionName.value.trim()
    payload.suggestedDescription = ''
    payload.suggestedRuleText = ''
    return payload
  }

  if (chatVersionName.value.trim() || selectedChatSession.value?.suggestedRuleText) {
    payload.suggestedName = chatVersionName.value.trim()
  }

  return payload
}

const queueSaveChatSession = (
  payload: GeoPromptEngineVersionDraftSessionPayload = buildChatSessionPayload()
) => {
  const sessionId = selectedChatSessionId.value
  if (!sessionId) return Promise.resolve(null)

  chatAutoSaving.value = true
  chatSaveQueue = chatSaveQueue
    .catch(() => null)
    .then(async () => {
      const saved = await updateGeoPromptEngineV2VersionDraftSession(sessionId, payload)
      updateChatSessionInList(saved)
      chatLastSavedAt.value = saved.updatedAt
      return saved
    })
    .finally(() => {
      chatAutoSaving.value = false
    })

  return chatSaveQueue
}

const scheduleSaveChatSession = (resetSuggestion = false) => {
  if (!selectedChatSessionId.value) return
  if (chatSaveTimer) window.clearTimeout(chatSaveTimer)
  chatSaveTimer = window.setTimeout(() => {
    queueSaveChatSession(buildChatSessionPayload(chatMessages.value, { resetSuggestion }))
  }, 650)
}

const loadChatSessions = async (ensureSession = false) => {
  loadingChatSessions.value = true

  try {
    chatSessions.value = await getGeoPromptEngineV2VersionDraftSessions()

    if (selectedChatSessionId.value) {
      const matched = chatSessions.value.find((item) => item.id === selectedChatSessionId.value)
      if (matched) {
        await selectChatSession(matched.id)
        return
      }
    }

    if (chatSessions.value.length > 0) {
      await selectChatSession(chatSessions.value[0].id)
      return
    }

    if (ensureSession) {
      await createChatSession()
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'AI 对话会话加载失败')
  } finally {
    loadingChatSessions.value = false
  }
}

const openChatDialog = async () => {
  chatDialogVisible.value = true
  if (!providerConfig.value) {
    providerConfig.value = await getGeoProviderConfig()
  }
  if (!chatModel.value.trim()) {
    chatModel.value = defaultChatModel.value
  }
  await loadChatSessions(true)
}

const createChatSession = async () => {
  creatingChatSession.value = true

  try {
    const session = await createGeoPromptEngineV2VersionDraftSession({
      title: 'AI 建版会话',
      model: normalizeChatModel(chatModel.value || defaultChatModel.value),
      ownerUserId: appStore.currentUser.id || null,
      ownerName: appStore.currentUser.name || appStore.currentUser.username || '',
      messages: [],
    })

    updateChatSessionInList(session)
    applyChatSessionToForm(session)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '会话创建失败')
  } finally {
    creatingChatSession.value = false
  }
}

const selectChatSession = async (id: number) => {
  if (chatStreaming.value || selectedChatSessionId.value === id) return

  try {
    const session = await getGeoPromptEngineV2VersionDraftSession(id)
    updateChatSessionInList(session)
    applyChatSessionToForm(session)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '会话读取失败')
  }
}

const setChatInputMode = (mode: InputMode) => {
  chatInputMode.value = mode
  scheduleSaveChatSession(true)
}

const resetChatDraft = async () => {
  if (!selectedChatSessionId.value) return

  try {
    await ElMessageBox.confirm('确定清空当前会话里的聊天消息吗？文章和补充要求会保留。', '清空消息', {
      type: 'warning',
      confirmButtonText: '清空',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  chatMessages.value = []
  chatInput.value = ''
  await queueSaveChatSession(buildChatSessionPayload([], { resetSuggestion: true }))
  ElMessage.success('聊天消息已清空')
}

const removeChatSession = async () => {
  if (!selectedChatSessionId.value) return

  try {
    await ElMessageBox.confirm(`确定删除「${chatSessionTitle.value || 'AI 建版会话'}」吗？`, '删除会话', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  try {
    const removedId = selectedChatSessionId.value
    await deleteGeoPromptEngineV2VersionDraftSession(removedId)
    chatSessions.value = chatSessions.value.filter((item) => item.id !== removedId)
    selectedChatSessionId.value = null
    chatSessionTitle.value = ''
    chatArticleText.value = ''
    chatArticleUrl.value = ''
    chatNotes.value = ''
    chatModel.value = defaultChatModel.value
    chatVersionName.value = ''
    chatMessages.value = []
    chatInput.value = ''

    if (chatSessions.value.length > 0) {
      await selectChatSession(chatSessions.value[0].id)
    }

    ElMessage.success('会话已删除')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '会话删除失败')
  }
}

const sendChatMessage = async () => {
  if (!selectedChatSessionId.value) {
    ElMessage.warning('请先新建或选择一个会话')
    return
  }

  if (!chatInput.value.trim()) {
    ElMessage.warning('先输入你想和模型讨论的内容')
    return
  }

  const userMessage: GeoPromptEngineVersionDraftMessage = {
    role: 'user',
    content: chatInput.value.trim(),
    createdAt: new Date().toISOString(),
  }
  const nextMessages = [...chatMessages.value, userMessage]

  chatMessages.value = nextMessages
  chatInput.value = ''
  chatStreaming.value = true

  try {
    await queueSaveChatSession(buildChatSessionPayload(nextMessages, { resetSuggestion: true }))
  } catch (error) {
    chatMessages.value = chatMessages.value.slice(0, -1)
    chatInput.value = userMessage.content
    chatStreaming.value = false
    ElMessage.error(error instanceof Error ? error.message : '会话保存失败，请稍后重试')
    return
  }

  const assistantMessage: GeoPromptEngineVersionDraftMessage = {
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString(),
  }
  chatMessages.value = [...chatMessages.value, assistantMessage]

  let streamError = ''
  let lastSnapshotAt = 0

  try {
    await streamGeoPromptEngineV2VersionDraftSessionChat(selectedChatSessionId.value, {
      onEvent: (event) => {
        if (event.type === 'text') {
          assistantMessage.content += event.content ?? ''
          chatMessages.value = [...chatMessages.value.slice(0, -1), { ...assistantMessage }]

          const now = Date.now()
          if (now - lastSnapshotAt > 1200) {
            lastSnapshotAt = now
            queueSaveChatSession(buildChatSessionPayload(chatMessages.value))
          }
          return
        }

        if (event.type === 'error') {
          streamError = event.content ?? '对话生成失败'
        }
      },
    })

    if (streamError) {
      throw new Error(streamError)
    }
  } catch (error) {
    if (!assistantMessage.content.trim()) {
      chatMessages.value = chatMessages.value.slice(0, -1)
    }
    ElMessage.error(error instanceof Error ? error.message : '对话生成失败')
  } finally {
    try {
      await queueSaveChatSession(buildChatSessionPayload(chatMessages.value))
    } catch (error) {
      ElMessage.error(error instanceof Error ? `对话已生成，但保存失败：${error.message}` : '对话已生成，但保存失败')
    } finally {
      chatStreaming.value = false
    }
  }
}

const applySuggestionToForm = (suggestion: {
  suggestedName: string
  suggestedDescription: string
  suggestedRuleText: string
}, source: DraftSource, nameOverride = '', sourceUrl = '', sourceText = '') => {
  const versionName = nameOverride.trim() || suggestion.suggestedName.trim() || 'AI 建版规则'
  const articleUrl = sourceUrl.trim()
  const articleText = sourceText.trim()

  selectedVersionKey.value = null
  form.id = null
  form.name = versionName
  form.description = suggestion.suggestedDescription.trim()
  form.articleUrl = articleUrl
  form.articleText = articleText
  form.ruleText = suggestion.suggestedRuleText
  form.isActive = true
  form.sortOrder = versions.value.length
  draftSource.value = source
}

const getUrlModeSourceUrl = () => {
  return chatInputMode.value === 'url' ? chatArticleUrl.value.trim() : ''
}

const getTextModeSourceText = () => {
  return chatInputMode.value === 'text' ? chatArticleText.value.trim() : ''
}

const applyStoredChatSuggestionToForm = (session: GeoPromptEngineVersionDraftSession, sourceUrl = '', sourceText = '') => {
  if (!session.suggestedRuleText.trim()) return false

  applySuggestionToForm(
    {
      suggestedName: session.suggestedName || session.title || 'AI 建版规则',
      suggestedDescription: session.suggestedDescription,
      suggestedRuleText: session.suggestedRuleText,
    },
    'ai_chat',
    chatVersionName.value || session.suggestedName,
    sourceUrl,
    sourceText || session.articleText
  )

  return true
}

const applyChatDraft = async () => {
  if (!selectedChatSessionId.value) {
    ElMessage.warning('请先新建或选择一个会话')
    return
  }

  if (chatMessages.value.length === 0) {
    ElMessage.warning('先和模型聊出一版可用规则，再应用到草稿')
    return
  }

  applyingChatDraft.value = true

  try {
    const sourceUrl = getUrlModeSourceUrl()
    const sourceText = getTextModeSourceText()
    const savedSession = await queueSaveChatSession()
    const currentSession = savedSession ?? selectedChatSession.value

    if (currentSession && applyStoredChatSuggestionToForm(currentSession, sourceUrl, sourceText)) {
      await loadChatSessions()
      chatDialogVisible.value = false
      ElMessage.success('AI 对话结果已应用到版本草稿')
      return
    }

    const suggestion = await applyGeoPromptEngineV2VersionDraftSession(selectedChatSessionId.value)

    chatVersionName.value = chatVersionName.value.trim() || suggestion.suggestedName
    applySuggestionToForm(suggestion, 'ai_chat', chatVersionName.value, sourceUrl, sourceText)
    await loadChatSessions()
    chatDialogVisible.value = false
    ElMessage.success('AI 对话结果已应用到版本草稿')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '应用 AI 对话结果失败')
  } finally {
    applyingChatDraft.value = false
  }
}

const saveChatSessionAsVersion = async () => {
  if (!selectedChatSessionId.value) {
    ElMessage.warning('请先新建或选择一个会话')
    return
  }

  const sourceUrl = getUrlModeSourceUrl()
  const sourceText = getTextModeSourceText()
  await queueSaveChatSession()
  const currentSession = selectedChatSession.value

  if (currentSession && applyStoredChatSuggestionToForm(currentSession, sourceUrl, sourceText)) {
    const saved = await saveVersion()
    if (saved) chatDialogVisible.value = false
    return
  }

  if (chatMessages.value.length === 0) {
    ElMessage.warning('先和模型聊出一版可用规则，再保存为正式版本')
    return
  }

  applyingChatDraft.value = true

  try {
    const suggestion = await applyGeoPromptEngineV2VersionDraftSession(selectedChatSessionId.value)

    chatVersionName.value = chatVersionName.value.trim() || suggestion.suggestedName
    applySuggestionToForm(suggestion, 'ai_chat', chatVersionName.value, sourceUrl, sourceText)
    await loadChatSessions()

    const saved = await saveVersion()
    if (saved) chatDialogVisible.value = false
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存 AI 对话版本失败')
  } finally {
    applyingChatDraft.value = false
  }
}

const triggerImport = () => {
  fileInputRef.value?.click()
}

const handleFileImport = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  try {
    const content = await file.text()
    const suggestion = await importGeoPromptEngineV2VersionDraft({
      fileName: file.name,
      content,
    })

    applySuggestionToForm(suggestion, 'markdown_import')
    ElMessage.success('Markdown 已解析为版本草稿')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'Markdown 解析失败')
  } finally {
    input.value = ''
  }
}

const formatDisplayTime = (value: string) => {
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  })
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.visually-hidden {
  position: fixed;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.prompt-version-layout {
  display: grid;
  gap: 20px;
}

.prompt-version-workbench {
  display: grid;
  grid-template-columns: minmax(320px, 0.7fr) minmax(0, 1.3fr);
  gap: 20px;
  align-items: start;
}

.prompt-version-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.prompt-version-card-head h3 {
  margin: 0;
  font-size: 18px;
  color: #4f3c41;
}

.prompt-version-card-head p {
  margin: 7px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: #7c686d;
}

.prompt-version-card-head--top {
  align-items: center;
}

.prompt-version-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.prompt-version-inline-note {
  margin-top: 12px;
  font-size: 12px;
  line-height: 1.7;
  color: #8f7a7f;
}

.prompt-version-inline-note--block {
  margin: 0 0 12px;
}

.prompt-version-note-list {
  margin: 8px 0 0;
  padding-left: 18px;
}

.prompt-version-note-list li + li {
  margin-top: 6px;
}

.dialog-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.dialog-form-grid > :deep(.el-form-item:only-child) {
  grid-column: 1 / -1;
}

.prompt-version-inline-note--plain {
  margin-top: 4px;
}

.prompt-version-list {
  display: grid;
  gap: 12px;
}

.prompt-version-folder-tree {
  display: grid;
  gap: 16px;
}

.prompt-version-folder {
  display: grid;
  gap: 10px;
  padding: 10px;
  border: 1px solid rgba(209, 110, 119, 0.13);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255, 247, 246, 0.92), rgba(255, 252, 251, 0.7));
}

.prompt-version-folder__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(209, 110, 119, 0.22);
  border-radius: 11px;
  background: #fff1f1;
  box-shadow: inset 4px 0 0 rgba(209, 110, 119, 0.56);
}

.prompt-version-folder__head strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #4d393e;
  font-size: 15px;
  font-weight: 800;
}

.prompt-version-folder__branch {
  display: grid;
  gap: 8px;
  margin-left: 8px;
  padding: 10px 0 0 12px;
  border-left: 3px solid rgba(209, 110, 119, 0.22);
}

.prompt-version-folder__branch-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 28px;
  padding: 4px 8px;
  border-radius: 8px;
  color: #735c63;
  background: rgba(255, 241, 241, 0.78);
  font-size: 13px;
}

.prompt-version-folder__branch-head span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 800;
}

.prompt-version-folder__branch-head em {
  min-width: 24px;
  padding: 2px 7px;
  border-radius: 999px;
  text-align: center;
  font-style: normal;
  color: #c95a62;
  background: #fffafa;
  border: 1px solid rgba(209, 110, 119, 0.16);
}

.prompt-version-list-item {
  padding: 13px;
  text-align: left;
  border: 1px solid rgba(226, 207, 202, 0.78);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.84);
  transition:
    border-color 0.22s ease,
    box-shadow 0.22s ease,
    transform 0.22s ease;
}

.prompt-version-list-item--legacy {
  background: linear-gradient(135deg, rgba(255, 247, 239, 0.98), rgba(255, 252, 250, 0.95));
}

.prompt-version-list-item:hover,
.prompt-version-list-item.active {
  border-color: rgba(209, 110, 119, 0.32);
  box-shadow: 0 12px 26px rgba(170, 110, 110, 0.12);
  transform: translateY(-1px);
}

.prompt-version-list-item__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.prompt-version-list-item__meta {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  font-size: 12px;
  color: #8a7479;
}

.prompt-version-list-item p {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.75;
  color: #6d5a5f;
}

.version-chat-layout {
  display: grid;
  grid-template-columns: minmax(240px, 0.62fr) minmax(280px, 0.8fr) minmax(0, 1.35fr);
  gap: 18px;
}

.version-chat-session-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  min-height: 560px;
}

.version-chat-session-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.version-chat-session-head strong {
  display: block;
  color: #4f3c41;
}

.version-chat-session-head p {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #8a7479;
}

.version-chat-session-list {
  display: grid;
  align-content: start;
  gap: 10px;
  max-height: 520px;
  overflow: auto;
  padding-right: 4px;
}

.version-chat-session-item {
  padding: 13px;
  text-align: left;
  border: 1px solid rgba(226, 207, 202, 0.78);
  border-radius: 16px;
  background: rgba(255, 251, 250, 0.95);
  transition:
    border-color 0.22s ease,
    box-shadow 0.22s ease,
    transform 0.22s ease;
}

.version-chat-session-item:hover,
.version-chat-session-item.active {
  border-color: rgba(209, 110, 119, 0.34);
  box-shadow: 0 10px 22px rgba(170, 110, 110, 0.12);
  transform: translateY(-1px);
}

.version-chat-session-item__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.version-chat-session-item__top strong {
  font-size: 13px;
  line-height: 1.45;
  color: #4f3c41;
}

.version-chat-session-item__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  font-size: 11px;
  color: #927d82;
}

.version-chat-session-item p {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.65;
  color: #6d5a5f;
}

.version-chat-sidebar {
  display: grid;
  align-content: start;
  gap: 12px;
}

.version-chat-main {
  display: grid;
  gap: 12px;
}

.version-chat-stream {
  display: grid;
  gap: 10px;
  min-height: 320px;
  max-height: 420px;
  padding: 14px;
  overflow: auto;
  border-radius: 18px;
  background: rgba(255, 249, 247, 0.92);
  border: 1px solid rgba(231, 204, 198, 0.78);
}

.version-chat-bubble {
  padding: 12px 14px;
  border-radius: 16px;
}

.version-chat-bubble strong {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: #5c474c;
}

.version-chat-bubble p {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.75;
}

.version-chat-bubble--user {
  background: rgba(255, 239, 236, 0.94);
}

.version-chat-bubble--assistant {
  background: rgba(255, 253, 252, 0.96);
  border: 1px solid rgba(228, 210, 206, 0.76);
}

.version-chat-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
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
}

.geo-mode-switch__item.active {
  color: #c95a62;
  border-color: rgba(217, 107, 114, 0.2);
  background: rgba(255, 252, 251, 0.95);
}

@media (max-width: 1400px) {
  .prompt-version-workbench,
  .version-chat-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .dialog-form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
