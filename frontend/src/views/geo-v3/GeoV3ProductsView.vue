<template>
  <section class="geo-v3-page">
    <article class="surface-card section-card geo-v3-toolbar reveal-up">
      <div>
        <h3>主推产品</h3>
        <p>产品档案拆成必写内容、主打卖点、强调点和补充随机内容，生成时后端先抽取，再写入最终 Prompt。</p>
      </div>
      <div class="geo-v3-actions">
        <el-button :loading="loading" plain @click="loadProducts">刷新</el-button>
        <el-button type="primary" @click="resetForm">新建产品</el-button>
      </div>
    </article>

    <section class="geo-v3-workbench">
      <article v-loading="loading" class="surface-card section-card geo-v3-list reveal-up" style="--delay: 0.08s">
        <div v-if="products.length === 0 && !loading" class="geo-v3-empty">
          <strong>暂无主推产品</strong>
          <span>先创建一份产品素材档案。</span>
        </div>

        <button
          v-for="item in products"
          :key="item.id"
          :class="['geo-v3-list-item', { active: form.id === item.id }]"
          type="button"
          @click="selectProduct(item)"
        >
          <div class="geo-v3-list-item__top">
            <strong>{{ item.name }}</strong>
            <el-tag :type="item.isActive ? 'success' : 'info'" effect="light" round size="small">
              {{ item.isActive ? '启用' : '停用' }}
            </el-tag>
          </div>
          <p>{{ item.brand }} · {{ item.productName }}</p>
          <span>
            必写 {{ item.requiredContent.length }} 条 · 卖点 {{ item.sellingPointsPool.length }} 条/{{ getFixedPickLabel(item.sellingPointPickMax) }} · 强调 {{ item.emphasisPool.length }} 条/{{ getFixedPickLabel(item.emphasisPickMax) }} · 补充 {{ item.randomContentPool.length }} 条/{{ getFixedPickLabel(item.randomPickMax) }}
          </span>
        </button>
      </article>

      <article class="surface-card section-card reveal-up" style="--delay: 0.12s">
        <div class="geo-v3-form-head">
          <div>
            <h3>{{ form.id ? '编辑主推产品' : '新建主推产品' }}</h3>
            <p>品牌、产品名、核心参数会稳定写入；卖点、强调点和补充素材分别按数量规则抽取。</p>
          </div>
          <div class="geo-v3-actions">
            <el-button :disabled="!form.id" plain type="danger" @click="removeProduct">删除</el-button>
            <el-button :loading="saving" type="primary" @click="saveProduct">保存</el-button>
          </div>
        </div>

        <el-form label-position="top">
          <div class="geo-v3-form-grid geo-v3-form-grid--four">
            <el-form-item label="档案名称">
              <el-input v-model="form.name" placeholder="如：A 品牌冲锋衣主推档案" />
            </el-form-item>
            <el-form-item label="品牌">
              <el-input v-model="form.brand" />
            </el-form-item>
            <el-form-item label="产品名">
              <el-input v-model="form.productName" />
            </el-form-item>
            <el-form-item label="产品类型">
              <el-input v-model="form.category" placeholder="如：冲锋衣" />
            </el-form-item>
          </div>

          <div class="geo-v3-form-grid geo-v3-form-grid--four">
            <el-form-item label="目标人群">
              <el-input v-model="form.targetAudience" placeholder="如：硬核户外爱好者" />
            </el-form-item>
            <el-form-item label="标题关键词">
              <el-input v-model="form.keyword" placeholder="如：冲锋衣品牌排行榜" />
            </el-form-item>
            <el-form-item label="标题关键词模式">
              <el-select v-model="form.keywordMode" style="width: 100%">
                <el-option label="完全包含关键词" value="exact" />
                <el-option label="拆解竞对标题重组" value="recompose" />
              </el-select>
            </el-form-item>
            <el-form-item label="品牌池抽取数量">
              <el-input-number v-model="form.brandPoolPickCount" :min="0" style="width: 100%" />
              <div class="geo-v3-field-tip">品牌池有内容时默认按前十榜单抽 9 个，不足 9 个则全抽。</div>
            </el-form-item>
          </div>

          <div class="geo-v3-form-grid">
            <el-form-item label="排序">
              <el-input-number v-model="form.sortOrder" :min="0" style="width: 100%" />
            </el-form-item>
            <el-form-item label="启用状态">
              <el-switch v-model="form.isActive" />
            </el-form-item>
          </div>

          <el-form-item label="核心参数">
            <el-input v-model="form.coreParameters" :rows="4" resize="vertical" type="textarea" />
          </el-form-item>

          <div class="geo-v3-two-columns">
            <el-form-item label="SEO 关键词（每行一个）">
              <el-input
                v-model="form.seoKeywordsText"
                :rows="6"
                placeholder="冲锋衣推荐&#10;冲锋衣十大品牌&#10;户外冲锋衣选购"
                resize="vertical"
                type="textarea"
              />
            </el-form-item>
            <el-form-item label="品牌池（每行一个）">
              <el-input
                v-model="form.brandPoolText"
                :rows="6"
                placeholder="凯乐石&#10;骆驼&#10;探路者&#10;迪卡侬"
                resize="vertical"
                type="textarea"
              />
            </el-form-item>
          </div>

          <div class="geo-v3-form-grid geo-v3-form-grid--three">
            <el-form-item label="主打卖点抽取数量">
              <el-input-number v-model="form.sellingPointPickCount" :min="0" style="width: 100%" />
            </el-form-item>
            <el-form-item label="强调点抽取数量">
              <el-input-number v-model="form.emphasisPickCount" :min="0" style="width: 100%" />
            </el-form-item>
            <el-form-item label="补充内容抽取数量">
              <el-input-number v-model="form.randomPickCount" :min="0" style="width: 100%" />
            </el-form-item>
          </div>

          <div class="geo-v3-two-columns">
            <el-form-item label="必须写的内容">
              <el-input
                v-model="form.requiredContentText"
                :rows="12"
                placeholder="每行一条，如品牌背书、必须出现的卖点"
                resize="vertical"
                type="textarea"
              />
            </el-form-item>
            <el-form-item label="补充随机内容池">
              <el-input
                v-model="form.randomContentPoolText"
                :rows="12"
                placeholder="每行一条，后端会随机抽取"
                resize="vertical"
                type="textarea"
              />
            </el-form-item>
          </div>

          <div class="geo-v3-two-columns">
            <el-form-item label="主打卖点（随机池）">
              <el-input
                v-model="form.sellingPointsPoolText"
                :rows="10"
                placeholder="每行一条，如性能优势、价格优势、场景优势"
                resize="vertical"
                type="textarea"
              />
            </el-form-item>
            <el-form-item label="强调点（随机池）">
              <el-input
                v-model="form.emphasisPoolText"
                :rows="10"
                placeholder="每行一条，如安全性、长期价值、适配人群"
                resize="vertical"
                type="textarea"
              />
            </el-form-item>
          </div>
        </el-form>
      </article>
    </section>
  </section>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createGeoV3Product,
  deleteGeoV3Product,
  getGeoV3Products,
  updateGeoV3Product,
} from '@/api/geo'
import type { GeoKeywordMode, GeoV3Product, GeoV3ProductPayload } from '@/types/geo'

