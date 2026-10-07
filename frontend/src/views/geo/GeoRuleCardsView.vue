<template>
  <section class="geo-rules-layout">
    <div class="geo-rules-sidebar">
      <article class="surface-card section-card reveal-up" style="--delay: 0.08s">
        <div class="geo-rules-card-head">
          <div>
            <h3>规则库</h3>
            <p>按品类回看 AI 总结，并把一段时间内的总结再归纳成可激活的规则卡。</p>
          </div>
          <el-tag effect="light" round>{{ filteredSummaries.length }} 条总结</el-tag>
        </div>

        <el-form label-position="top">
          <el-form-item label="品类">
            <el-select
              v-model="selectedCategory"
              allow-create
              clearable
              default-first-option
              filterable
              placeholder="如：冲锋衣"
            >
              <el-option
                v-for="item in categoryOptions"
                :key="item"
                :label="item"
                :value="item"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="总结时间范围（可选）">
            <el-date-picker
              v-model="summaryRange"
              end-placeholder="结束日期"
              range-separator="至"
              start-placeholder="开始日期"
              type="daterange"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
        </el-form>

        <div class="geo-rules-actions">
          <el-button :loading="loading" @click="loadData">刷新数据</el-button>
          <el-button :loading="generating" type="primary" @click="generateRuleCard">沉淀规则卡</el-button>
        </div>

        <div class="geo-rules-inline-note">
          规则卡会按当前选中的品类和时间范围，从多条 AI 总结里归纳出可复用的本地策略。
        </div>
      </article>

      <article v-loading="loading" class="surface-card section-card reveal-up" style="--delay: 0.14s">
        <div class="geo-rules-card-head">
          <div>
            <h3>AI 总结记录</h3>
            <p>这里展示每个研究项目的 AI 总结，是沉淀规则卡的原始素材。</p>
          </div>
        </div>

        <div v-if="filteredSummaries.length > 0" class="geo-rules-summary-list">
          <article
            v-for="summary in filteredSummaries"
            :key="summary.id"
            class="geo-rules-summary-card"
          >
            <div class="geo-rules-summary-card__top">
              <strong>{{ summary.projectKeyword }}</strong>
              <el-tag effect="light" round size="small">{{ summary.category }}</el-tag>
            </div>
            <div class="geo-rules-summary-card__meta">
              <span>{{ summary.engine === 'manual' ? '手动模式' : '自动模式' }}</span>
              <span>{{ formatDisplayTime(summary.updatedAt) }}</span>
            </div>
            <p>{{ summary.rawSummary }}</p>
          </article>
        </div>

        <el-empty
          v-else
          description="当前品类还没有 AI 总结记录，先去 SERP 研究里生成几条总结。"
        />
      </article>
    </div>

    <div class="geo-rules-main">
      <article v-loading="loading" class="surface-card section-card reveal-up" style="--delay: 0.1s">
        <div class="geo-rules-card-head">
          <div>
            <h3>规则卡列表</h3>
            <p>每个品类可以生成多张规则卡，但同一时刻只允许一张激活供 Prompt Engine 复用。</p>
          </div>
          <el-tag effect="light" round>{{ filteredRuleCards.length }} 张规则卡</el-tag>
        </div>

        <div v-if="filteredRuleCards.length > 0" class="geo-rules-card-list">
          <button
            v-for="card in filteredRuleCards"
            :key="card.id"
            :class="['geo-rules-card-item', { active: selectedRuleCardId === card.id }]"
            type="button"
            @click="selectedRuleCardId = card.id"
          >
            <div class="geo-rules-card-item__top">
              <strong>{{ card.category }}</strong>
              <el-tag
                :type="card.isActive ? 'success' : 'info'"
                effect="light"
                round
                size="small"
              >
                {{ card.isActive ? '已激活' : '未激活' }}
              </el-tag>
            </div>
            <div class="geo-rules-card-item__meta">
              <span>{{ card.sourceSummaryCount }} 条总结</span>
              <span>{{ formatDisplayTime(card.updatedAt) }}</span>
            </div>
            <p>{{ card.rawSummary }}</p>
          </button>
        </div>

        <el-empty
          v-else
          description="当前筛选条件下还没有规则卡，先选一个品类后点击“沉淀规则卡”。"
        />
      </article>

      <article v-loading="loading" class="surface-card section-card reveal-up" style="--delay: 0.16s">
        <div class="geo-rules-card-head">
          <div>
            <h3>规则卡详情</h3>
            <p>激活后的规则卡会被 Prompt Engine 作为额外上下文自动注入。</p>
          </div>
          <div v-if="selectedRuleCard" class="geo-rules-card-actions">
            <el-button
              :loading="activating"
              :plain="selectedRuleCard.isActive"
              type="primary"
              @click="toggleRuleCardActivation(selectedRuleCard)"
            >
              {{ selectedRuleCard.isActive ? '取消激活' : '设为激活规则卡' }}
            </el-button>
          </div>
        </div>

        <template v-if="selectedRuleCard">
          <div class="geo-rules-detail-meta">
            <span>品类：{{ selectedRuleCard.category }}</span>
            <span>模型：{{ selectedRuleCard.model }}</span>
            <span>总结数：{{ selectedRuleCard.sourceSummaryCount }}</span>
            <span>更新时间：{{ formatDisplayTime(selectedRuleCard.updatedAt) }}</span>
          </div>

          <div class="geo-rules-detail-summary">
            {{ selectedRuleCard.rawSummary }}
          </div>

          <div class="geo-rules-detail-grid">
            <div
              v-for="section in selectedRuleCardSections"
              :key="section.key"
              class="geo-rules-detail-block"
            >
              <h5>{{ section.title }}</h5>
              <ul class="geo-rules-detail-list">
                <li v-for="item in section.items" :key="item">{{ item }}</li>
              </ul>
            </div>
          </div>
        </template>

        <el-empty
          v-else
          description="先从左侧规则卡列表里选中一张，这里会展示结构化详情。"
        />
      </article>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  activateGeoRuleCard,
  generateGeoRuleCard,
  getGeoAiSummaries,
  getGeoProfiles,
  getGeoRuleCards,
} from '@/api/geo'
import type { GeoProfileItem, GeoRuleCard, GeoSerpAiSummary } from '@/types/geo'

