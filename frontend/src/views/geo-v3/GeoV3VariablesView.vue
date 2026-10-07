<template>
  <section class="geo-v3-page">
    <article class="surface-card section-card geo-v3-toolbar reveal-up">
      <div>
        <h3>变量池</h3>
        <p>维护标题角度、场景、人群、痛点、表达风格等候选值；生成时由后端完成随机抽取。</p>
      </div>
      <div class="geo-v3-actions">
        <el-button :loading="loading" plain @click="loadSets">刷新</el-button>
        <el-button type="primary" @click="resetForm">新建变量池</el-button>
      </div>
    </article>

    <section class="geo-v3-workbench">
      <article v-loading="loading" class="surface-card section-card geo-v3-list reveal-up" style="--delay: 0.08s">
        <div v-if="sets.length === 0 && !loading" class="geo-v3-empty">
          <strong>暂无变量池</strong>
          <span>先创建一组差异化候选内容。</span>
        </div>

        <button
          v-for="item in sets"
          :key="item.id"
          :class="['geo-v3-list-item', { active: form.id === item.id }]"
          type="button"
          @click="selectSet(item)"
        >
          <div class="geo-v3-list-item__top">
            <strong>{{ item.name }}</strong>
            <el-tag :type="item.isActive ? 'success' : 'info'" effect="light" round size="small">
              {{ item.isActive ? '启用' : '停用' }}
            </el-tag>
          </div>
          <p>{{ item.description || '未填写说明' }}</p>
          <span>{{ item.items.length }} 个变量 · 排序 {{ item.sortOrder }}</span>
        </button>
      </article>

      <article class="surface-card section-card reveal-up" style="--delay: 0.12s">
        <div class="geo-v3-form-head">
          <div>
            <h3>{{ form.id ? '编辑变量池' : '新建变量池' }}</h3>
            <p>每个变量可以从 N 个候选里抽 1 个，或固定抽取 X 个。</p>
          </div>
          <div class="geo-v3-actions">
            <el-button :disabled="!form.id" plain type="danger" @click="removeSet">删除</el-button>
            <el-button :loading="saving" type="primary" @click="saveSet">保存</el-button>
          </div>
        </div>

        <el-form label-position="top">
          <div class="geo-v3-form-grid">
            <el-form-item label="变量池名称">
              <el-input v-model="form.name" placeholder="如：户外装备差异化变量" />
            </el-form-item>
            <el-form-item label="排序">
              <el-input-number v-model="form.sortOrder" :min="0" style="width: 100%" />
            </el-form-item>
          </div>

          <div class="geo-v3-form-grid">
            <el-form-item label="说明">
              <el-input v-model="form.description" placeholder="这组变量适合的文章类型" />
            </el-form-item>
            <el-form-item label="启用状态">
              <el-switch v-model="form.isActive" />
            </el-form-item>
          </div>
        </el-form>

        <div class="geo-v3-section-head">
          <div>
            <h4>变量配置</h4>
            <p>候选值每行一条。最终 Prompt 只会拿到后端本次抽中的值。</p>
          </div>
          <el-button plain @click="addItem">新增变量</el-button>
        </div>

        <div class="geo-v3-variable-items">
          <article v-for="(item, index) in form.items" :key="item.localKey" class="geo-v3-variable-card">
            <div class="geo-v3-variable-card__head">
              <strong>变量 {{ index + 1 }}</strong>
              <div class="geo-v3-actions">
                <el-switch v-model="item.isActive" active-text="启用" inactive-text="停用" inline-prompt />
                <el-button plain type="danger" @click="removeItem(index)">移除</el-button>
              </div>
            </div>

            <div class="geo-v3-variable-grid">
              <el-form-item label="字段名">
                <el-input v-model="item.name" placeholder="如：opening_angle" />
              </el-form-item>
              <el-form-item label="显示名称">
                <el-input v-model="item.label" placeholder="如：开头角度" />
              </el-form-item>
              <el-form-item label="抽取方式">
                <el-select v-model="item.pickMode" style="width: 100%" @change="handlePickModeChange(item)">
                  <el-option label="随机 1 个" value="ONE" />
                  <el-option label="随机 X 个" value="MANY" />
                </el-select>
              </el-form-item>
              <el-form-item label="排序">
                <el-input-number v-model="item.sortOrder" :min="0" style="width: 100%" />
              </el-form-item>
            </div>

            <div class="geo-v3-variable-grid geo-v3-variable-grid--range">
              <el-form-item label="抽取数量">
                <div :class="['geo-count-stepper', { disabled: item.pickMode === 'ONE' }]">
                  <button
                    :disabled="item.pickMode === 'ONE' || getPickCount(item) <= 1"
                    aria-label="减少抽取数量"
                    title="减少"
                    type="button"
                    @click="stepPickCount(item, -1)"
                  >
                    -
                  </button>
                  <input
                    :disabled="item.pickMode === 'ONE'"
                    :value="getPickCount(item)"
                    min="1"
                    type="number"
                    @blur="normalizePickCount(item)"
                    @input="updatePickCountFromEvent(item, $event)"
                  />
                  <button
                    :disabled="item.pickMode === 'ONE'"
                    aria-label="增加抽取数量"
                    title="增加"
                    type="button"
                    @click="stepPickCount(item, 1)"
                  >
                    +
                  </button>
                </div>
              </el-form-item>
              <el-form-item label="说明">
                <el-input v-model="item.description" placeholder="可选，只用于后台管理" />
              </el-form-item>
            </div>

            <el-form-item label="候选值">
              <el-input
                v-model="item.candidatesText"
                :rows="5"
                placeholder="每行一条候选值"
                resize="vertical"
                type="textarea"
              />
            </el-form-item>
          </article>
        </div>
      </article>
    </section>
  </section>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createGeoV3VariableSet,
  deleteGeoV3VariableSet,
  getGeoV3VariableSets,
  updateGeoV3VariableSet,
} from '@/api/geo'
import type { GeoV3VariablePickMode, GeoV3VariableSet, GeoV3VariableSetPayload } from '@/types/geo'