interface ProductForm {
  id: number | null
  name: string
  brand: string
  productName: string
  category: string
  targetAudience: string
  coreParameters: string
  keyword: string
  keywordMode: GeoKeywordMode
  seoKeywordsText: string
  brandPoolText: string
  requiredContentText: string
  randomContentPoolText: string
  sellingPointsPoolText: string
  emphasisPoolText: string
  brandPoolPickCount: number
  randomPickCount: number
  sellingPointPickCount: number
  emphasisPickCount: number
  isActive: boolean
  sortOrder: number
}

const products = ref<GeoV3Product[]>([])
const loading = ref(false)
const saving = ref(false)

const form = reactive<ProductForm>({
  id: null,
  name: '',
  brand: '',
  productName: '',
  category: '',
  targetAudience: '',
  coreParameters: '',
  keyword: '',
  keywordMode: 'exact',
  seoKeywordsText: '',
  brandPoolText: '',
  requiredContentText: '',
  randomContentPoolText: '',
  sellingPointsPoolText: '',
  emphasisPoolText: '',
  brandPoolPickCount: 0,
  randomPickCount: 1,
  sellingPointPickCount: 1,
  emphasisPickCount: 1,
  isActive: true,
  sortOrder: 0,
})

const toLines = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)

const getDefaultBrandPoolPickCount = (poolLength: number) => (
  poolLength > 0 ? Math.min(poolLength, 9) : 0
)

