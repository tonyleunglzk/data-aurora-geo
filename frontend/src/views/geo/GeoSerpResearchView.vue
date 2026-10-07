<template>
  <section class="geo-serp-layout">
    <div class="geo-serp-sidebar">
      <article class="surface-card section-card reveal-up" style="--delay: 0.08s">
        <div class="geo-serp-card-head">
          <div>
            <h3>百度百家号研究台</h3>
            <p>先做规则解剖，再按项目手动生成 AI 总结，后续就能沉淀到 GEO 规则库。</p>
          </div>
          <el-tag effect="light" round type="danger">仅研究 baijiahao.baidu.com</el-tag>
        </div>

        <div class="geo-serp-mode-switch">
          <button
            v-for="item in researchModes"
            :key="item.value"
            :class="['geo-serp-mode-switch__item', { active: researchForm.mode === item.value }]"
            type="button"
            @click="researchForm.mode = item.value"
          >
            <strong>{{ item.label }}</strong>
            <span>{{ item.description }}</span>
          </button>
        </div>

        <el-form class="geo-serp-form" label-position="top">
          <el-form-item label="产品品类">
            <el-select
              v-model="researchForm.category"
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

          <el-form-item :label="researchForm.mode === 'automatic' ? '搜索关键词' : '研究主题（可选）'">
            <el-input
              v-model="researchForm.keyword"
              clearable
              :placeholder="
                researchForm.mode === 'automatic'
                  ? '如：冲锋衣品牌排行榜'
                  : '如：冲锋衣品牌排行榜文章拆解'
              "
              @keyup.enter="createProject"
            />
          </el-form-item>

          <el-form-item v-if="researchForm.mode === 'automatic'" label="抓取前 N 名">
            <el-input-number v-model="researchForm.rankLimit" :max="50" :min="1" />
          </el-form-item>

          <el-form-item v-else label="百家号文章链接列表">
            <el-input
              v-model="researchForm.articleUrlsText"
              :rows="8"
              placeholder="每行一个链接，例如：&#10;https://baijiahao.baidu.com/s?id=123&#10;https://baijiahao.baidu.com/s?id=456"
              resize="vertical"
              type="textarea"
            />
          </el-form-item>
        </el-form>

        <div class="geo-serp-actions">
          <el-button :loading="creating" type="primary" @click="createProject">开始研究</el-button>
          <el-button :disabled="creating" @click="resetResearchForm">重置条件</el-button>
        </div>

        <div class="geo-serp-inline-note">
          {{
            researchForm.mode === 'automatic'
              ? '自动模式会抓取百度自然结果。如果当前环境命中百度安全验证，也会保存一条“被拦截”的研究项目，方便后续继续跟踪。'
              : `手动模式支持一次粘贴多个百家号链接，当前已识别 ${manualArticleUrls.length} 条有效链接。`
          }}
        </div>
      </article>

      <article
        v-loading="loadingProjects"
        class="surface-card section-card reveal-up"
        style="--delay: 0.14s"
      >
        <div class="geo-serp-card-head">
          <div>
            <h3>研究项目</h3>
            <p>每个项目都会绑定品类，后面可以对单个项目做 AI 总结，再按品类沉淀规则卡。</p>
          </div>
          <el-tag effect="light" round>{{ projects.length }} 个项目</el-tag>
        </div>

        <div v-if="projects.length > 0" class="geo-serp-project-list">
          <button
            v-for="project in projects"
            :key="project.id"
            :class="['geo-serp-project-card', { active: activeProjectId === project.id }]"
            type="button"
            @click="selectProject(project.id)"
          >
            <div class="geo-serp-project-card__top">
              <strong>{{ project.keyword }}</strong>
              <el-tag
                :type="projectStatusTagType(project.status)"
                effect="light"
                round
                size="small"
              >
                {{ projectStatusLabel(project.status) }}
              </el-tag>
            </div>

            <div class="geo-serp-project-card__meta">
              <span>品类：{{ project.category }}</span>
              <span>{{ project.engine === 'manual' ? `手动录入 ${project.rankLimit} 篇` : `前 ${project.rankLimit} 名` }}</span>
              <span>{{ project.hasAiSummary ? '已有 AI 总结' : '待生成 AI 总结' }}</span>
            </div>

            <p>{{ project.statusMessage || '已完成搜索结果采集与文章解剖。' }}</p>

            <div class="geo-serp-project-card__time">
              {{ formatDisplayTime(project.updatedAt) }}
            </div>
          </button>
        </div>

        <el-empty v-else description="还没有研究项目，先从一个关键词或一组手动链接开始。" />
      </article>
    </div>

    <div class="geo-serp-main">
      <article v-loading="projectLoading" class="surface-card section-card reveal-up" style="--delay: 0.1s">
        <template v-if="activeProject">
          <div class="geo-serp-card-head geo-serp-card-head--top">
            <div>
              <h3>{{ activeProject.keyword }}</h3>
              <p>
                {{
                  activeProjectEngine === 'manual'
                    ? `这里保存的是手动录入的 ${activeProject.rankLimit} 篇百家号文章，系统会按录入顺序逐篇解剖。`
                    : `这里保存的是百度前 ${activeProject.rankLimit} 名中的百家号结果，原始位次不会重新排序。`
                }}
              </p>
            </div>
            <div class="geo-serp-overview-actions">
              <el-tag effect="light" round>{{ activeProject.category }}</el-tag>
              <el-button
                :disabled="!canGenerateAiSummary"
                :loading="aiSummaryGenerating || aiSummarySaving"
                plain
                type="primary"
                @click="generateAiSummary"
              >
                {{ activeProject.aiSummary ? '重新生成 AI 总结' : '生成 AI 总结' }}
              </el-button>
              <el-button
                :loading="deleting"
                plain
                type="danger"
                @click="removeProject(activeProject)"
              >
                删除项目
              </el-button>
            </div>
          </div>

          <div class="geo-serp-metric-grid">
            <div class="geo-serp-metric">
              <span>项目状态</span>
              <strong>{{ projectStatusLabel(activeProject.status) }}</strong>
            </div>
            <div class="geo-serp-metric">
              <span>{{ activeProjectEngine === 'manual' ? '录入文章' : '已检查结果' }}</span>
              <strong>{{ activeProject.inspectedCount }}</strong>
            </div>
            <div class="geo-serp-metric">
              <span>{{ activeProjectEngine === 'manual' ? '收录文章' : '命中文章' }}</span>
              <strong>{{ activeProject.matchedCount }}</strong>
            </div>
            <div class="geo-serp-metric">
              <span>AI 总结</span>
              <strong>{{ activeProject.hasAiSummary ? '已生成' : '未生成' }}</strong>
            </div>
          </div>

          <el-alert
            v-if="activeProject.baiduBlockedDetected"
            :closable="false"
            show-icon
            :title="activeProject.statusMessage || '当前服务器环境命中了百度安全验证，暂时无法直接抓取 SERP。'"
            type="warning"
          />
          <el-alert
            v-else-if="activeProject.statusMessage"
            :closable="false"
            show-icon
            :title="activeProject.statusMessage"
            type="info"
          />

          <div v-if="activeProject.results.length > 0" class="geo-serp-results-list">
            <button
              v-for="result in activeProject.results"
              :key="result.id"
              :class="['geo-serp-result-card', { active: activeResultId === result.id }]"
              type="button"
              @click="activeResultId = result.id"
            >
              <div class="geo-serp-result-card__top">
                <div class="geo-serp-result-card__rank">
                  {{ activeProjectEngine === 'manual' ? `手动第 ${result.rank} 条` : `百度第 ${result.rank} 位` }}
                </div>
                <el-tag
                  :type="result.fetchStatus === 'ANALYZED' ? 'success' : 'warning'"
                  effect="light"
                  round
                  size="small"
                >
                  {{ result.fetchStatus === 'ANALYZED' ? '已解剖' : '抓取失败' }}
                </el-tag>
              </div>
              <h4>{{ result.title }}</h4>
              <p>{{ result.snippet || '该结果没有提取到可用摘要。' }}</p>
              <div class="geo-serp-result-card__meta">
                <span>{{ result.domain }}</span>
                <span>{{ result.patternTags.slice(0, 3).join(' / ') || '待识别写法标签' }}</span>
              </div>
            </button>
          </div>

          <el-empty
            v-else
            description="这个项目暂时没有拿到可研究的百家号结果。当前更像是一条研究记录，而不是内容列表。"
          />
        </template>

        <el-empty
          v-else
          description="还没有选中的研究项目。左侧开始一次关键词研究，或打开已有项目。"
        />
      </article>

      <article v-loading="projectLoading" class="surface-card section-card reveal-up" style="--delay: 0.16s">
        <div class="geo-serp-card-head">
          <div>
            <h3>文章解剖</h3>
            <p>从标题模式、关键词命中、结构提纲和正文规模四个层面，先把文章特征拆开看清楚。</p>
          </div>
        </div>

        <template v-if="activeResult">
          <div class="geo-serp-analysis-head">
            <div>
              <div class="geo-serp-analysis-head__rank">
                {{ activeProjectEngine === 'manual' ? `手动第 ${activeResult.rank} 条` : `百度第 ${activeResult.rank} 位` }}
              </div>
              <h4>{{ activeResult.title }}</h4>
            </div>
            <div class="geo-serp-analysis-tags">
              <el-tag
                v-for="tag in activeResult.patternTags"
                :key="tag"
                effect="light"
                round
              >
                {{ tag }}
              </el-tag>
              <el-tag
                v-if="activeResult.patternTags.length === 0"
                effect="light"
                round
                type="info"
              >
                暂未识别明显写法标签
              </el-tag>
            </div>
          </div>

          <div class="geo-serp-analysis-grid">
            <div class="geo-serp-analysis-metric">
              <span>标题模式</span>
              <strong>{{ activeResult.analysisSummary.titlePattern }}</strong>
            </div>
            <div class="geo-serp-analysis-metric">
              <span>标题长度</span>
              <strong>{{ activeResult.titleLength }} 字</strong>
            </div>
            <div class="geo-serp-analysis-metric">
              <span>正文长度</span>
              <strong>{{ activeResult.contentLength }} 字</strong>
            </div>
            <div class="geo-serp-analysis-metric">
              <span>段落数</span>
              <strong>{{ activeResult.paragraphCount }} 段</strong>
            </div>
          </div>

          <div class="geo-serp-analysis-grid geo-serp-analysis-grid--secondary">
            <div class="geo-serp-analysis-metric">
              <span>标题命中关键词</span>
              <strong>{{ activeResult.keywordHits.titleMatches }} 次</strong>
            </div>
            <div class="geo-serp-analysis-metric">
              <span>摘要命中关键词</span>
              <strong>{{ activeResult.keywordHits.snippetMatches }} 次</strong>
            </div>
            <div class="geo-serp-analysis-metric">
              <span>正文命中关键词</span>
              <strong>{{ activeResult.keywordHits.articleMatches }} 次</strong>
            </div>
            <div class="geo-serp-analysis-metric">
              <span>结构化分节</span>
              <strong>{{ activeResult.analysisSummary.hasHeadings ? '有' : '无' }}</strong>
            </div>
          </div>

          <div v-if="activeResult.fetchMessage" class="geo-serp-inline-note geo-serp-inline-note--warning">
            {{ activeResult.fetchMessage }}
          </div>

          <div class="geo-serp-detail-grid">
            <div class="geo-serp-detail-block">
              <h5>结果摘要</h5>
              <p>{{ activeResult.snippet || '没有提取到百度摘要。' }}</p>
            </div>
            <div class="geo-serp-detail-block">
              <h5>开头切入</h5>
              <p>{{ activeResult.analysisSummary.leadPreview || activeResult.articleExcerpt || '暂无可用预览。' }}</p>
            </div>
            <div class="geo-serp-detail-block">
              <h5>结构提纲</h5>
              <ul v-if="activeResult.headingOutline.length > 0" class="geo-serp-outline-list">
                <li v-for="item in activeResult.headingOutline" :key="item">{{ item }}</li>
              </ul>
              <p v-else>当前正文没有提取到明确的小标题提纲。</p>
            </div>
            <div class="geo-serp-detail-block">
              <h5>附加信息</h5>
              <ul class="geo-serp-meta-list">
                <li>作者：{{ activeResult.author || '未提取到作者' }}</li>
                <li>发布时间：{{ activeResult.publishAt || '未提取到发布时间' }}</li>
                <li>
                  搜索落地页：
                  <a
                    v-if="activeResult.searchUrl"
                    class="geo-serp-link"
                    :href="activeResult.searchUrl"
                    rel="noreferrer"
                    target="_blank"
                  >
                    打开链接
                  </a>
                  <span v-else>无</span>
                </li>
                <li>
                  最终页面：
                  <a
                    v-if="activeResult.finalUrl"
                    class="geo-serp-link"
                    :href="activeResult.finalUrl"
                    rel="noreferrer"
                    target="_blank"
                  >
                    打开链接
                  </a>
                  <span v-else>无</span>
                </li>
              </ul>
            </div>
          </div>
        </template>

        <el-empty
          v-else
          description="选中一篇结果后，这里会显示它的标题模式、关键词密度和文章结构解剖。"
        />
      </article>

      <article v-loading="projectLoading" class="surface-card section-card reveal-up" style="--delay: 0.2s">
        <div class="geo-serp-card-head">
          <div>
            <h3>AI 总结</h3>
            <p>在本地结构解剖之上，再用 AI 提炼“为什么它可能排前”的经验，后续会进入规则库沉淀。</p>
          </div>
          <el-tag v-if="displayedAiSummary" effect="light" round :type="displayedAiSummaryIsDraft ? 'warning' : 'success'">
            {{ displayedAiSummaryIsDraft ? '预览结果' : formatDisplayTime(displayedAiSummaryUpdatedAt) }}
          </el-tag>
        </div>

        <div v-if="aiSummaryGenerating" class="geo-serp-inline-note">
          {{ aiSummaryStreamingStatus || 'AI 总结生成中，原始流式输出和 Prompt 预览可在下方“高级/调试”中查看。' }}
        </div>

        <el-collapse v-if="activeProject" v-model="expandedAiSummaryPanels" class="geo-serp-debug-collapse">
          <el-collapse-item name="advanced">
            <template #title>
              <div class="geo-serp-debug-collapse__title">
                <strong>高级 / 调试</strong>
                <span>查看模型状态、原始流式输出、Prompt 预览和全文补抓统计</span>
              </div>
            </template>

            <div class="geo-serp-debug-grid">
              <div class="geo-serp-analysis-metric">
                <span>请求模型</span>
                <strong>{{ displayedRequestedModel }}</strong>
              </div>
              <div class="geo-serp-analysis-metric">
                <span>实际生成模型</span>
                <strong>{{ displayedActualModel }}</strong>
              </div>
              <div class="geo-serp-analysis-metric">
                <span>保底链路</span>
                <strong>{{ displayedAiSummary?.fallbackUsed ? '已触发' : '未触发' }}</strong>
              </div>
              <div class="geo-serp-analysis-metric">
                <span>当前状态</span>
                <strong>{{ aiSummaryGenerating ? '生成中' : displayedAiSummary ? '已完成' : '待生成' }}</strong>
              </div>
            </div>

            <div v-if="displayedFallbackReason" class="geo-serp-inline-note geo-serp-inline-note--warning">
              {{ displayedFallbackReason }}
            </div>

            <div class="geo-serp-debug-actions">
              <el-button
                :disabled="!canGenerateAiSummary"
                :loading="aiSummaryPromptLoading"
                plain
                @click="loadAiSummaryPromptPreview"
              >
                刷新 Prompt
              </el-button>
            </div>

            <div class="geo-serp-stream-panel geo-serp-stream-panel--debug">
              <div class="geo-serp-stream-panel__head">
                <strong>原始流式输出</strong>
                <span>{{ aiSummaryStreamingStatus || '这里保留正式生成链路里的原始模型输出。' }}</span>
              </div>
              <pre v-if="aiSummaryStreamText" class="geo-serp-stream-panel__content">{{ aiSummaryStreamText }}</pre>
              <p v-else class="geo-serp-stream-panel__placeholder">
                还没有可显示的原始流式输出。生成 AI 总结后，这里会保留模型返回的文本。
              </p>
            </div>

            <div v-loading="aiSummaryPromptLoading" class="geo-serp-debug-prompt-shell">
              <template v-if="aiSummaryPromptPreview">
                <div class="geo-serp-summary-meta geo-serp-summary-meta--debug">
                  <span>已解剖文章总数：{{ aiSummaryPromptPreview.analyzedCount }}</span>
                  <span>主 Prompt 使用：{{ aiSummaryPromptPreview.primaryIncludedCount }} 篇</span>
                  <span>保底 Prompt 使用：{{ aiSummaryPromptPreview.retryIncludedCount }} 篇</span>
                  <span>成功补全文：{{ aiSummaryPromptPreview.fullTextIncludedCount }} 篇</span>
                  <span>回退摘录：{{ aiSummaryPromptPreview.excerptFallbackCount }} 篇</span>
                </div>

                <div class="geo-serp-inline-note">
                  当前 Prompt 预览会直接展示真实发送给模型的全文输入内容，仅用于排查 AI 总结链路。
                </div>

                <div class="geo-serp-detail-grid geo-serp-detail-grid--prompt">
                  <div class="geo-serp-detail-block geo-serp-detail-block--prompt">
                    <h5>System Prompt</h5>
                    <pre class="geo-serp-prompt-output">{{ aiSummaryPromptPreview.systemPrompt }}</pre>
                  </div>
                  <div class="geo-serp-detail-block geo-serp-detail-block--prompt">
                    <h5>User Prompt</h5>
                    <pre class="geo-serp-prompt-output">{{ aiSummaryPromptPreview.userPrompt }}</pre>
                  </div>
                </div>

                <div class="geo-serp-detail-block geo-serp-detail-block--prompt geo-serp-detail-block--full">
                  <h5>保底重试 Prompt</h5>
                  <pre class="geo-serp-prompt-output">{{ aiSummaryPromptPreview.retryUserPrompt }}</pre>
                </div>
              </template>

              <el-empty
                v-else
                description="还没有加载 Prompt 预览。点击上方“刷新 Prompt”后，这里会显示当前正式页面真实发送给模型的内容。"
              />
            </div>
          </el-collapse-item>
        </el-collapse>

        <template v-if="displayedAiSummary">
          <div class="geo-serp-summary-head">
            <div class="geo-serp-summary-meta">
              <span>品类：{{ displayedAiSummary.category }}</span>
              <span>请求模型：{{ displayedAiSummary.requestedModel }}</span>
              <span>实际生成模型：{{ displayedAiSummary.model }}</span>
              <span>项目：{{ displayedAiSummary.projectKeyword }}</span>
            </div>
            <div class="geo-serp-summary-actions">
              <el-button :loading="aiSummaryGenerating || aiSummarySaving" plain type="primary" @click="generateAiSummary">
                重新生成
              </el-button>
            </div>
          </div>

          <div
            v-if="displayedAiSummary.fallbackUsed && displayedAiSummary.fallbackReason"
            class="geo-serp-inline-note geo-serp-inline-note--warning"
          >
            {{ displayedAiSummary.fallbackReason }}
          </div>

          <div class="geo-serp-summary-raw">
            {{ displayedAiSummary.rawSummary }}
          </div>

          <div class="geo-serp-summary-grid">
            <div
              v-for="section in aiSummarySections"
              :key="section.key"
              class="geo-serp-summary-block"
            >
              <h5>{{ section.title }}</h5>
              <ul class="geo-serp-outline-list">
                <li v-for="item in section.items" :key="item">{{ item }}</li>
              </ul>
            </div>
          </div>
        </template>

        <el-empty
          v-else
          description="当前项目还没有 AI 总结。先完成研究，再点击上面的“生成 AI 总结”。"
        />
      </article>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createGeoSerpProject,
  deleteGeoSerpProject,
  getGeoProfiles,
  getGeoSerpProjectAiSummaryPromptPreview,
  getGeoSerpProject,
  getGeoSerpProjects,
  saveGeoSerpProjectAiSummary,
  streamGeoSerpProjectAiSummary,
} from '@/api/geo'
import type {
  GeoProfileItem,
  GeoSerpAiSummary,
  GeoSerpAiSummaryDraft,
  GeoSerpAiSummaryPromptPreview,
  GeoSerpProjectDetail,
  GeoSerpProjectSummary,
  GeoSerpResearchMode,
  GeoSerpProjectStatus,
  GeoSerpResultItem,
} from '@/types/geo'

