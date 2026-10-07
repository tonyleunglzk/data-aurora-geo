<template>
  <section class="geo-v3-page">
    <article class="surface-card section-card geo-v3-generate reveal-up">
      <div class="geo-v3-generate__main">
        <div class="geo-v3-form-head">
          <div>
            <h3>{{ pageTitle }}</h3>
            <p>{{ pageDescription }}</p>
          </div>
          <div class="geo-v3-actions">
            <el-tag :type="fixedRulesMode === 'SYSTEM' ? 'success' : 'warning'" effect="light" round>
              {{ fixedRulesModeLabel }}
            </el-tag>
            <el-button :loading="loadingOptions" plain @click="loadOptions">刷新配置</el-button>
          </div>
        </div>

        <el-alert
          v-if="fixedRulesMode === 'NONE'"
          class="geo-v3-mode-alert"
          title="纯版本生成不会叠加 V3 系统级固定规则"
          description="本模式只使用当前版本规则、绑定变量池、主推产品素材和基础防泄漏规则；适合对比测试更自由的 Prompt。"
          show-icon
          type="warning"
        />

        <el-form label-position="top">
          <div class="geo-v3-form-grid geo-v3-form-grid--three">
            <el-form-item label="生成方式">
              <el-segmented
                v-model="form.versionMode"
                :options="versionModeOptions"
                style="width: 100%"
                @change="handleVersionModeChange"
              />
            </el-form-item>
            <el-form-item :label="form.versionMode === 'multiple' ? 'V3 版本（可多选）' : 'V3 版本'">
              <el-cascader
                v-if="form.versionMode === 'single'"
                v-model="form.versionId"
                :options="activeVersionCascaderOptions"
                :props="singleVersionCascaderProps"
                filterable
                placeholder="选择版本"
                style="width: 100%"
                @change="handleVersionChange"
              />
              <el-cascader
                v-else
                v-model="form.versionIds"
                :collapse-tags="true"
                :collapse-tags-tooltip="true"
                :max-collapse-tags="2"
                :options="activeVersionCascaderOptions"
                :props="multiVersionCascaderProps"
                clearable
                filterable
                placeholder="选择多个版本"
                style="width: 100%"
                @change="handleMultiVersionChange"
              />
            </el-form-item>
            <el-form-item label="版本绑定变量池">
              <el-input
                :model-value="selectedVariableSetSummary"
                disabled
              />
            </el-form-item>
            <el-form-item label="主推产品">
              <el-select v-model="form.productProfileId" clearable filterable placeholder="请选择主推产品" style="width: 100%">
                <el-option
                  v-for="item in activeProducts"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
              <div v-if="!form.productProfileId" class="geo-v3-form-tip is-warning">
                请选择本次主推产品，未选择时不会创建生成任务。
              </div>
            </el-form-item>
            <el-form-item class="geo-v3-version-note" label="版本备注">
              <el-input
                v-if="form.versionMode === 'single'"
                :model-value="selectedVersionNote"
                :rows="2"
                readonly
                resize="none"
                type="textarea"
              />
              <div v-else class="geo-v3-version-note-list">
                <div v-for="item in selectedVersionNoteRows" :key="item.id">
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.note }}</span>
                </div>
              </div>
            </el-form-item>
          </div>

          <el-form-item label="竞对文章">
            <div class="geo-v3-article-input">
              <el-radio-group v-model="form.inputMode" size="small" @change="handleInputModeChange">
                <el-radio-button label="text">粘贴正文</el-radio-button>
                <el-radio-button label="url">输入 URL</el-radio-button>
              </el-radio-group>
              <el-input
                v-if="form.inputMode === 'text'"
                v-model="form.articleText"
                :rows="8"
                placeholder="把竞对文章正文粘贴到这里"
                resize="vertical"
                type="textarea"
              />
              <el-input
                v-else
                v-model="form.articleUrl"
                clearable
                placeholder="https://..."
              />
            </div>
          </el-form-item>

          <div class="geo-v3-form-grid geo-v3-form-grid--count">
            <el-form-item label="生成数量">
              <el-input-number v-model="form.count" :max="50" :min="1" style="width: 100%" />
            </el-form-item>
            <el-form-item label="本次主题">
              <el-input v-model="form.topic" clearable placeholder="可选，如：2026 年冲锋衣选购指南" />
            </el-form-item>
          </div>

          <el-form-item label="本次补充要求">
            <el-input
              v-model="form.extraRequirements"
              :rows="4"
              placeholder="可选，只影响本次生成"
              resize="vertical"
              type="textarea"
            />
          </el-form-item>
        </el-form>
      </div>

      <aside class="geo-v3-generate__side">
        <div class="geo-v3-stat">
          <strong>{{ activeVersions.length }}</strong>
          <span>可用版本</span>
        </div>
        <div class="geo-v3-stat">
          <strong>{{ selectedVariableStatCount }}</strong>
          <span>{{ form.versionMode === 'multiple' ? '已选版本变量' : '当前版本变量' }}</span>
        </div>
        <div class="geo-v3-stat">
          <strong>{{ activeProducts.length }}</strong>
          <span>可用产品</span>
        </div>
        <div class="geo-v3-stat">
          <strong>{{ fixedRulesMode === 'SYSTEM' ? '标准' : '纯版' }}</strong>
          <span>固定规则</span>
        </div>
        <el-button
          :disabled="!canGenerate"
          :loading="generating"
          type="primary"
          @click="generate"
        >
          {{ generateButtonText }}
        </el-button>
      </aside>
    </article>

    <article v-if="runs.length" class="surface-card section-card reveal-up" style="--delay: 0.08s">
      <div class="geo-v3-form-head">
        <div>
          <h3>{{ resultTitle }}</h3>
          <p>{{ resultSummary }}</p>
        </div>
      </div>

      <div class="geo-v3-result-run-list">
        <section v-for="resultRun in runs" :key="resultRun.id" class="geo-v3-result-run">
          <div class="geo-v3-form-head geo-v3-result-run__head">
            <div>
              <h3>#{{ resultRun.id }} · {{ resultRun.versionName }}</h3>
              <p>{{ resultRun.variableSetName }} · {{ resultRun.productProfileName }} · {{ getFixedRulesModeLabel(resultRun.fixedRulesMode) }}</p>
            </div>
            <div class="geo-v3-actions">
              <el-tag :type="getRunStatusType(resultRun.status)" effect="light" round>
                {{ getRunStatusLabel(resultRun.status) }}
              </el-tag>
              <el-button :disabled="!getFirstPrompt(resultRun)" plain @click="copyPrompt(resultRun)">复制首条</el-button>
              <el-button :disabled="!resultRun.canDownload" type="primary" @click="downloadRun(resultRun)">下载 ZIP</el-button>
            </div>
          </div>

          <div class="geo-v3-result-metrics">
            <div>
              <strong>{{ resultRun.requestedCount }}</strong>
              <span>请求数量</span>
            </div>
            <div>
              <strong>{{ resultRun.successCount }}</strong>
              <span>成功</span>
            </div>
            <div>
              <strong>{{ resultRun.failedCount }}</strong>
              <span>失败</span>
            </div>
            <div>
              <strong>{{ resultRun.mode === 'BATCH' ? '批量' : '单条' }}</strong>
              <span>生成模式</span>
            </div>
          </div>

          <el-table :data="resultRun.items || []" empty-text="暂无生成明细">
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="geo-v3-expand">
                  <h4>本条 Prompt</h4>
                  <pre>{{ row.promptText || getItemPlaceholderText(row) }}</pre>
                  <div class="geo-v3-snapshot-grid">
                    <section>
                      <h4>抽中的差异化内容</h4>
                      <ul>
                        <li v-for="value in flattenSelectedVariables(row)" :key="value">{{ value }}</li>
                      </ul>
                    </section>
                    <section>
                      <h4>抽中的产品内容</h4>
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
            <el-table-column label="Prompt 预览" min-width="360">
              <template #default="{ row }">{{ getPromptPreview(row) }}</template>
            </el-table-column>
          </el-table>

          <div v-if="resultRun.lastError" class="geo-v3-run-error">
            {{ resultRun.lastError }}
          </div>
        </section>
      </div>
    </article>
  </section>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import { buildGeoVersionCascaderOptions } from '@/utils/geoVersionGroups'