const resolveBrandPoolPickCount = (brandPool: string[], pickMin?: number, pickMax?: number) => {
  const configuredCount = Math.max(0, Math.floor(pickMax || pickMin || 0))
  return configuredCount > 0 ? configuredCount : getDefaultBrandPoolPickCount(brandPool.length)
}

watch(
  () => form.brandPoolText,
  (value, previousValue) => {
    const brandPool = toLines(value)
    const previousBrandPool = toLines(previousValue || '')
    if (brandPool.length === 0) {
      form.brandPoolPickCount = 0
      return
    }

    if (form.brandPoolPickCount === 0 || previousBrandPool.length === 0) {
      form.brandPoolPickCount = getDefaultBrandPoolPickCount(brandPool.length)
    }
  }
)

const loadProducts = async () => {
  loading.value = true
  try {
    products.value = await getGeoV3Products()
    if (!form.id && products.value.length > 0) {
      selectProduct(products.value[0])
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '主推产品加载失败')
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  Object.assign(form, {
    id: null,
    name: '',
    brand: '',
    productName: '',
    category: '',
    targetAudience: '',
    coreParameters: '',
    keyword: '',
    keywordMode: 'exact',
    seoKeywordsText: '',
    brandPoolText: '',
    requiredContentText: '',
    randomContentPoolText: '',
    sellingPointsPoolText: '',
    emphasisPoolText: '',
    brandPoolPickCount: 0,
    randomPickCount: 1,
    sellingPointPickCount: 1,
    emphasisPickCount: 1,
    isActive: true,
    sortOrder: 0,
  })
}

const selectProduct = (item: GeoV3Product) => {
  Object.assign(form, {
    id: item.id,
    name: item.name,
    brand: item.brand,
    productName: item.productName,
    category: item.category,
    targetAudience: item.targetAudience,
    coreParameters: item.coreParameters,
    keyword: item.keyword,
    keywordMode: item.keywordMode,
    seoKeywordsText: item.seoKeywords.join('\n'),
    brandPoolText: item.brandPool.join('\n'),
    requiredContentText: item.requiredContent.join('\n'),
    randomContentPoolText: item.randomContentPool.join('\n'),
    sellingPointsPoolText: item.sellingPointsPool.join('\n'),
    emphasisPoolText: item.emphasisPool.join('\n'),
    brandPoolPickCount: resolveBrandPoolPickCount(item.brandPool, item.brandPoolPickMin, item.brandPoolPickMax),
    randomPickCount: Math.max(0, item.randomPickMax || item.randomPickMin || 0),
    sellingPointPickCount: Math.max(0, item.sellingPointPickMax || item.sellingPointPickMin || 0),
    emphasisPickCount: Math.max(0, item.emphasisPickMax || item.emphasisPickMin || 0),
    isActive: item.isActive,
    sortOrder: item.sortOrder,
  })
}

const getProductPickCount = () => Math.max(0, Math.floor(form.randomPickCount || 0))
const getBrandPoolPickCount = () => Math.max(0, Math.floor(form.brandPoolPickCount || 0))
const getSellingPointPickCount = () => Math.max(0, Math.floor(form.sellingPointPickCount || 0))
const getEmphasisPickCount = () => Math.max(0, Math.floor(form.emphasisPickCount || 0))

const getFixedPickLabel = (count: number) => `抽 ${Math.max(0, count || 0)}`

const validateProduct = () => {
  const randomPool = toLines(form.randomContentPoolText)
  const brandPool = toLines(form.brandPoolText)
  const sellingPointsPool = toLines(form.sellingPointsPoolText)
  const emphasisPool = toLines(form.emphasisPoolText)
  const pickCount = getProductPickCount()
  let brandPoolPickCount = getBrandPoolPickCount()
  const sellingPointPickCount = getSellingPointPickCount()
  const emphasisPickCount = getEmphasisPickCount()

  if (pickCount > randomPool.length) {
    ElMessage.warning('补充内容抽取数量不能超过补充随机内容池条数')
    return false
  }

  if (brandPoolPickCount > brandPool.length) {
    ElMessage.warning('品牌池抽取数量不能超过品牌池条数')
    return false
  }

  if (brandPool.length > 0 && brandPoolPickCount === 0) {
    brandPoolPickCount = getDefaultBrandPoolPickCount(brandPool.length)
    form.brandPoolPickCount = brandPoolPickCount
  }

  if (sellingPointPickCount > sellingPointsPool.length) {
    ElMessage.warning('主打卖点抽取数量不能超过主打卖点池条数')
    return false
  }

  if (emphasisPickCount > emphasisPool.length) {
    ElMessage.warning('强调点抽取数量不能超过强调点池条数')
    return false
  }

  return true
}

const buildPayload = (): GeoV3ProductPayload => ({
  name: form.name,
  brand: form.brand,
  productName: form.productName,
  category: form.category,
  targetAudience: form.targetAudience,
  coreParameters: form.coreParameters,
  keyword: form.keyword,
  keywordMode: form.keywordMode,
  seoKeywords: toLines(form.seoKeywordsText),
  brandPool: toLines(form.brandPoolText),
  brandPoolPickMin: getBrandPoolPickCount(),
  brandPoolPickMax: getBrandPoolPickCount(),
  requiredContent: toLines(form.requiredContentText),
  randomContentPool: toLines(form.randomContentPoolText),
  randomPickMin: getProductPickCount(),
  randomPickMax: getProductPickCount(),
  sellingPointsPool: toLines(form.sellingPointsPoolText),
  sellingPointPickMin: getSellingPointPickCount(),
  sellingPointPickMax: getSellingPointPickCount(),
  emphasisPool: toLines(form.emphasisPoolText),
  emphasisPickMin: getEmphasisPickCount(),
  emphasisPickMax: getEmphasisPickCount(),
  isActive: form.isActive,
  sortOrder: form.sortOrder,
})

const saveProduct = async () => {
  if (!validateProduct()) return

  saving.value = true
  try {
    const saved = form.id
      ? await updateGeoV3Product(form.id, buildPayload())
      : await createGeoV3Product(buildPayload())
    ElMessage.success('主推产品已保存')
    await loadProducts()
    selectProduct(saved)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

const removeProduct = async () => {
  if (!form.id) return
  try {
    await ElMessageBox.confirm('确认删除这个主推产品？历史生成记录中的快照仍会保留。', '删除主推产品', {
      type: 'warning',
    })
    await deleteGeoV3Product(form.id)
    ElMessage.success('已删除')
    resetForm()
    await loadProducts()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '删除失败')
    }
  }
}

onMounted(loadProducts)
</script>

<style scoped>
.geo-v3-page {
  display: grid;
  gap: 14px;
}

.geo-v3-toolbar,
.geo-v3-form-head,
.geo-v3-list-item__top {
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

.geo-v3-form-grid {
  display: grid;
  grid-template-columns: 180px 180px;
  gap: 14px;
}

.geo-v3-form-grid--four {
  grid-template-columns: 1.2fr 1fr 1fr 1fr;
}

.geo-v3-form-grid--three {
  grid-template-columns: repeat(3, 180px);
}

.geo-v3-form-grid--range {
  grid-template-columns: 180px;
}

.geo-v3-field-tip {
  width: 100%;
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.5;
  color: #a9888c;
}

.geo-v3-two-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

@media (max-width: 1180px) {
  .geo-v3-workbench,
  .geo-v3-form-grid,
  .geo-v3-form-grid--four,
  .geo-v3-form-grid--three,
  .geo-v3-two-columns {
    grid-template-columns: 1fr;
  }
}
</style>