const projects = ref<GeoSerpProjectSummary[]>([])
const profiles = ref<GeoProfileItem[]>([])
const activeProjectId = ref<number | null>(null)
const activeProject = ref<GeoSerpProjectDetail | null>(null)
const activeResultId = ref<number | null>(null)

const loadingProjects = ref(false)
const projectLoading = ref(false)
const creating = ref(false)
const deleting = ref(false)
const aiSummaryGenerating = ref(false)
const aiSummarySaving = ref(false)
const aiSummaryStreamText = ref('')
const aiSummaryStreamingStatus = ref('')
const aiSummaryDraft = ref<GeoSerpAiSummaryDraft | null>(null)
const aiSummaryPromptPreview = ref<GeoSerpAiSummaryPromptPreview | null>(null)
const aiSummaryPromptLoading = ref(false)
const expandedAiSummaryPanels = ref<string[]>([])
let aiSummaryAbortController: AbortController | null = null

const researchForm = reactive({
  mode: 'automatic' as GeoSerpResearchMode,
  category: '',
  keyword: '',
  rankLimit: 10,
  articleUrlsText: '',
})

const researchModes: { label: string; value: GeoSerpResearchMode; description: string }[] = [
  {
    label: '自动模式',
    value: 'automatic',
    description: '输入关键词后自动抓取百度前排百家号结果',
  },
  {
    label: '手动模式',
    value: 'manual',
    description: '直接粘贴多个百家号文章链接，跳过 SERP 抓取',
  },
]