import {
  downloadGeoV3Run,
  generateGeoV3Prompts,
  getGeoV3Run,
  getGeoV3Products,
  getGeoV3Versions,
} from '@/api/geo'
import type {
  GeoV3GenerationItem,
  GeoV3GenerationRun,
  GeoV3FixedRulesMode,
  GeoV3ItemStatus,
  GeoV3Product,
  GeoV3RunStatus,
  GeoV3Version,
} from '@/types/geo'

const route = useRoute()
const versions = ref<GeoV3Version[]>([])
const products = ref<GeoV3Product[]>([])
const runs = ref<GeoV3GenerationRun[]>([])
const loadingOptions = ref(false)
const generating = ref(false)
let runRefreshTimer: number | undefined

const form = reactive({
  versionMode: 'single' as 'single' | 'multiple',
  inputMode: 'text' as 'text' | 'url',
  articleText: '',
  articleUrl: '',
  versionId: 0,
  versionIds: [] as number[],
  productProfileId: 0,
  count: 10,
  topic: '',
  extraRequirements: '',
})

const versionModeOptions = [
  { label: '单版本', value: 'single' },
  { label: '多版本', value: 'multiple' },
]

const fixedRulesMode = computed<GeoV3FixedRulesMode>(() => (
  route.name === 'geo-v3-generate-lite' ? 'NONE' : 'SYSTEM'
))
const pageTitle = computed(() => fixedRulesMode.value === 'NONE' ? '纯版本生成' : 'Prompt 生成')
const pageDescription = computed(() => fixedRulesMode.value === 'NONE'
  ? '输入竞对文章，选择 V3 版本和主推产品；本次不叠加 V3 系统级固定规则，只使用版本规则、变量池和产品素材生成 Prompt。'
  : '输入竞对文章，选择 V3 版本和主推产品；后端先抽取变量和素材，再叠加 V3 系统级固定规则精修最终 Prompt。'
)
const fixedRulesModeLabel = computed(() => getFixedRulesModeLabel(fixedRulesMode.value))