interface VariableItemForm {
  localKey: string
  name: string
  label: string
  description: string
  pickMode: GeoV3VariablePickMode
  pickCount: number
  candidatesText: string
  isActive: boolean
  sortOrder: number
}

interface VariableSetForm {
  id: number | null
  name: string
  description: string
  isActive: boolean
  sortOrder: number
  items: VariableItemForm[]
}

const sets = ref<GeoV3VariableSet[]>([])
const loading = ref(false)
const saving = ref(false)

const form = reactive<VariableSetForm>({
  id: null,
  name: '',
  description: '',
  isActive: true,
  sortOrder: 0,
  items: [],
})

const createItem = (index = 0): VariableItemForm => ({
  localKey: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name: '',
  label: '',
  description: '',
  pickMode: 'ONE',
  pickCount: 1,
  candidatesText: '',
  isActive: true,
  sortOrder: index,
})

const loadSets = async () => {
  loading.value = true
  try {
    sets.value = await getGeoV3VariableSets()
    if (!form.id && sets.value.length > 0) {
      selectSet(sets.value[0])
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '变量池加载失败')
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  Object.assign(form, {
    id: null,
    name: '',
    description: '',
    isActive: true,
    sortOrder: 0,
    items: [createItem()],
  })
}

const selectSet = (item: GeoV3VariableSet) => {
  Object.assign(form, {
    id: item.id,
    name: item.name,
    description: item.description,
    isActive: item.isActive,
    sortOrder: item.sortOrder,
    items: item.items.map((variableItem, index) => ({
      localKey: `${variableItem.id}-${index}`,
      name: variableItem.name,
      label: variableItem.label,
      description: variableItem.description,
      pickMode: variableItem.pickMode,
      pickCount: Math.max(1, variableItem.pickMax || variableItem.pickMin || 1),
      candidatesText: variableItem.candidates.join('\n'),
      isActive: variableItem.isActive,
      sortOrder: variableItem.sortOrder,
    })),
  })
}

const addItem = () => {
  form.items.push(createItem(form.items.length))
}

const removeItem = (index: number) => {
  form.items.splice(index, 1)
}

const toLines = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)

const normalizePickCountValue = (value: unknown) => {
  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? Math.max(1, Math.floor(nextValue)) : 1
}

const getPickCount = (item: VariableItemForm) => {
  return item.pickMode === 'ONE' ? 1 : normalizePickCountValue(item.pickCount)
}

const handlePickModeChange = (item: VariableItemForm) => {
  item.pickCount = getPickCount(item)
}

const updatePickCountFromEvent = (item: VariableItemForm, event: Event) => {
  const target = event.target as HTMLInputElement | null
  item.pickCount = normalizePickCountValue(target?.value)
}

const normalizePickCount = (item: VariableItemForm) => {
  item.pickCount = getPickCount(item)
}

const stepPickCount = (item: VariableItemForm, step: number) => {
  if (item.pickMode === 'ONE') return
  item.pickCount = Math.max(1, getPickCount(item) + step)
}