const parseManualArticleUrls = (value: string) => {
  return Array.from(
    new Set(
      value
        .split(/\n+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

const manualArticleUrls = computed(() => parseManualArticleUrls(researchForm.articleUrlsText))

const categoryOptions = computed(() => {
  const values = new Set<string>()

  for (const profile of profiles.value) {
    if (profile.product.type.trim()) {
      values.add(profile.product.type.trim())
    }
  }

  for (const project of projects.value) {
    if (project.category.trim()) {
      values.add(project.category.trim())
    }
  }

  if (researchForm.category.trim()) {
    values.add(researchForm.category.trim())
  }

  return Array.from(values)
})

const activeResult = computed<GeoSerpResultItem | null>(() => {
  if (!activeProject.value) return null

  return (
    activeProject.value.results.find((item) => item.id === activeResultId.value) ||
    activeProject.value.results[0] ||
    null
  )
})

const activeProjectEngine = computed(() => activeProject.value?.engine ?? 'baidu')
const canGenerateAiSummary = computed(() => {
  return Boolean(activeProject.value?.results.some((item) => item.fetchStatus === 'ANALYZED'))
})
const displayedAiSummary = computed<GeoSerpAiSummaryDraft | GeoSerpAiSummary | null>(() => {
  return aiSummaryDraft.value ?? activeProject.value?.aiSummary ?? null
})
const displayedAiSummaryIsDraft = computed(() => Boolean(aiSummaryDraft.value))
const displayedAiSummaryUpdatedAt = computed(() => {
  if (aiSummaryDraft.value) return ''
  return activeProject.value?.aiSummary?.updatedAt ?? ''
})
const displayedRequestedModel = computed(() => {
  return (
    aiSummaryPromptPreview.value?.requestedModel ||
    displayedAiSummary.value?.requestedModel ||
    '待获取'
  )
})
const displayedActualModel = computed(() => {
  return displayedAiSummary.value?.model || '等待生成'
})
const displayedFallbackReason = computed(() => {
  return displayedAiSummary.value?.fallbackReason?.trim() || ''
})

const aiSummarySections = computed(() => {
  const summary = displayedAiSummary.value
  if (!summary) return []

  return [
    { key: 'titlePatterns', title: '标题模式', items: summary.titlePatterns },
    { key: 'leadPatterns', title: '开头切入', items: summary.leadPatterns },
    { key: 'sectionBlueprint', title: '主体结构', items: summary.sectionBlueprint },
    { key: 'keywordPlacement', title: '关键词布局', items: summary.keywordPlacement },
    { key: 'sellingPointOrder', title: '卖点顺序', items: summary.sellingPointOrder },
    { key: 'trustSignals', title: '信任建立', items: summary.trustSignals },
    { key: 'endingPatterns', title: '结尾方式', items: summary.endingPatterns },
    { key: 'antiPatterns', title: '明显禁忌', items: summary.antiPatterns },
    { key: 'rankingHypotheses', title: '排名假设', items: summary.rankingHypotheses },
  ].filter((item) => item.items.length > 0)
})

watch(
  () => activeProject.value?.results,
  (results) => {
    if (!results || results.length === 0) {
      activeResultId.value = null
      return
    }

    if (!results.some((item) => item.id === activeResultId.value)) {
      activeResultId.value = results[0].id
    }
  },
  { immediate: true }
)

const projectStatusLabel = (status: GeoSerpProjectStatus) => {
  if (status === 'SUCCEEDED') return '研究完成'
  if (status === 'BLOCKED') return '被百度拦截'
  return '研究失败'
}

const projectStatusTagType = (status: GeoSerpProjectStatus) => {
  if (status === 'SUCCEEDED') return 'success'
  if (status === 'BLOCKED') return 'warning'
  return 'danger'
}

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

const toProjectSummary = (project: GeoSerpProjectDetail): GeoSerpProjectSummary => ({
  id: project.id,
  category: project.category,
  keyword: project.keyword,
  rankLimit: project.rankLimit,
  engine: project.engine,
  domainFilter: project.domainFilter,
  status: project.status,
  statusMessage: project.statusMessage,
  inspectedCount: project.inspectedCount,
  matchedCount: project.matchedCount,
  baiduBlockedDetected: project.baiduBlockedDetected,
  hasAiSummary: project.hasAiSummary,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
})

const syncProjectInList = (project: GeoSerpProjectDetail) => {
  const summary = toProjectSummary(project)
  const nextProjects = projects.value.filter((item) => item.id !== project.id)
  projects.value = [summary, ...nextProjects]
}

const resetAiSummaryStreamState = () => {
  aiSummaryStreamText.value = ''
  aiSummaryStreamingStatus.value = ''
  aiSummaryDraft.value = null
}

const resetAiSummaryPromptPreview = () => {
  aiSummaryPromptPreview.value = null
}

const abortAiSummaryStream = () => {
  aiSummaryAbortController?.abort()
  aiSummaryAbortController = null
}

const loadAiSummaryPromptPreview = async () => {
  if (!activeProject.value) {
    resetAiSummaryPromptPreview()
    return
  }

  aiSummaryPromptLoading.value = true

  try {
    aiSummaryPromptPreview.value = await getGeoSerpProjectAiSummaryPromptPreview(activeProject.value.id)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'AI 总结 Prompt 预览加载失败')
  } finally {
    aiSummaryPromptLoading.value = false
  }
}

const loadProfiles = async () => {
  profiles.value = await getGeoProfiles()
}

const loadProjects = async () => {
  loadingProjects.value = true

  try {
    const list = await getGeoSerpProjects()
    projects.value = list

    if (activeProjectId.value) {
      const stillExists = list.some((item) => item.id === activeProjectId.value)
      if (stillExists) {
        await selectProject(activeProjectId.value, false)
        return
      }
    }

    if (list.length > 0) {
      await selectProject(list[0].id, false)
    } else {
      activeProjectId.value = null
      activeProject.value = null
      activeResultId.value = null
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '研究项目列表加载失败')
  } finally {
    loadingProjects.value = false
  }
}

const selectProject = async (id: number, withLoading = true) => {
  abortAiSummaryStream()
  resetAiSummaryStreamState()
  resetAiSummaryPromptPreview()
  activeProjectId.value = id

  if (withLoading) {
    projectLoading.value = true
  }

  try {
    const project = await getGeoSerpProject(id)
    activeProject.value = project
    activeResultId.value = project.results[0]?.id ?? null
    syncProjectInList(project)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '研究项目详情加载失败')
  } finally {
    if (withLoading) {
      projectLoading.value = false
    }
  }
}

const createProject = async () => {
  if (!researchForm.category.trim()) {
    ElMessage.warning('请先填写这次研究对应的产品品类')
    return
  }

  if (researchForm.mode === 'automatic' && !researchForm.keyword.trim()) {
    ElMessage.warning('自动模式下请先输入一个要研究的搜索关键词')
    return
  }

  if (researchForm.mode === 'manual' && manualArticleUrls.value.length === 0) {
    ElMessage.warning('手动模式下请至少粘贴一个百家号文章链接')
    return
  }

  creating.value = true

  try {
    const project = await createGeoSerpProject({
      mode: researchForm.mode,
      category: researchForm.category.trim(),
      keyword: researchForm.keyword.trim() || undefined,
      rankLimit: researchForm.mode === 'automatic' ? researchForm.rankLimit : undefined,
      articleUrls: researchForm.mode === 'manual' ? manualArticleUrls.value : undefined,
    })

    activeProjectId.value = project.id
    activeProject.value = project
    activeResultId.value = project.results[0]?.id ?? null
    resetAiSummaryPromptPreview()
    syncProjectInList(project)

    if (project.baiduBlockedDetected) {
      ElMessage.warning('研究项目已保存，但当前环境被百度安全验证拦截')
    } else if (researchForm.mode === 'manual') {
      ElMessage.success('手动研究项目已创建')
    } else {
      ElMessage.success('SERP 研究项目已创建')
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '研究项目创建失败')
  } finally {
    creating.value = false
  }
}

const generateAiSummary = async () => {
  if (!activeProject.value) return

  if (!canGenerateAiSummary.value) {
    ElMessage.warning('当前项目至少需要一篇解剖成功的文章，才能生成 AI 总结')
    return
  }

  abortAiSummaryStream()
  resetAiSummaryStreamState()
  aiSummaryGenerating.value = true
  aiSummarySaving.value = false
  const hadSummary = activeProject.value.hasAiSummary
  aiSummaryAbortController = new AbortController()
  const currentProjectId = activeProject.value.id

  try {
    await streamGeoSerpProjectAiSummary(currentProjectId, {
      signal: aiSummaryAbortController.signal,
      onEvent: (event) => {
        if (event.type === 'text') {
          aiSummaryStreamText.value += event.content ?? ''
          return
        }

        if (event.type === 'status') {
          aiSummaryStreamingStatus.value = event.content ?? ''
          return
        }

        if (event.type === 'reset') {
          aiSummaryStreamText.value = ''
          return
        }

        if (event.type === 'result' && event.summary) {
          aiSummaryDraft.value = event.summary
        }
      },
    })

    if (!aiSummaryDraft.value) {
      throw new Error('AI 总结已完成，但没有拿到可保存的结构化结果')
    }

    await nextTick()
    aiSummarySaving.value = true
    aiSummaryStreamingStatus.value = '已拿到完整结构化结果，正在保存到数据库...'
    const draftMeta = aiSummaryDraft.value
    const savedSummary = await saveGeoSerpProjectAiSummary(currentProjectId, draftMeta)
    const summary: GeoSerpAiSummary = {
      ...savedSummary,
      requestedModel: draftMeta.requestedModel,
      fallbackUsed: draftMeta.fallbackUsed,
      fallbackReason: draftMeta.fallbackReason,
    }

    if (!activeProject.value || activeProject.value.id !== currentProjectId) {
      return
    }

    activeProject.value = {
      ...activeProject.value,
      hasAiSummary: true,
      aiSummary: summary,
    }
    syncProjectInList(activeProject.value)
    aiSummaryDraft.value = null
    aiSummaryStreamingStatus.value = 'AI 总结已保存'
    ElMessage.success(hadSummary ? 'AI 总结已更新' : 'AI 总结已生成')
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return
    }

    ElMessage.error(error instanceof Error ? error.message : 'AI 总结生成失败')
  } finally {
    abortAiSummaryStream()
    aiSummarySaving.value = false
    aiSummaryGenerating.value = false
  }
}

const removeProject = async (project: GeoSerpProjectSummary | GeoSerpProjectDetail) => {
  try {
    await ElMessageBox.confirm(
      `确定删除“${project.keyword}”这条研究项目吗？删除后结果列表和 AI 总结都会一起清掉。`,
      '删除研究项目',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
  } catch {
    return
  }

  deleting.value = true

  try {
    await deleteGeoSerpProject(project.id)
    projects.value = projects.value.filter((item) => item.id !== project.id)

    if (activeProjectId.value === project.id) {
      const nextProject = projects.value[0]
      if (nextProject) {
        await selectProject(nextProject.id)
      } else {
        activeProjectId.value = null
        activeProject.value = null
        activeResultId.value = null
        resetAiSummaryPromptPreview()
      }
    }

    ElMessage.success('研究项目已删除')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '研究项目删除失败')
  } finally {
    deleting.value = false
  }
}

const resetResearchForm = () => {
  researchForm.mode = 'automatic'
  researchForm.category = ''
  researchForm.keyword = ''
  researchForm.rankLimit = 10
  researchForm.articleUrlsText = ''
}

onMounted(() => {
  Promise.all([loadProjects(), loadProfiles()]).catch((error) => {
    ElMessage.error(error instanceof Error ? error.message : 'SERP 研究数据加载失败')
  })
})

onBeforeUnmount(() => {
  abortAiSummaryStream()
})
</script>

<style scoped>
.geo-serp-layout {
  display: grid;
  grid-template-columns: minmax(340px, 0.95fr) minmax(0, 1.75fr);
  gap: 18px;
}

.geo-serp-sidebar,
.geo-serp-main {
  display: grid;
  gap: 18px;
}

.geo-serp-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
}

