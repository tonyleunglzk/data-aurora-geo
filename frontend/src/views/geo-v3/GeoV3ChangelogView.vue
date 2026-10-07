<template>
  <section class="geo-v3-changelog">
    <article class="surface-card section-card reveal-up">
      <div class="geo-v3-changelog__head">
        <div>
          <h3>GEO V3 迭代记录</h3>
          <p>这里单独汇总 V3 相关交付，记录会同步进入系统全局迭代记录。</p>
        </div>
        <div class="geo-v3-changelog__actions">
          <el-button :loading="loading" plain @click="loadEntries">刷新</el-button>
          <el-button v-if="appStore.isAdmin" type="primary" @click="openCreateDialog">新增 V3 记录</el-button>
        </div>
      </div>

      <div class="geo-v3-changelog__stats">
        <div>
          <strong>{{ filteredEntries.length }}</strong>
          <span>V3 记录</span>
        </div>
        <div>
          <strong>{{ latestReleaseDate }}</strong>
          <span>最近发布</span>
        </div>
        <div>
          <strong>{{ totalChangeCount }}</strong>
          <span>变更项</span>
        </div>
      </div>
    </article>

    <section class="changelog-layout">
      <article v-loading="loading" class="surface-card section-card reveal-up" style="--delay: 0.08s">
        <div class="changelog-card-head">
          <div>
            <h3>V3 时间线</h3>
            <p>只展示标题、摘要或受影响模块中包含 GEO V3 / Prompt Engine V3 的记录。</p>
          </div>
          <el-tag effect="light" round>{{ filteredEntries.length }} 条</el-tag>
        </div>

        <div v-if="filteredEntries.length > 0" class="changelog-timeline">
          <button
            v-for="entry in filteredEntries"
            :key="entry.id"
            :class="['changelog-timeline-item', { active: selectedEntryId === entry.id }]"
            type="button"
            @click="selectedEntryId = entry.id"
          >
            <div class="changelog-timeline-item__top">
              <strong>{{ entry.title }}</strong>
              <el-tag effect="light" round size="small">{{ entry.batchNo }}</el-tag>
            </div>
            <div class="changelog-timeline-item__meta">
              <span>{{ entry.releaseDate }}</span>
              <span>{{ sourceTypeLabel(entry.sourceType) }}</span>
            </div>
            <p>{{ entry.summary }}</p>
          </button>
        </div>

        <el-empty v-else description="当前还没有 GEO V3 迭代记录。" />
      </article>

      <article v-loading="loading" class="surface-card section-card reveal-up" style="--delay: 0.14s">
        <template v-if="selectedEntry">
          <div class="changelog-card-head changelog-card-head--top">
            <div>
              <h3>{{ selectedEntry.title }}</h3>
              <p>这条记录属于 GEO V3，也会在全局迭代记录中出现。</p>
            </div>
            <div v-if="appStore.isAdmin" class="changelog-actions">
              <el-button plain @click="openEditDialog(selectedEntry)">编辑</el-button>
              <el-button plain type="danger" @click="removeEntry(selectedEntry)">删除</el-button>
            </div>
          </div>

          <div class="changelog-summary-strip">
            <div class="changelog-summary-item">
              <span>批次号</span>
              <strong>{{ selectedEntry.batchNo }}</strong>
            </div>
            <div class="changelog-summary-item">
              <span>发布日期</span>
              <strong>{{ selectedEntry.releaseDate }}</strong>
            </div>
            <div class="changelog-summary-item">
              <span>来源</span>
              <strong>{{ sourceTypeLabel(selectedEntry.sourceType) }}</strong>
            </div>
          </div>

          <div class="changelog-detail-summary">
            {{ selectedEntry.summary }}
          </div>

          <div v-if="selectedEntry.affectedModules.length > 0" class="changelog-module-block">
            <h4>受影响模块</h4>
            <div class="changelog-module-tags">
              <span v-for="item in selectedEntry.affectedModules" :key="item" class="table-tag tag-soft">{{ item }}</span>
            </div>
          </div>

          <div class="changelog-detail-grid">
            <section v-if="selectedEntry.addedItems.length > 0" class="changelog-detail-block">
              <div class="changelog-detail-block__title">
                <span class="status-dot status-dot--add"></span>
                <h4>新增</h4>
              </div>
              <ul>
                <li v-for="item in selectedEntry.addedItems" :key="item">{{ item }}</li>
              </ul>
            </section>

            <section v-if="selectedEntry.changedItems.length > 0" class="changelog-detail-block">
              <div class="changelog-detail-block__title">
                <span class="status-dot status-dot--change"></span>
                <h4>修改</h4>
              </div>
              <ul>
                <li v-for="item in selectedEntry.changedItems" :key="item">{{ item }}</li>
              </ul>
            </section>

            <section v-if="selectedEntry.removedItems.length > 0" class="changelog-detail-block">
              <div class="changelog-detail-block__title">
                <span class="status-dot status-dot--remove"></span>
                <h4>删除</h4>
              </div>
              <ul>
                <li v-for="item in selectedEntry.removedItems" :key="item">{{ item }}</li>
              </ul>
            </section>
          </div>
        </template>

        <el-empty v-else description="先从左侧选择一条 V3 迭代记录。" />
      </article>
    </section>

    <el-dialog v-model="dialogVisible" :title="editingEntry ? '编辑 V3 迭代记录' : '新增 V3 迭代记录'" width="760px">
      <el-form label-position="top">
        <div class="dialog-form-grid">
          <el-form-item label="记录标题">
            <el-input v-model="form.title" placeholder="如：GEO V3 Prompt 生成链路上线" />
          </el-form-item>
          <el-form-item label="发布日期">
            <el-date-picker
              v-model="form.releaseDate"
              style="width: 100%"
              type="date"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
        </div>

        <div class="dialog-form-grid">
          <el-form-item label="来源">
            <el-select v-model="form.sourceType" style="width: 100%">
              <el-option label="手动记录" value="manual" />
              <el-option label="AI 交付总结" value="ai_delivery" />
            </el-select>
          </el-form-item>
          <el-form-item label="受影响模块">
            <el-select
              v-model="form.affectedModules"
              allow-create
              default-first-option
              filterable
              multiple
              placeholder="默认包含 GEO V3"
              style="width: 100%"
            />
          </el-form-item>
        </div>

        <el-form-item label="概述">
          <el-input v-model="form.summary" :rows="4" resize="vertical" type="textarea" />
        </el-form-item>

        <div class="dialog-form-grid dialog-form-grid--triple">
          <el-form-item label="新增（每行一条）">
            <el-input v-model="form.addedText" :rows="7" resize="vertical" type="textarea" />
          </el-form-item>
          <el-form-item label="修改（每行一条）">
            <el-input v-model="form.changedText" :rows="7" resize="vertical" type="textarea" />
          </el-form-item>
          <el-form-item label="删除（每行一条）">
            <el-input v-model="form.removedText" :rows="7" resize="vertical" type="textarea" />
          </el-form-item>
        </div>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button :loading="submitting" type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createChangelogEntry,
  deleteChangelogEntry,
  getChangelogEntries,
  updateChangelogEntry,
} from '@/api/changelog'
import { useAppStore } from '@/stores/app'
import type { ChangelogEntry, ChangelogEntryPayload, ChangelogSourceType } from '@/types/changelog'