const activeVersions = computed(() => versions.value.filter((item) => item.isActive))
const singleVersionCascaderProps = {
  emitPath: false,
  expandTrigger: 'hover',
} as const
const multiVersionCascaderProps = {
  emitPath: false,
  expandTrigger: 'hover',
  multiple: true,
} as const
const activeVersionCascaderOptions = computed(() => (
  buildGeoVersionCascaderOptions(activeVersions.value, (item) => item.name, (item) => item.id)
))
const activeProducts = computed(() => products.value.filter((item) => item.isActive))
const selectedVersion = computed(() => activeVersions.value.find((item) => item.id === form.versionId) ?? null)
const selectedVersionIds = computed(() => {
  if (form.versionMode === 'single') return form.versionId > 0 ? [form.versionId] : []

  return [...new Set(form.versionIds)].filter((id) => id > 0)
})
const selectedVersions = computed(() => (
  selectedVersionIds.value
    .map((id) => activeVersions.value.find((item) => item.id === id))
    .filter((item): item is GeoV3Version => Boolean(item))
))
const selectedVersionNote = computed(() => {
  if (!selectedVersion.value) return '选择 V3 版本后显示对应备注'

  return selectedVersion.value.notes.trim() || '当前版本暂未填写备注'
})
const selectedVersionNoteRows = computed(() => {
  if (selectedVersions.value.length === 0) {
    return [{ id: 0, name: '未选择版本', note: '选择多个 V3 版本后显示对应备注' }]
  }

  return selectedVersions.value.map((item) => ({
    id: item.id,
    name: item.name,
    note: item.notes.trim() || '当前版本暂未填写备注',
  }))
})
const selectedVariableSet = computed(() => {
  return selectedVersion.value?.variableSets?.find((item) => item.isActive) ?? null
})
const selectedVariableSets = computed(() => (
  selectedVersions.value
    .map((item) => item.variableSets?.find((variableSet) => variableSet.isActive) ?? null)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
))
const missingVariableSetVersions = computed(() => (
  selectedVersions.value.filter((item) => !item.variableSets?.some((variableSet) => variableSet.isActive))
))
const selectedVariableSetSummary = computed(() => {
  if (form.versionMode === 'single') {
    return selectedVariableSet.value?.name || '当前版本未绑定启用变量池'
  }

  if (selectedVersions.value.length === 0) return '请选择多个版本'
  if (missingVariableSetVersions.value.length > 0) {
    return `缺少变量池：${missingVariableSetVersions.value.map((item) => item.name).join('、')}`
  }

  return `已选择 ${selectedVersions.value.length} 个版本，均已绑定启用变量池`
})
const selectedVariableStatCount = computed(() => (
  form.versionMode === 'multiple'
    ? selectedVariableSets.value.reduce((total, item) => total + item.items.length, 0)
    : selectedVariableSet.value?.items.length ?? 0
))
const canGenerate = computed(() => (
  selectedVersionIds.value.length > 0
  && selectedVersions.value.length === selectedVersionIds.value.length
  && missingVariableSetVersions.value.length === 0
  && form.productProfileId > 0
))
const generateButtonText = computed(() => {
  if (form.versionMode === 'multiple') return `多版本生成 ${selectedVersionIds.value.length} × ${form.count} 篇`
  return form.count > 1 ? '批量生成 Prompt' : '生成 Prompt'
})
const resultTitle = computed(() => {
  if (runs.value.length === 1) return `本次结果 #${runs.value[0].id}`
  return `本次结果（${runs.value.length} 个版本）`
})
const resultSummary = computed(() => {
  if (runs.value.length === 1) {
    const item = runs.value[0]
    return `${item.versionName} · ${item.variableSetName} · ${item.productProfileName} · ${getFixedRulesModeLabel(item.fixedRulesMode)}`
  }

  const requestedCount = runs.value.reduce((total, item) => total + item.requestedCount, 0)
  const successCount = runs.value.reduce((total, item) => total + item.successCount, 0)
  const failedCount = runs.value.reduce((total, item) => total + item.failedCount, 0)
  return `共 ${requestedCount} 篇 · 成功 ${successCount} · 失败 ${failedCount}`
})