.geo-serp-card-head--top {
  margin-bottom: 18px;
}

.geo-serp-card-head h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: var(--brand-ink);
}

.geo-serp-card-head p {
  margin: 5px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--brand-muted);
}

.geo-serp-form {
  display: grid;
  gap: 2px;
}

.geo-serp-mode-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.geo-serp-mode-switch__item {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  text-align: left;
  cursor: pointer;
  border: 1px solid rgba(216, 178, 180, 0.26);
  border-radius: 16px;
  background: rgba(255, 252, 251, 0.94);
  transition:
    border-color 0.22s ease,
    transform 0.22s ease,
    box-shadow 0.22s ease,
    background 0.22s ease;
}

.geo-serp-mode-switch__item strong {
  font-size: 13px;
  color: var(--brand-ink);
}

.geo-serp-mode-switch__item span {
  font-size: 12px;
  line-height: 1.65;
  color: var(--brand-muted);
}

.geo-serp-mode-switch__item:hover {
  transform: translateY(-1px);
  border-color: rgba(217, 107, 114, 0.28);
}

.geo-serp-mode-switch__item.active {
  border-color: rgba(217, 107, 114, 0.34);
  background: linear-gradient(180deg, rgba(255, 250, 249, 0.98), rgba(255, 243, 242, 0.96));
  box-shadow: 0 12px 24px rgba(178, 109, 97, 0.08);
}

