<template>
  <PageHeader
    description="把每次功能交付整理成可公开查看的版本记录，团队成员登录后都能快速知道这次加了什么、改了什么、删了什么。"
    eyebrow="Release Notes"
    title="迭代记录"
  >
    <template #actions>
      <el-button v-if="appStore.isAdmin" type="primary" @click="openCreateDialog">新增记录</el-button>
    </template>
  </PageHeader>

  <section class="changelog-layout">
    <article v-loading="loading" class="surface-card section-card reveal-up" style="--delay: 0.08s">
      <div class="changelog-card-head">
        <div>
          <h3>版本时间线</h3>
          <p>每条记录代表一次明确的功能交付，默认按发布时间倒序展示。</p>
        </div>
        <el-tag effect="light" round>{{ entries.length }} 条记录</el-tag>
      </div>

      <div v-if="entries.length > 0" class="changelog-timeline">
        <button
          v-for="entry in entries"
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

      <el-empty v-else description="当前还没有任何迭代记录。" />
    </article>

    <article v-loading="loading" class="surface-card section-card reveal-up" style="--delay: 0.14s">
      <template v-if="selectedEntry">
        <div class="changelog-card-head changelog-card-head--top">
          <div>
            <h3>{{ selectedEntry.title }}</h3>
            <p>这条记录对所有登录用户可见，会作为系统内的公开迭代说明长期保留。</p>
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

      <el-empty v-else description="先从左侧时间线选择一条迭代记录。" />
    </article>
  </section>

  <el-dialog v-model="dialogVisible" :title="editingEntry ? '编辑迭代记录' : '新增迭代记录'" width="760px">
    <el-form label-position="top">
      <div class="dialog-form-grid">
        <el-form-item label="记录标题">
          <el-input v-model="form.title" placeholder="如：GEO 规则库与 AI 总结上线" />
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
            placeholder="如：GEO / 用户中心 / 系统设置"
            style="width: 100%"
          />
        </el-form-item>
      </div>

      <el-form-item label="概述">
        <el-input v-model="form.summary" :rows="4" placeholder="概括本次交付的核心变化。" resize="vertical" type="textarea" />
      </el-form-item>

      <div class="dialog-form-grid dialog-form-grid--triple">
        <el-form-item label="新增（每行一条）">
          <el-input
            v-model="form.addedText"
            :rows="7"
            placeholder="如：新增 GEO 规则库页面"
            resize="vertical"
            type="textarea"
          />
        </el-form-item>
        <el-form-item label="修改（每行一条）">
          <el-input
            v-model="form.changedText"
            :rows="7"
            placeholder="如：Prompt Engine 增加规则卡注入"
            resize="vertical"
            type="textarea"
          />
        </el-form-item>
        <el-form-item label="删除（每行一条）">
          <el-input
            v-model="form.removedText"
            :rows="7"
            placeholder="如：移除旧的占位提示文案"
            resize="vertical"
            type="textarea"
          />
        </el-form-item>
      </div>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button :loading="submitting" type="primary" @click="submitForm">保存</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import { createChangelogEntry, deleteChangelogEntry, getChangelogEntries, updateChangelogEntry } from '@/api/changelog'
import { useAppStore } from '@/stores/app'
import type { ChangelogEntry, ChangelogEntryPayload, ChangelogSourceType } from '@/types/changelog'

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
  affectedModules: [] as string[],
})

const selectedEntry = computed(() => {
  return entries.value.find((item) => item.id === selectedEntryId.value) ?? entries.value[0] ?? null
})

watch(
  entries,
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

const resetForm = () => {
  form.title = ''
  form.releaseDate = today()
  form.sourceType = 'manual'
  form.summary = ''
  form.addedText = ''
  form.changedText = ''
  form.removedText = ''
  form.affectedModules = []
}

const fillForm = (entry: ChangelogEntry) => {
  form.title = entry.title
  form.releaseDate = entry.releaseDate
  form.sourceType = entry.sourceType
  form.summary = entry.summary
  form.addedText = joinLines(entry.addedItems)
  form.changedText = joinLines(entry.changedItems)
  form.removedText = joinLines(entry.removedItems)
  form.affectedModules = [...entry.affectedModules]
}

const loadEntries = async () => {
  loading.value = true

  try {
    entries.value = await getChangelogEntries()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '迭代记录加载失败')
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
    affectedModules: form.affectedModules.map((item) => item.trim()).filter(Boolean),
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

    if (editingEntry.value) {
      ElMessage.success('迭代记录已更新')
    } else {
      ElMessage.success('迭代记录已新增')
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '迭代记录保存失败')
  } finally {
    submitting.value = false
  }
}

const removeEntry = async (entry: ChangelogEntry) => {
  try {
    await ElMessageBox.confirm(`确定删除“${entry.title}”这条迭代记录吗？`, '删除确认', {
      type: 'warning',
    })
  } catch {
    return
  }

  try {
    await deleteChangelogEntry(entry.id)
    await loadEntries()
    ElMessage.success('迭代记录已删除')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '迭代记录删除失败')
  }
}

onMounted(() => {
  resetForm()
  loadEntries()
})
</script>