const applyVersionArticleSource = (versionId: number, force = false) => {
  const version = activeVersions.value.find((item) => item.id === versionId)

  if (form.inputMode === 'text') {
    const sourceArticleText = version?.sourceArticleText?.trim() ?? ''
    if (!sourceArticleText && !force) return

    const hasArticleText = Boolean(form.articleText.trim())
    if (!force && hasArticleText) return

    form.articleText = sourceArticleText
    return
  }

  const sourceArticleUrl = version?.sourceArticleUrl?.trim() ?? ''
  if (!sourceArticleUrl && !force) return

  const hasArticleUrl = Boolean(form.articleUrl.trim())
  if (!force && hasArticleUrl) return

  form.articleUrl = sourceArticleUrl
}

const handleVersionChange = () => {
  applyVersionArticleSource(form.versionId, true)
}

const handleMultiVersionChange = () => {
  const firstVersionId = form.versionIds[0] ?? 0
  if (firstVersionId > 0) applyVersionArticleSource(firstVersionId)
}

const handleVersionModeChange = () => {
  if (form.versionMode === 'multiple') {
    form.versionIds = selectedVersionIds.value.length > 0 ? selectedVersionIds.value : [form.versionId].filter((id) => id > 0)
    handleMultiVersionChange()
    return
  }

  form.versionId = form.versionIds[0] ?? form.versionId
  if (form.versionId > 0) applyVersionArticleSource(form.versionId)
}

const handleInputModeChange = () => {
  applyVersionArticleSource(selectedVersionIds.value[0] ?? form.versionId, true)
}

const loadOptions = async () => {
  loadingOptions.value = true
  try {
    const [versionList, productList] = await Promise.all([
      getGeoV3Versions(),
      getGeoV3Products(),
    ])
    versions.value = versionList
    products.value = productList
    const hadVersionId = form.versionId > 0
    form.versionId ||= activeVersions.value[0]?.id ?? 0
    if (form.versionIds.length === 0 && form.versionId > 0) {
      form.versionIds = [form.versionId]
    }
    if (!activeProducts.value.some((item) => item.id === form.productProfileId)) {
      form.productProfileId = 0
    }
    applyVersionArticleSource(form.versionId, !hadVersionId)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'V3 配置加载失败')
  } finally {
    loadingOptions.value = false
  }
}