.geo-serp-actions {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

.geo-serp-inline-note {
  margin-top: 14px;
  padding: 11px 13px;
  font-size: 12px;
  line-height: 1.75;
  color: #8a5e63;
  border: 1px dashed rgba(217, 107, 114, 0.28);
  border-radius: 14px;
  background: rgba(255, 245, 244, 0.92);
}

.geo-serp-inline-note--warning {
  color: #9b693d;
  border-color: rgba(234, 162, 84, 0.24);
  background: rgba(255, 248, 238, 0.94);
}

.geo-serp-debug-collapse {
  margin: 16px 0;
  border: 1px solid rgba(216, 178, 180, 0.22);
  border-radius: 18px;
  background: rgba(255, 252, 251, 0.96);
  overflow: hidden;
}

.geo-serp-debug-collapse :deep(.el-collapse) {
  border: none;
}

.geo-serp-debug-collapse :deep(.el-collapse-item__header) {
  padding: 0 18px;
  min-height: 62px;
  border: none;
  background: transparent;
}

.geo-serp-debug-collapse :deep(.el-collapse-item__wrap) {
  border: none;
  background: rgba(255, 252, 251, 0.72);
}

.geo-serp-debug-collapse :deep(.el-collapse-item__content) {
  padding: 0 18px 18px;
}

.geo-serp-debug-collapse__title {
  display: grid;
  gap: 4px;
}

.geo-serp-debug-collapse__title strong {
  font-size: 13px;
  color: var(--brand-ink);
}

.geo-serp-debug-collapse__title span {
  font-size: 12px;
  line-height: 1.7;
  color: var(--brand-muted);
}

.geo-serp-debug-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.geo-serp-debug-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 14px;
}