const profiles = ref<GeoProfileItem[]>([])
const summaries = ref<GeoSerpAiSummary[]>([])
const ruleCards = ref<GeoRuleCard[]>([])
const selectedCategory = ref('')
const selectedRuleCardId = ref<number | null>(null)
const summaryRange = ref<[string, string] | []>([])
const loading = ref(false)
const generating = ref(false)
const activating = ref(false)

const categoryOptions = computed(() => {
  const values = new Set<string>()

  for (const profile of profiles.value) {
    if (profile.product.type.trim()) {
      values.add(profile.product.type.trim())
    }
  }

  for (const summary of summaries.value) {
    if (summary.category.trim()) {
      values.add(summary.category.trim())
    }
  }

  for (const ruleCard of ruleCards.value) {
    if (ruleCard.category.trim()) {
      values.add(ruleCard.category.trim())
    }
  }

  if (selectedCategory.value.trim()) {
    values.add(selectedCategory.value.trim())
  }

  return Array.from(values)
})

const filteredSummaries = computed(() => {
  const category = selectedCategory.value.trim()
  if (!category) return summaries.value

  return summaries.value.filter((item) => item.category === category)
})

const filteredRuleCards = computed(() => {
  const category = selectedCategory.value.trim()
  if (!category) return ruleCards.value

  return ruleCards.value.filter((item) => item.category === category)
})

const selectedRuleCard = computed(() => {
  return (
    filteredRuleCards.value.find((item) => item.id === selectedRuleCardId.value) ||
    filteredRuleCards.value[0] ||
    null
  )
})

const selectedRuleCardSections = computed(() => {
  if (!selectedRuleCard.value) return []

  return [
    { key: 'titlePatterns', title: '标题模式', items: selectedRuleCard.value.titlePatterns },
    { key: 'leadPatterns', title: '开头切入', items: selectedRuleCard.value.leadPatterns },
    { key: 'sectionBlueprint', title: '主体结构', items: selectedRuleCard.value.sectionBlueprint },
    { key: 'keywordPlacement', title: '关键词布局', items: selectedRuleCard.value.keywordPlacement },
    { key: 'sellingPointOrder', title: '卖点顺序', items: selectedRuleCard.value.sellingPointOrder },
    { key: 'trustSignals', title: '信任建立', items: selectedRuleCard.value.trustSignals },
    { key: 'endingPatterns', title: '结尾方式', items: selectedRuleCard.value.endingPatterns },
    { key: 'antiPatterns', title: '明显禁忌', items: selectedRuleCard.value.antiPatterns },
    { key: 'rankingHypotheses', title: '排名假设', items: selectedRuleCard.value.rankingHypotheses },
  ].filter((item) => item.items.length > 0)
})

watch(filteredRuleCards, (cards) => {
  if (cards.length === 0) {
    selectedRuleCardId.value = null
    return
  }

  if (!cards.some((item) => item.id === selectedRuleCardId.value)) {
    selectedRuleCardId.value = cards[0].id
  }
}, { immediate: true })

const formatDisplayTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const loadData = async () => {
  loading.value = true

  try {
    const category = selectedCategory.value.trim() || undefined
    const [profileList, summaryList, ruleCardList] = await Promise.all([
      getGeoProfiles(),
      getGeoAiSummaries(category),
      getGeoRuleCards(category ? { category } : undefined),
    ])

    profiles.value = profileList
    summaries.value = summaryList
    ruleCards.value = ruleCardList
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '规则库数据加载失败')
  } finally {
    loading.value = false
  }
}

const generateRuleCardFromCurrentFilter = async () => {
  if (!selectedCategory.value.trim()) {
    ElMessage.warning('请先选择一个品类，再沉淀规则卡')
    return
  }

  generating.value = true

  try {
    const nextCard = await generateGeoRuleCard({
      category: selectedCategory.value.trim(),
      fromDate: summaryRange.value[0] || undefined,
      toDate: summaryRange.value[1] || undefined,
    })

    const nextCards = ruleCards.value.filter((item) => item.id !== nextCard.id)
    ruleCards.value = [nextCard, ...nextCards]
    selectedRuleCardId.value = nextCard.id
    await loadData()
    ElMessage.success(nextCard.isActive ? '规则卡已生成并自动激活' : '规则卡已生成')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '规则卡生成失败')
  } finally {
    generating.value = false
  }
}

const toggleRuleCardActivation = async (ruleCard: GeoRuleCard) => {
  activating.value = true

  try {
    const updated = await activateGeoRuleCard(ruleCard.id, !ruleCard.isActive)
    ruleCards.value = ruleCards.value.map((item) => {
      if (item.category !== updated.category) return item
      if (item.id === updated.id) return updated

      return {
        ...item,
        isActive: false,
      }
    })

    if (!updated.isActive) {
      ruleCards.value = ruleCards.value.map((item) => item.id === updated.id ? updated : item)
    }

    ElMessage.success(updated.isActive ? '规则卡已激活' : '规则卡已取消激活')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '规则卡状态更新失败')
  } finally {
    activating.value = false
  }
}

const generateRuleCard = () => generateRuleCardFromCurrentFilter()

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.geo-rules-layout {
  display: grid;
  grid-template-columns: minmax(340px, 0.95fr) minmax(0, 1.75fr);
  gap: 18px;
}

.geo-rules-sidebar,
.geo-rules-main {
  display: grid;
  gap: 18px;
}

.geo-rules-card-head,
.geo-rules-summary-card__top,
.geo-rules-card-item__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.geo-rules-card-head h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: var(--brand-ink);
}

.geo-rules-card-head p {
  margin: 5px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--brand-muted);
}

.geo-rules-actions,
.geo-rules-card-actions {
  display: flex;
  gap: 10px;
}

.geo-rules-inline-note,
.geo-rules-detail-summary {
  margin-top: 14px;
  padding: 12px 14px;
  font-size: 12px;
  line-height: 1.8;
  color: #8a5e63;
  border: 1px dashed rgba(217, 107, 114, 0.28);
  border-radius: 14px;
  background: rgba(255, 245, 244, 0.92);
}

.geo-rules-summary-list,
.geo-rules-card-list {
  display: grid;
  gap: 12px;
}

.geo-rules-summary-card,
.geo-rules-card-item,
.geo-rules-detail-block {
  padding: 14px 15px;
  border: 1px solid rgba(216, 178, 180, 0.26);
  border-radius: 18px;
  background: rgba(255, 253, 252, 0.94);
}

.geo-rules-card-item {
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.24s ease,
    border-color 0.24s ease,
    box-shadow 0.24s ease,
    background 0.24s ease;
}

.geo-rules-card-item:hover {
  transform: translateY(-1px);
  border-color: rgba(217, 107, 114, 0.28);
  box-shadow: 0 14px 28px rgba(178, 109, 97, 0.08);
}

.geo-rules-card-item.active {
  border-color: rgba(217, 107, 114, 0.34);
  background: linear-gradient(180deg, rgba(255, 250, 249, 0.98), rgba(255, 243, 242, 0.96));
  box-shadow: 0 16px 32px rgba(178, 109, 97, 0.1);
}

.geo-rules-summary-card strong,
.geo-rules-card-item strong {
  font-size: 14px;
  color: var(--brand-ink);
}

.geo-rules-summary-card__meta,
.geo-rules-card-item__meta,
.geo-rules-detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--brand-muted);
}

.geo-rules-summary-card p,
.geo-rules-card-item p {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.75;
  color: #77686d;
}

.geo-rules-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.geo-rules-detail-block h5 {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--brand-ink);
}

.geo-rules-detail-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.85;
  color: #77686d;
}

@media (max-width: 1360px) {
  .geo-rules-layout,
  .geo-rules-detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