const validateItems = () => {
  if (form.items.length === 0) {
    ElMessage.warning('请至少新增 1 个变量')
    return false
  }

  for (const item of form.items) {
    const label = item.label || item.name || '未命名变量'
    const candidates = toLines(item.candidatesText)
    const pickCount = getPickCount(item)

    if (!item.name.trim()) {
      ElMessage.warning(`请填写变量“${label}”的字段名`)
      return false
    }

    if (!item.label.trim()) {
      ElMessage.warning(`请填写变量“${label}”的显示名称`)
      return false
    }

    if (candidates.length === 0) {
      ElMessage.warning(`变量“${label}”至少需要 1 个候选值`)
      return false
    }

    if (pickCount > candidates.length) {
      ElMessage.warning(`变量“${label}”的抽取数量不能超过候选值数量`)
      return false
    }
  }

  return true
}

const buildPayload = (): GeoV3VariableSetPayload => ({
  name: form.name,
  description: form.description,
  isActive: form.isActive,
  sortOrder: form.sortOrder,
  items: form.items.map((item) => ({
    name: item.name,
    label: item.label,
    description: item.description,
    pickMode: item.pickMode,
    pickMin: getPickCount(item),
    pickMax: getPickCount(item),
    candidates: toLines(item.candidatesText),
    isActive: item.isActive,
    sortOrder: item.sortOrder,
  })),
})

const saveSet = async () => {
  if (!validateItems()) return

  saving.value = true
  try {
    const saved = form.id
      ? await updateGeoV3VariableSet(form.id, buildPayload())
      : await createGeoV3VariableSet(buildPayload())
    ElMessage.success('变量池已保存')
    await loadSets()
    selectSet(saved)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

const removeSet = async () => {
  if (!form.id) return
  try {
    await ElMessageBox.confirm('确认删除这个变量池？历史生成记录中的快照仍会保留。', '删除变量池', {
      type: 'warning',
    })
    await deleteGeoV3VariableSet(form.id)
    ElMessage.success('已删除')
    resetForm()
    await loadSets()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '删除失败')
    }
  }
}

onMounted(async () => {
  resetForm()
  await loadSets()
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
.geo-v3-section-head,
.geo-v3-variable-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.geo-v3-toolbar h3,
.geo-v3-form-head h3,
.geo-v3-section-head h4 {
  margin: 0 0 6px;
  font-size: 16px;
  color: var(--brand-ink);
}

.geo-v3-toolbar p,
.geo-v3-form-head p,
.geo-v3-section-head p,
.geo-v3-list-item p,
.geo-v3-empty span {
  margin: 0;
  font-size: 12px;
  line-height: 1.65;
  color: var(--brand-muted);
}

.geo-v3-actions {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.geo-v3-workbench {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.geo-v3-list,
.geo-v3-variable-items {
  display: grid;
  gap: 10px;
}

.geo-v3-list-item,
.geo-v3-variable-card {
  width: 100%;
  padding: 13px;
  text-align: left;
  border: 1px solid rgba(217, 107, 114, 0.14);
  border-radius: 8px;
  color: inherit;
  background: rgba(255, 252, 251, 0.72);
}

.geo-v3-list-item {
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

.geo-v3-list-item strong,
.geo-v3-variable-card strong {
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

.geo-v3-form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 160px;
  gap: 14px;
}

.geo-v3-section-head {
  margin: 10px 0 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(217, 107, 114, 0.12);
}

.geo-v3-variable-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.geo-v3-variable-grid--range {
  grid-template-columns: 160px minmax(0, 1fr);
}

.geo-count-stepper {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 34px;
  gap: 6px;
  width: 100%;
}

.geo-count-stepper button {
  display: grid;
  place-items: center;
  height: 32px;
  border: 1px solid rgba(217, 107, 114, 0.18);
  border-radius: 8px;
  color: var(--brand-primary-strong);
  background: #fff7f6;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    opacity 0.2s ease;
}

.geo-count-stepper button:hover:not(:disabled) {
  border-color: rgba(217, 107, 114, 0.34);
  background: #fff0ef;
}

.geo-count-stepper button:disabled {
  color: #cdb9bd;
  cursor: not-allowed;
  background: #fbf6f5;
  opacity: 0.72;
}

.geo-count-stepper input {
  width: 100%;
  height: 32px;
  padding: 0 8px;
  text-align: center;
  border: 1px solid rgba(217, 107, 114, 0.18);
  border-radius: 8px;
  color: #4d393e;
  background: rgba(255, 252, 251, 0.96);
  outline: none;
}

.geo-count-stepper input:focus {
  border-color: rgba(217, 107, 114, 0.42);
  box-shadow: 0 0 0 2px rgba(217, 107, 114, 0.08);
}

.geo-count-stepper input:disabled {
  color: #9f8a8f;
  background: #fbf6f5;
}

.geo-count-stepper input::-webkit-outer-spin-button,
.geo-count-stepper input::-webkit-inner-spin-button {
  margin: 0;
  appearance: none;
}
</style>