.geo-serp-project-list {
  display: grid;
  gap: 12px;
  max-height: 620px;
  overflow: auto;
  padding-right: 4px;
}

.geo-serp-project-card,
.geo-serp-result-card {
  width: 100%;
  padding: 14px 15px;
  text-align: left;
  cursor: pointer;
  border: 1px solid rgba(216, 178, 180, 0.26);
  border-radius: 18px;
  background: rgba(255, 253, 252, 0.94);
  transition:
    transform 0.24s ease,
    border-color 0.24s ease,
    box-shadow 0.24s ease,
    background 0.24s ease;
}

.geo-serp-project-card:hover,
.geo-serp-result-card:hover {
  transform: translateY(-1px);
  border-color: rgba(217, 107, 114, 0.28);
  box-shadow: 0 14px 28px rgba(178, 109, 97, 0.08);
}

.geo-serp-project-card.active,
.geo-serp-result-card.active {
  border-color: rgba(217, 107, 114, 0.34);
  background: linear-gradient(180deg, rgba(255, 250, 249, 0.98), rgba(255, 243, 242, 0.96));
  box-shadow: 0 16px 32px rgba(178, 109, 97, 0.1);
}

.geo-serp-project-card__top,
.geo-serp-result-card__top,
.geo-serp-summary-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.geo-serp-project-card__top strong,
.geo-serp-result-card h4 {
  font-size: 14px;
  color: var(--brand-ink);
}