const GEO_V3_MODULE = 'GEO V3'

const appStore = useAppStore()
const loading = ref(false)
const submitting = ref(false)
const entries = ref<ChangelogEntry[]>([])
const selectedEntryId = ref<number | null>(null)
const dialogVisible = ref(false)
const editingEntry = ref<ChangelogEntry | null>(null)

const form = reactive({
  title: '',
  releaseDate: '',
  sourceType: 'manual' as ChangelogSourceType,
  summary: '',
  addedText: '',
  changedText: '',
  removedText: '',
  affectedModules: [GEO_V3_MODULE] as string[],
})

const filteredEntries = computed(() => {
  return entries.value.filter((entry) => {
    const content = [
      entry.title,
      entry.summary,
      ...entry.affectedModules,
    ].join(' ').toLowerCase()

    return content.includes('geo v3') || content.includes('prompt engine v3')
  })
})

const selectedEntry = computed(() => {
  return filteredEntries.value.find((item) => item.id === selectedEntryId.value) ?? filteredEntries.value[0] ?? null
})

const latestReleaseDate = computed(() => filteredEntries.value[0]?.releaseDate ?? '-')
const totalChangeCount = computed(() => {
  return filteredEntries.value.reduce((total, item) => (
    total + item.addedItems.length + item.changedItems.length + item.removedItems.length
  ), 0)
})

watch(
  filteredEntries,
  (value) => {
    if (value.length === 0) {
      selectedEntryId.value = null
      return
    }

    if (!value.some((item) => item.id === selectedEntryId.value)) {
      selectedEntryId.value = value[0].id
    }
  },
  { immediate: true }
)