const generate = async () => {
  if (!canGenerate.value) {
    ElMessage.warning(missingVariableSetVersions.value.length > 0 ? '已选版本中存在未绑定启用变量池的版本' : '请先选择版本和主推产品')
    return
  }

  const articlePayload = form.inputMode === 'text'
    ? { articleText: form.articleText.trim() }
    : { articleUrl: form.articleUrl.trim() }

  if (!articlePayload.articleText && !articlePayload.articleUrl) {
    ElMessage.warning('请先输入竞对文章正文或 URL')
    return
  }

  generating.value = true
  runs.value = []
  try {
    const failedMessages: string[] = []

    for (const versionId of selectedVersionIds.value) {
      const version = activeVersions.value.find((item) => item.id === versionId)
      try {
        const nextRun = await generateGeoV3Prompts({
          ...articlePayload,
          versionId,
          productProfileId: form.productProfileId,
          count: form.count,
          topic: form.topic,
          extraRequirements: form.extraRequirements,
          fixedRulesMode: fixedRulesMode.value,
        })
        upsertRun(nextRun)
      } catch (error) {
        failedMessages.push(`${version?.name || `版本 ${versionId}`}：${error instanceof Error ? error.message : '生成失败'}`)
      }
    }

    if (runs.value.length === 0 && failedMessages.length > 0) {
      ElMessage.error(failedMessages[0] || '生成失败')
      return
    }

    if (failedMessages.length > 0) {
      ElMessage.warning(`已创建 ${runs.value.length} 个版本任务，${failedMessages.length} 个版本创建失败`)
    } else if (runs.value.some((item) => item.status === 'RUNNING')) {
      ElMessage.success(runs.value.length > 1 ? '多版本批量任务已开始，可到生成记录查看进度' : '批量任务已开始，可到生成记录查看进度')
    } else if (runs.value.some((item) => item.status === 'PARTIAL_FAILED')) {
      ElMessage.warning('部分 Prompt 生成失败，已保留成功结果')
    } else if (runs.value.some((item) => item.status === 'FAILED')) {
      ElMessage.error(runs.value.find((item) => item.status === 'FAILED')?.lastError || '生成失败')
    } else {
      ElMessage.success(form.versionMode === 'multiple' ? '多版本 Prompt 已生成' : (form.count > 1 ? '批量 Prompt 已生成' : 'Prompt 已生成'))
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '生成失败')
  } finally {
    generating.value = false
  }
}

const upsertRun = (nextRun: GeoV3GenerationRun) => {
  const index = runs.value.findIndex((item) => item.id === nextRun.id)
  if (index >= 0) {
    runs.value.splice(index, 1, nextRun)
    return
  }

  runs.value.push(nextRun)
}

const refreshRunningRuns = async () => {
  const runningRuns = runs.value.filter((item) => item.status === 'RUNNING')
  if (runningRuns.length === 0) return

  for (const item of runningRuns) {
    try {
      upsertRun(await getGeoV3Run(item.id))
    } catch {
      // 下一轮轮询继续刷新，避免重复弹错误提示干扰用户查看结果。
    }
  }
}

const getFirstPrompt = (targetRun: GeoV3GenerationRun) => {
  return targetRun.items?.find((item) => item.status === 'SUCCEEDED' && item.promptText.trim())?.promptText || ''
}

const copyPrompt = async (targetRun: GeoV3GenerationRun) => {
  const prompt = getFirstPrompt(targetRun)
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
      ElMessage.success('首条 Prompt 已复制')
      return
    }

    if (fallbackCopyText(prompt)) {
      ElMessage.success('首条 Prompt 已复制')
      return
    }

    ElMessage.error('复制失败，请手动展开并选择文本')
  } catch {
    if (fallbackCopyText(prompt)) {
      ElMessage.success('首条 Prompt 已复制')
      return
    }

    ElMessage.error('复制失败，请手动展开并选择文本')
  }
}