.geo-serp-project-card__meta,
.geo-serp-result-card__meta,
.geo-serp-summary-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--brand-muted);
}

.geo-serp-project-card p,
.geo-serp-result-card p {
  margin: 9px 0 0;
  font-size: 12px;
  line-height: 1.75;
  color: #806f74;
}

.geo-serp-project-card__time {
  margin-top: 11px;
  font-size: 11px;
  color: #9f8f93;
}

.geo-serp-overview-actions,
.geo-serp-summary-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.geo-serp-metric-grid,
.geo-serp-analysis-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.geo-serp-analysis-grid--secondary {
  margin-bottom: 18px;
}

.geo-serp-metric,
.geo-serp-analysis-metric,
.geo-serp-summary-block,
.geo-serp-detail-block {
  padding: 13px 14px;
  border: 1px solid rgba(216, 178, 180, 0.22);
  border-radius: 16px;
  background: rgba(255, 251, 250, 0.96);
}

.geo-serp-metric span,
.geo-serp-analysis-metric span {
  display: block;
  font-size: 12px;
  color: var(--brand-muted);
}

.geo-serp-metric strong,
.geo-serp-analysis-metric strong {
  display: block;
  margin-top: 7px;
  font-size: 15px;
  color: var(--brand-ink);
}

.geo-serp-results-list {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.geo-serp-result-card__rank,
.geo-serp-analysis-head__rank {
  font-size: 12px;
  font-weight: 600;
  color: var(--brand-primary-strong);
}

.geo-serp-result-card h4,
.geo-serp-analysis-head h4 {
  margin: 8px 0 0;
  line-height: 1.55;
  color: var(--brand-ink);
}

.geo-serp-analysis-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.geo-serp-analysis-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.geo-serp-detail-grid,
.geo-serp-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.geo-serp-detail-block {
  min-height: 140px;
}

.geo-serp-summary-raw {
  margin: 16px 0;
  padding: 14px 15px;
  font-size: 13px;
  line-height: 1.85;
  color: #6d5e64;
  border: 1px solid rgba(216, 178, 180, 0.22);
  border-radius: 18px;
  background: rgba(255, 252, 251, 0.95);
}

.geo-serp-stream-panel {
  margin-bottom: 16px;
  padding: 14px 15px;
  border: 1px dashed rgba(217, 107, 114, 0.28);
  border-radius: 18px;
  background: rgba(255, 247, 246, 0.92);
}

.geo-serp-stream-panel--debug {
  margin-top: 4px;
}

.geo-serp-stream-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.geo-serp-stream-panel__head strong {
  font-size: 13px;
  color: var(--brand-ink);
}

.geo-serp-stream-panel__head span,
.geo-serp-stream-panel__placeholder {
  font-size: 12px;
  line-height: 1.75;
  color: var(--brand-muted);
}

.geo-serp-stream-panel__placeholder {
  margin: 10px 0 0;
}

.geo-serp-stream-panel__content {
  margin: 12px 0 0;
  padding: 12px;
  max-height: 280px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.7;
  color: #6d5e64;
  border-radius: 14px;
  background: rgba(255, 252, 251, 0.9);
}

.geo-serp-debug-prompt-shell {
  display: grid;
  gap: 14px;
}

.geo-serp-summary-meta--debug {
  margin-top: 0;
}

.geo-serp-detail-grid--prompt {
  align-items: stretch;
}

.geo-serp-detail-block--prompt {
  min-height: 360px;
}

.geo-serp-detail-block--full {
  margin-top: 14px;
}

.geo-serp-prompt-output {
  margin: 0;
  max-height: 420px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.7;
  color: #6d5e64;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 252, 251, 0.9);
}

.geo-serp-summary-block h5,
.geo-serp-detail-block h5 {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--brand-ink);
}

.geo-serp-detail-block p,
.geo-serp-outline-list,
.geo-serp-meta-list {
  margin: 0;
  font-size: 12px;
  line-height: 1.85;
  color: #77686d;
}

.geo-serp-outline-list,
.geo-serp-meta-list {
  padding-left: 18px;
}

.geo-serp-link {
  color: var(--brand-primary-strong);
}

@media (max-width: 1360px) {
  .geo-serp-layout {
    grid-template-columns: 1fr;
  }

  .geo-serp-mode-switch,
  .geo-serp-metric-grid,
  .geo-serp-analysis-grid,
  .geo-serp-debug-grid,
  .geo-serp-detail-grid,
  .geo-serp-summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