const today = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const splitLines = (value: string) => {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

const joinLines = (items: string[]) => items.join('\n')

const sourceTypeLabel = (value: ChangelogSourceType) => {
  return value === 'ai_delivery' ? 'AI 交付总结' : '手动记录'
}

const ensureGeoV3Module = (modules: string[]) => {
  const cleanModules = modules.map((item) => item.trim()).filter(Boolean)
  return cleanModules.some((item) => item.toLowerCase() === GEO_V3_MODULE.toLowerCase())
    ? cleanModules
    : [GEO_V3_MODULE, ...cleanModules]
}

const resetForm = () => {
  form.title = ''
  form.releaseDate = today()
  form.sourceType = 'manual'
  form.summary = ''
  form.addedText = ''
  form.changedText = ''
  form.removedText = ''
  form.affectedModules = [GEO_V3_MODULE]
}

const fillForm = (entry: ChangelogEntry) => {
  form.title = entry.title
  form.releaseDate = entry.releaseDate
  form.sourceType = entry.sourceType
  form.summary = entry.summary
  form.addedText = joinLines(entry.addedItems)
  form.changedText = joinLines(entry.changedItems)
  form.removedText = joinLines(entry.removedItems)
  form.affectedModules = ensureGeoV3Module(entry.affectedModules)
}

const loadEntries = async () => {
  loading.value = true

  try {
    entries.value = await getChangelogEntries()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'V3 迭代记录加载失败')
  } finally {
    loading.value = false
  }
}

const openCreateDialog = () => {
  editingEntry.value = null
  resetForm()
  dialogVisible.value = true
}

const openEditDialog = (entry: ChangelogEntry) => {
  editingEntry.value = entry
  fillForm(entry)
  dialogVisible.value = true
}

const buildPayload = (): ChangelogEntryPayload => {
  return {
    title: form.title.trim(),
    releaseDate: form.releaseDate,
    sourceType: form.sourceType,
    summary: form.summary.trim(),
    addedItems: splitLines(form.addedText),
    changedItems: splitLines(form.changedText),
    removedItems: splitLines(form.removedText),
    affectedModules: ensureGeoV3Module(form.affectedModules),
  }
}

const submitForm = async () => {
  if (!form.title.trim()) {
    ElMessage.warning('请先填写记录标题')
    return
  }

  if (!form.releaseDate) {
    ElMessage.warning('请先选择发布日期')
    return
  }

  if (!form.summary.trim()) {
    ElMessage.warning('请先填写概述')
    return
  }

  submitting.value = true

  try {
    const payload = buildPayload()
    const entry = editingEntry.value
      ? await updateChangelogEntry(editingEntry.value.id, payload)
      : await createChangelogEntry(payload)

    await loadEntries()
    selectedEntryId.value = entry.id
    dialogVisible.value = false
    ElMessage.success(editingEntry.value ? 'V3 迭代记录已更新' : 'V3 迭代记录已新增')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'V3 迭代记录保存失败')
  } finally {
    submitting.value = false
  }
}

const removeEntry = async (entry: ChangelogEntry) => {
  try {
    await ElMessageBox.confirm(`确定删除“${entry.title}”这条 V3 迭代记录吗？`, '删除确认', {
      type: 'warning',
    })
  } catch {
    return
  }

  try {
    await deleteChangelogEntry(entry.id)
    await loadEntries()
    ElMessage.success('V3 迭代记录已删除')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'V3 迭代记录删除失败')
  }
}

onMounted(() => {
  resetForm()
  loadEntries()
})
</script>

<style scoped>
.geo-v3-changelog {
  display: grid;
  gap: 14px;
}

.geo-v3-changelog__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.geo-v3-changelog__head h3 {
  margin: 0 0 6px;
  color: var(--brand-ink);
  font-size: 16px;
}

.geo-v3-changelog__head p {
  margin: 0;
  color: var(--brand-muted);
  font-size: 12px;
  line-height: 1.65;
}

.geo-v3-changelog__actions {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.geo-v3-changelog__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.geo-v3-changelog__stats > div {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid rgba(217, 107, 114, 0.12);
  border-radius: 8px;
  background: #fff8f7;
}

.geo-v3-changelog__stats strong {
  color: var(--brand-primary-strong);
  font-size: 20px;
}

.geo-v3-changelog__stats span {
  color: var(--brand-muted);
  font-size: 12px;
}
</style>