const downloadRun = async (targetRun: GeoV3GenerationRun) => {
  try {
    const { blob, fileName } = await downloadGeoV3Run(targetRun.id)
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

const getFixedRulesModeLabel = (mode?: GeoV3FixedRulesMode) => {
  return mode === 'NONE' ? '纯版本模式' : '标准模式'
}

const getRunStatusType = (status: GeoV3RunStatus) => {
  if (status === 'COMPLETED') return 'success'
  if (status === 'FAILED') return 'danger'
  return 'warning'
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

const getPromptPreview = (item: GeoV3GenerationItem) => {
  if (item.promptText) return `${item.promptText.slice(0, 120)}...`
  return getItemPlaceholderText(item)
}

onMounted(() => {
  void loadOptions()
  runRefreshTimer = window.setInterval(() => {
    void refreshRunningRuns()
  }, 5000)
})

onBeforeUnmount(() => {
  if (runRefreshTimer) window.clearInterval(runRefreshTimer)
})
</script>

<style scoped>
.geo-v3-page {
  display: grid;
  gap: 14px;
}

.geo-v3-generate {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 18px;
  align-items: stretch;
}

.geo-v3-generate__main {
  min-width: 0;
}

.geo-v3-generate__side {
  display: grid;
  gap: 10px;
  align-content: start;
  padding: 12px;
  border: 1px solid rgba(217, 107, 114, 0.14);
  border-radius: 8px;
  background: #fff8f7;
}

.geo-v3-form-head,
.geo-v3-actions {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.geo-v3-form-head h3 {
  margin: 0 0 6px;
  font-size: 16px;
  color: var(--brand-ink);
}

.geo-v3-form-head p {
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

.geo-v3-mode-alert {
  margin: 12px 0 4px;
}

.geo-v3-form-grid {
  display: grid;
  gap: 14px;
}

.geo-v3-form-grid--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.geo-v3-version-note {
  grid-column: 1 / -1;
}

.geo-v3-form-tip {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
}

.geo-v3-form-tip.is-warning {
  color: #b25a20;
}

.geo-v3-version-note-list,
.geo-v3-result-run-list {
  display: grid;
  gap: 10px;
}

.geo-v3-version-note-list {
  width: 100%;
  max-height: 180px;
  padding: 10px;
  overflow: auto;
  border: 1px solid rgba(217, 107, 114, 0.14);
  border-radius: 8px;
  background: rgba(255, 250, 249, 0.72);
}

.geo-v3-version-note-list div {
  display: grid;
  grid-template-columns: minmax(140px, 0.26fr) minmax(0, 1fr);
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(217, 107, 114, 0.1);
}

.geo-v3-version-note-list div:last-child {
  border-bottom: 0;
}

.geo-v3-version-note-list strong {
  color: var(--brand-ink);
  font-size: 12px;
}

.geo-v3-version-note-list span {
  color: var(--brand-muted);
  font-size: 12px;
  line-height: 1.6;
}

.geo-v3-form-grid--count {
  grid-template-columns: 180px minmax(0, 1fr);
}

.geo-v3-article-input {
  display: grid;
  width: 100%;
  gap: 10px;
}

.geo-v3-stat,
.geo-v3-result-metrics > div {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid rgba(217, 107, 114, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
}

.geo-v3-stat strong,
.geo-v3-result-metrics strong {
  font-size: 21px;
  color: var(--brand-primary-strong);
}

.geo-v3-stat span,
.geo-v3-result-metrics span {
  font-size: 12px;
  color: var(--brand-muted);
}

.geo-v3-result-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 14px 0;
}

.geo-v3-result-run-list {
  margin-top: 14px;
}

.geo-v3-result-run {
  padding: 12px;
  border: 1px solid rgba(217, 107, 114, 0.14);
  border-radius: 8px;
  background: rgba(255, 250, 249, 0.64);
}

.geo-v3-result-run__head {
  align-items: center;
}

.geo-v3-run-error {
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(217, 107, 114, 0.18);
  border-radius: 8px;
  background: #fff1f1;
  color: var(--brand-primary-strong);
  font-size: 12px;
  line-height: 1.6;
}

.geo-v3-expand {
  display: grid;
  gap: 12px;
  padding: 8px 14px 14px;
}

.geo-v3-expand h4 {
  margin: 0;
  font-size: 13px;
  color: var(--brand-ink);
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

@media (max-width: 1100px) {
  .geo-v3-generate,
  .geo-v3-form-grid--three {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .geo-v3-form-head,
  .geo-v3-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .geo-v3-form-grid--count,
  .geo-v3-result-metrics,
  .geo-v3-snapshot-grid,
  .geo-v3-version-note-list div {
    grid-template-columns: 1fr;
  }
}
</style>
