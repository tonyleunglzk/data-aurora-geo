<template>
  <section class="publication-layout">
    <article class="surface-card section-card publication-hero reveal-up">
      <div>
        <h3>发文反馈</h3>
        <p>记录下游 AI 文章发布后的基础信息，把发布链接与 Prompt Engine 批量生成的提示词编号串起来。</p>
      </div>
      <div class="publication-hero__actions">
        <el-button :loading="loading || statsLoading" plain @click="refreshPublicationData">刷新</el-button>
        <el-upload
          ref="importUploadRef"
          class="publication-upload"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          :auto-upload="false"
          :show-file-list="false"
          :on-change="handleImportFileChange"
        >
          <el-button :icon="Upload" :loading="importing" plain>批量导入 Excel</el-button>
        </el-upload>
        <el-button type="primary" @click="openCreateDialog">新增发文记录</el-button>
      </div>
    </article>

    <article class="surface-card section-card publication-filter reveal-up" style="--delay: 0.08s">
      <el-form label-position="top">
        <div class="publication-filter__grid">
          <el-form-item label="日期范围">
            <el-date-picker
              v-model="filters.dateRange"
              type="daterange"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              clearable
            />
          </el-form-item>
          <el-form-item label="产品">
            <el-select v-model="filters.product" clearable placeholder="全部产品">
              <el-option v-for="item in publicationOptions.products" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="平台">
            <el-select v-model="filters.platform" clearable placeholder="全部平台">
              <el-option v-for="item in publicationOptions.platforms" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="账号类型">
            <el-select v-model="filters.accountType" clearable placeholder="全部账号">
              <el-option v-for="item in publicationOptions.accountTypes" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="提示词编号">
            <el-input v-model="filters.promptCode" clearable placeholder="输入编号片段" />
          </el-form-item>
          <el-form-item label="标题 / 作者 / 链接">
            <el-input v-model="filters.keyword" clearable placeholder="输入关键词" />
          </el-form-item>
        </div>
      </el-form>
      <div class="publication-filter__actions">
        <el-button @click="resetFilters">重置</el-button>
        <el-button type="primary" @click="applyFilters">筛选</el-button>
      </div>
    </article>

    <article
      v-loading="statsLoading"
      class="surface-card section-card publication-stats-card reveal-up"
      style="--delay: 0.12s"
    >
      <div class="publication-card-head">
        <div>
          <h3>数据抓取统计</h3>
          <p>按当前筛选范围统计发文与百度 AI 引用命中表现。</p>
        </div>
        <el-tag effect="light" round>项目周趋势</el-tag>
      </div>

      <div class="publication-metric-grid">
        <div v-for="item in statsMetrics" :key="item.label" class="publication-metric">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <em>{{ item.hint }}</em>
        </div>
      </div>

      <div class="publication-stats-main">
        <div class="publication-trend-panel">
          <div class="publication-subhead">
            <strong>周度趋势</strong>
            <span>从项目最早发文所在周开始计算</span>
          </div>
          <EChartPanel
            v-if="publicationStats.weeklyTrend.length > 0"
            :option="weeklyTrendOption"
            height="300px"
          />
          <el-empty v-else description="暂无可统计的周趋势" :image-size="96" />
        </div>

        <div class="publication-stats-tables">
          <div class="publication-stat-table">
            <div class="publication-subhead">
              <strong>产品分布</strong>
              <span>{{ publicationStats.productStats.length }} 个产品</span>
            </div>
            <el-table :data="publicationStats.productStats" size="small" empty-text="暂无产品数据">
              <el-table-column label="产品" prop="product" min-width="100" />
              <el-table-column label="发文" prop="publicationCount" width="72" />
              <el-table-column label="命中" prop="matchedRecordCount" width="72" />
              <el-table-column label="命中率" width="82">
                <template #default="{ row }">{{ formatRate(row.matchRate) }}</template>
              </el-table-column>
            </el-table>
          </div>

          <div class="publication-stat-table">
            <div class="publication-subhead">
              <strong>关键词表现</strong>
              <span>{{ publicationStats.keywordStats.length }} 组关键词</span>
            </div>
            <el-table :data="publicationStats.keywordStats.slice(0, 8)" size="small" empty-text="暂无关键词数据">
              <el-table-column label="关键词" min-width="180">
                <template #default="{ row }">
                  <div class="publication-keyword-cell">
                    <strong>{{ row.keyword }}</strong>
                    <span>{{ row.product }} · 成功 {{ row.successCount }} / 无 AI {{ row.noAiCount }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="引用" prop="citationCount" width="72" />
              <el-table-column label="命中" prop="matchedCitationCount" width="72" />
            </el-table>
          </div>

          <div class="publication-stat-table">
            <div class="publication-subhead">
              <strong>提示词编号</strong>
              <span>按发文记录汇总</span>
            </div>
            <el-table :data="publicationStats.promptCodeStats.slice(0, 8)" size="small" empty-text="暂无提示词数据">
              <el-table-column label="编号" min-width="180">
                <template #default="{ row }">
                  <code class="publication-prompt-code">{{ row.promptCode }}</code>
                </template>
              </el-table-column>
              <el-table-column label="发文" prop="publicationCount" width="72" />
              <el-table-column label="命中" prop="matchedRecordCount" width="72" />
              <el-table-column label="命中率" width="82">
                <template #default="{ row }">{{ formatRate(row.matchRate) }}</template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
    </article>

    <div class="publication-grid">
      <article class="surface-card section-card publication-table-card reveal-up" style="--delay: 0.14s">
        <div class="publication-card-head">
          <div>
            <h3>发文记录</h3>
            <p>当前显示最近匹配的 {{ records.length }} 条记录。</p>
          </div>
        </div>

        <el-table v-loading="loading" :data="records" empty-text="暂无发文记录">
          <el-table-column label="日期" prop="publishedAt" width="120" />
          <el-table-column label="产品" prop="product" width="110" />
          <el-table-column label="平台" prop="platform" width="120" />
          <el-table-column label="账号" prop="accountType" width="100" />
          <el-table-column label="标题" min-width="260">
            <template #default="{ row }">
              <div class="publication-title-cell">
                <strong>{{ row.title }}</strong>
                <a v-if="row.link" :href="row.link" target="_blank" rel="noreferrer">打开链接</a>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="作者" prop="author" width="130" />
          <el-table-column label="提示词编号" min-width="260">
            <template #default="{ row }">
              <div class="publication-code-cell">
                <code>{{ row.promptCode }}</code>
                <span v-if="row.promptProductProfile">
                  {{ row.promptProductProfile }} · {{ row.promptVersionName || '未知版本' }}
                </span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="百度 AI" width="150">
            <template #default="{ row }">
              <div class="publication-ai-cell">
                <el-tag :type="row.baiduAiMatched ? 'success' : 'info'" effect="light" round>
                  {{ row.baiduAiMatched ? '已命中' : '未命中' }}
                </el-tag>
                <span v-if="row.baiduAiMatched">
                  {{ row.baiduAiMatchedKeywordCount }} 词 / {{ row.baiduAiCitationCount }} 次
                </span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
              <el-button link type="danger" @click="deleteRecord(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </article>

      <article class="surface-card section-card publication-crawler-card reveal-up" style="--delay: 0.2s">
        <div class="publication-card-head">
          <div>
            <h3>数据抓取端</h3>
            <p>每天定时统计百度 AI 回答是否引用你的发文链接，也可以手动立即抓取。</p>
          </div>
          <el-tag :type="crawlSetting.isEnabled ? 'success' : 'info'" effect="light" round>
            {{ crawlSetting.isEnabled ? '自动开启' : '自动关闭' }}
          </el-tag>
        </div>

        <div class="crawler-panel">
          <el-form label-position="top">
            <el-form-item label="每日自动统计">
              <el-switch v-model="crawlSettingForm.isEnabled" active-text="开启" inactive-text="关闭" />
            </el-form-item>
            <el-form-item label="执行时间">
              <el-time-picker
                v-model="crawlSettingForm.dailyRunTime"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="选择时间"
              />
            </el-form-item>
            <div class="crawler-panel__grid">
              <el-form-item label="统计近 N 天">
                <el-input-number v-model="crawlSettingForm.lookbackDays" :min="1" :max="365" />
              </el-form-item>
              <el-form-item label="最多关键词">
                <el-input-number v-model="crawlSettingForm.maxKeywordsPerRun" :min="1" :max="100" />
              </el-form-item>
            </div>
          </el-form>
          <div class="crawler-panel__actions">
            <el-button :loading="crawlSaving" plain @click="saveCrawlSetting">保存设置</el-button>
            <el-button :loading="crawlStarting" type="primary" @click="startManualCrawl">立即抓取</el-button>
          </div>
        </div>

        <el-divider />

        <div class="crawler-keywords">
          <div class="crawler-section-title">
            <strong>关键词组</strong>
            <span>{{ crawlKeywords.length }} 个</span>
          </div>
          <div class="crawler-keyword-list">
            <el-tag
              v-for="item in crawlKeywords"
              :key="item.id"
              :type="item.isActive ? 'primary' : 'info'"
              effect="light"
              round
            >
              {{ item.product }} · {{ item.keyword }}
            </el-tag>
          </div>
          <div class="crawler-add-keyword">
            <el-select v-model="newKeyword.product" allow-create filterable placeholder="产品">
              <el-option v-for="item in publicationOptions.products" :key="item" :label="item" :value="item" />
            </el-select>
            <el-input v-model="newKeyword.keyword" placeholder="新增百度 AI 统计关键词" />
            <el-button :loading="keywordSaving" @click="addCrawlKeyword">添加</el-button>
          </div>
        </div>

        <el-divider />

        <div class="crawler-jobs">
          <div class="crawler-section-title">
            <strong>最近任务</strong>
            <el-button link type="primary" @click="loadCrawlData">刷新</el-button>
          </div>
          <div v-if="crawlJobs.length === 0" class="crawler-empty">暂无抓取任务</div>
          <div
            v-for="job in crawlJobs.slice(0, 5)"
            :key="job.id"
            class="crawler-job"
            role="button"
            tabindex="0"
            @click="openCrawlJobDetail(job)"
            @keydown.enter="openCrawlJobDetail(job)"
          >
            <div class="crawler-job__head">
              <strong>#{{ job.id }} {{ job.triggerType === 'AUTO' ? '自动' : '手动' }}</strong>
              <el-tag :type="crawlJobTagType(job.status)" effect="light" round>{{ crawlJobStatusText(job.status) }}</el-tag>
            </div>
            <p>
              {{ job.product || '全部产品' }} · {{ job.keywordCount }} 词 · 命中 {{ job.matchedCitationCount }} 次
            </p>
            <div class="crawler-job__metrics">
              <span>成功 {{ job.successCount }}</span>
              <span>无 AI {{ job.noAiCount }}</span>
              <span>拦截 {{ job.blockedCount }}</span>
              <span>失败 {{ job.failedCount }}</span>
            </div>
            <el-progress
              :percentage="crawlJobProgress(job)"
              :stroke-width="8"
              :show-text="false"
              :status="job.status === 'FAILED' ? 'exception' : job.status === 'COMPLETED' ? 'success' : undefined"
            />
            <p v-if="job.lastError" class="crawler-job__error">{{ job.lastError }}</p>
          </div>
        </div>
      </article>
    </div>

    <el-dialog v-model="dialogVisible" :title="editingRecord ? '编辑发文记录' : '新增发文记录'" width="760px">
      <el-form class="publication-dialog-form" label-position="top">
        <div class="publication-dialog-grid">
          <el-form-item label="日期">
            <el-date-picker v-model="form.publishedAt" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
          </el-form-item>
          <el-form-item label="产品">
            <el-select
              v-model="form.product"
              allow-create
              filterable
              placeholder="选择或输入产品"
            >
              <el-option v-for="item in publicationOptions.products" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="平台">
            <el-select
              v-model="form.platform"
              allow-create
              filterable
              placeholder="选择或输入平台"
            >
              <el-option v-for="item in publicationOptions.platforms" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="账号类型">
            <el-select
              v-model="form.accountType"
              allow-create
              filterable
              placeholder="选择或输入账号类型"
            >
              <el-option v-for="item in publicationOptions.accountTypes" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </div>

        <el-form-item label="标题">
          <el-input v-model="form.title" maxlength="180" show-word-limit placeholder="填写已发布文章标题" />
        </el-form-item>

        <div class="publication-dialog-grid">
          <el-form-item label="作者">
            <el-input v-model="form.author" placeholder="填写作者" />
          </el-form-item>
          <el-form-item label="提示词编号">
            <el-select
              v-model="form.promptCode"
              allow-create
              clearable
              filterable
              remote
              reserve-keyword
              :loading="promptCodeLoading"
              :remote-method="loadPromptCodeOptions"
              placeholder="手填或搜索历史 txt 文件编号"
              @change="handlePromptCodeChange"
            >
              <el-option
                v-for="item in promptCodeOptions"
                :key="item.promptBatchJobItemId"
                :label="item.promptCode"
                :value="item.promptCode"
              >
                <div class="publication-code-option">
                  <strong>{{ item.promptCode }}</strong>
                  <span>{{ item.productProfile }} · {{ item.versionName }} · {{ formatDisplayTime(item.generatedAt) }}</span>
                </div>
              </el-option>
            </el-select>
          </el-form-item>
        </div>

        <el-form-item label="链接">
          <el-input v-model="form.link" placeholder="填写已发布文章链接" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button :loading="saving" type="primary" @click="saveRecord">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importResultVisible" :title="importDialogTitle" width="760px">
      <div v-if="importResult" class="publication-import-result">
        <div
          class="publication-import-summary"
          :class="{ 'publication-import-summary--failed': !importResult.success }"
        >
          <span>工作表：{{ importResult.sheetName }}</span>
          <span>总行数 {{ importResult.totalRows }}</span>
          <strong>新增 {{ importResult.createdCount }}</strong>
          <span>跳过 {{ importResult.skippedCount }}</span>
          <span>失败 {{ importResult.failedCount }}</span>
          <span>回填命中 {{ importResult.rematchedCitationCount }}</span>
        </div>
        <el-alert
          v-if="!importResult.success"
          type="error"
          show-icon
          :closable="false"
          :title="importResult.message"
          description="本次没有导入任何发文记录，请修正下方问题行后重新上传。"
        />
        <el-alert
          v-else-if="importResult.rematchedCitationCount > 0"
          type="success"
          show-icon
          :closable="false"
          title="已把历史抓取引用回填到本次导入的发文链接"
        />
        <el-table :data="importProblemItems" max-height="360" size="small" empty-text="全部通过">
          <el-table-column label="行号" prop="rowNumber" width="80" />
          <el-table-column label="标题" prop="title" min-width="220" show-overflow-tooltip />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.status === 'FAILED' ? 'danger' : 'warning'" effect="light" round>
                {{ row.status === 'FAILED' ? '失败' : '不通过' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="原因" prop="reason" min-width="180" show-overflow-tooltip />
        </el-table>
      </div>
      <template #footer>
        <el-button type="primary" @click="importResultVisible = false">知道了</el-button>
      </template>
    </el-dialog>

    <el-drawer
      v-model="crawlDetailVisible"
      :title="activeCrawlJob ? `抓取任务 #${activeCrawlJob.id}` : '抓取任务详情'"
      size="720px"
      append-to-body
    >
      <div v-if="activeCrawlJob" class="crawler-detail">
        <div class="crawler-detail__summary">
          <div>
            <strong>{{ activeCrawlJob.product || '全部产品' }}</strong>
            <span>{{ activeCrawlJob.keywordCount }} 个关键词 · 命中 {{ activeCrawlJob.matchedCitationCount }} 次</span>
          </div>
          <el-tag :type="crawlJobTagType(activeCrawlJob.status)" effect="light" round>
            {{ crawlJobStatusText(activeCrawlJob.status) }}
          </el-tag>
        </div>

        <el-progress
          :percentage="crawlJobProgress(activeCrawlJob)"
          :status="activeCrawlJob.status === 'FAILED' ? 'exception' : activeCrawlJob.status === 'COMPLETED' ? 'success' : undefined"
        />

        <el-alert
          v-if="activeCrawlJob.lastError"
          :title="activeCrawlJob.lastError"
          type="error"
          show-icon
          :closable="false"
        />

        <el-table :data="activeCrawlJob.results" empty-text="暂无关键词结果">
          <el-table-column type="expand">
            <template #default="{ row }">
              <div class="crawler-citation-list">
                <div v-if="row.citations.length === 0" class="crawler-empty">暂无引用链接</div>
                <div v-for="citation in row.citations" :key="citation.id" class="crawler-citation">
                  <div>
                    <a :href="citation.url" target="_blank" rel="noreferrer">
                      {{ citation.title || citation.url }}
                    </a>
                    <span>{{ citation.sourceName || '未知来源' }} · {{ citation.authorName || '未知作者' }}</span>
                  </div>
                  <el-tag :type="citation.isMatched ? 'success' : 'info'" effect="light" round>
                    {{ citation.isMatched ? '已命中' : '未命中' }}
                  </el-tag>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="关键词" min-width="220">
            <template #default="{ row }">
              <div class="crawler-result-keyword">
                <strong>{{ row.keyword }}</strong>
                <span>{{ row.product }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="crawlResultTagType(row.status)" effect="light" round>
                {{ crawlResultStatusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="引用 / 命中" width="120">
            <template #default="{ row }">
              {{ row.citationCount }} / {{ row.matchedCitationCount }}
            </template>
          </el-table-column>
          <el-table-column label="错误" min-width="180">
            <template #default="{ row }">
              <span class="crawler-result-error">{{ row.errorMessage || '-' }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-drawer>
  </section>
</template>

<script lang="ts" setup>
import type { EChartsOption } from 'echarts'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadFile, UploadInstance } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'
import EChartPanel from '@/components/EChartPanel.vue'
import {
  createGeoPublicationCrawlJob,
  createGeoPublicationCrawlKeyword,
  createGeoPublicationOption,
  createGeoPublicationRecord,
  deleteGeoPublicationRecord,
  getGeoPublicationCrawlJobs,
  getGeoPublicationCrawlKeywords,
  getGeoPublicationCrawlSetting,
  getGeoPromptCodeOptions,
  getGeoPublicationOptions,
  getGeoPublicationRecords,
  getGeoPublicationStats,
  importGeoPublicationRecords,
  updateGeoPublicationCrawlSetting,
  updateGeoPublicationRecord,
} from '@/api/geo'
import type {
  GeoPromptCodeOption,
  GeoPublicationCrawlJob,
  GeoPublicationCrawlJobStatus,
  GeoPublicationCrawlKeyword,
  GeoPublicationCrawlResultStatus,
  GeoPublicationCrawlSetting,
  GeoPublicationAccountType,
  GeoPublicationImportResult,
  GeoPublicationOptionsView,
  GeoPublicationRecord,
  GeoPublicationRecordPayload,
  GeoPublicationStats,
} from '@/types/geo'

const emptyOptions = (): GeoPublicationOptionsView => ({
  products: [],
  platforms: [],
  accountTypes: ['官网', '自媒体'],
  items: [],
})

const emptyCrawlSetting = (): GeoPublicationCrawlSetting => ({
  isEnabled: false,
  dailyRunTime: '08:00',
  lookbackDays: 90,
  maxKeywordsPerRun: 30,
  requestIntervalMinSec: 3,
  requestIntervalMaxSec: 8,
  createdAt: '',
  updatedAt: '',
})

const emptyPublicationStats = (): GeoPublicationStats => ({
  summary: {
    publicationCount: 0,
    matchedRecordCount: 0,
    matchedCitationCount: 0,
    citationCount: 0,
    matchRate: 0,
    crawlKeywordCount: 0,
    latestCrawledAt: '',
  },
  weeklyTrend: [],
  productStats: [],
  keywordStats: [],
  promptCodeStats: [],
})

const today = () => new Date().toISOString().slice(0, 10)

const records = ref<GeoPublicationRecord[]>([])
const publicationOptions = ref<GeoPublicationOptionsView>(emptyOptions())
const publicationStats = ref<GeoPublicationStats>(emptyPublicationStats())
const importResult = ref<GeoPublicationImportResult | null>(null)
const promptCodeOptions = ref<GeoPromptCodeOption[]>([])
const crawlSetting = ref<GeoPublicationCrawlSetting>(emptyCrawlSetting())
const crawlSettingForm = reactive(emptyCrawlSetting())
const crawlKeywords = ref<GeoPublicationCrawlKeyword[]>([])
const crawlJobs = ref<GeoPublicationCrawlJob[]>([])
const activeCrawlJob = ref<GeoPublicationCrawlJob | null>(null)
const loading = ref(false)
const statsLoading = ref(false)
const importing = ref(false)
const saving = ref(false)
const promptCodeLoading = ref(false)
const crawlSaving = ref(false)
const crawlStarting = ref(false)
const keywordSaving = ref(false)
const dialogVisible = ref(false)
const importResultVisible = ref(false)
const crawlDetailVisible = ref(false)
const editingRecord = ref<GeoPublicationRecord | null>(null)
const importUploadRef = ref<UploadInstance>()
let crawlPollingTimer: ReturnType<typeof setInterval> | null = null

const filters = reactive({
  dateRange: [] as string[],
  product: '',
  platform: '',
  accountType: '' as GeoPublicationAccountType | '',
  promptCode: '',
  keyword: '',
})

const form = reactive<GeoPublicationRecordPayload>({
  publishedAt: today(),
  product: '',
  title: '',
  platform: '',
  accountType: '自媒体',
  author: '',
  promptCode: '',
  link: '',
  promptBatchJobItemId: null,
})

const newKeyword = reactive({
  product: '',
  keyword: '',
})

const buildPublicationRecordQuery = () => ({
  product: filters.product,
  platform: filters.platform,
  accountType: filters.accountType,
  promptCode: filters.promptCode.trim(),
  keyword: filters.keyword.trim(),
  startDate: filters.dateRange[0],
  endDate: filters.dateRange[1],
})

const formatRate = (value: number) => `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`

const formatStatsDateTime = (value: string) => {
  if (!value) return '暂无抓取'

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const statsMetrics = computed(() => {
  const summary = publicationStats.value.summary

  return [
    {
      label: '发文数',
      value: String(summary.publicationCount),
      hint: '当前筛选范围',
    },
    {
      label: '命中文章',
      value: String(summary.matchedRecordCount),
      hint: `命中率 ${formatRate(summary.matchRate)}`,
    },
    {
      label: '引用命中',
      value: String(summary.matchedCitationCount),
      hint: `相关引用 ${summary.citationCount}`,
    },
    {
      label: '关键词组',
      value: String(summary.crawlKeywordCount),
      hint: formatStatsDateTime(summary.latestCrawledAt),
    },
  ]
})

const importProblemItems = computed(() => {
  return importResult.value?.items.filter((item) => item.status !== 'CREATED').slice(0, 100) ?? []
})

const importDialogTitle = computed(() => {
  if (!importResult.value) return 'Excel 导入结果'
  return importResult.value.success ? 'Excel 导入成功' : 'Excel 校验失败'
})

const weeklyTrendOption = computed<EChartsOption>(() => {
  const trend = publicationStats.value.weeklyTrend

  return {
    color: ['#d96b72', '#f2ab95', '#c95a62'],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      borderColor: 'rgba(216, 107, 114, 0.18)',
      textStyle: {
        color: '#4b3b3f',
      },
    },
    legend: {
      top: 0,
      right: 8,
      textStyle: {
        color: '#8f7f83',
      },
    },
    grid: {
      top: 42,
      right: 18,
      bottom: 28,
      left: 34,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: trend.map((item) => item.weekLabel),
      axisLine: {
        lineStyle: {
          color: 'rgba(143, 127, 131, 0.22)',
        },
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: '#8f7f83',
      },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: {
        lineStyle: {
          color: 'rgba(216, 107, 114, 0.1)',
        },
      },
      axisLabel: {
        color: '#8f7f83',
      },
    },
    series: [
      {
        name: '发文数',
        type: 'bar',
        barMaxWidth: 24,
        data: trend.map((item) => item.publicationCount),
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
        },
      },
      {
        name: '命中文章',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        data: trend.map((item) => item.matchedRecordCount),
      },
      {
        name: '引用命中',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        data: trend.map((item) => item.matchedCitationCount),
      },
    ],
  }
})

const loadOptions = async () => {
  publicationOptions.value = await getGeoPublicationOptions()
}

const applyCrawlSettingForm = (setting: GeoPublicationCrawlSetting) => {
  crawlSetting.value = setting
  crawlSettingForm.isEnabled = setting.isEnabled
  crawlSettingForm.dailyRunTime = setting.dailyRunTime
  crawlSettingForm.lookbackDays = setting.lookbackDays
  crawlSettingForm.maxKeywordsPerRun = setting.maxKeywordsPerRun
  crawlSettingForm.requestIntervalMinSec = setting.requestIntervalMinSec
  crawlSettingForm.requestIntervalMaxSec = setting.requestIntervalMaxSec
  crawlSettingForm.createdAt = setting.createdAt
  crawlSettingForm.updatedAt = setting.updatedAt
}

const loadCrawlData = async () => {
  try {
    const [setting, keywords, jobs] = await Promise.all([
      getGeoPublicationCrawlSetting(),
      getGeoPublicationCrawlKeywords(),
      getGeoPublicationCrawlJobs(filters.product),
    ])
    applyCrawlSettingForm(setting)
    crawlKeywords.value = keywords
    crawlJobs.value = jobs
    if (activeCrawlJob.value) {
      activeCrawlJob.value = jobs.find((job) => job.id === activeCrawlJob.value?.id) ?? activeCrawlJob.value
    }
    syncCrawlPolling()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '抓取配置加载失败')
  }
}

const loadRecords = async () => {
  loading.value = true

  try {
    records.value = await getGeoPublicationRecords(buildPublicationRecordQuery())
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '发文记录加载失败')
  } finally {
    loading.value = false
  }
}

const loadPublicationStats = async () => {
  statsLoading.value = true

  try {
    publicationStats.value = await getGeoPublicationStats(buildPublicationRecordQuery())
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '数据抓取统计加载失败')
  } finally {
    statsLoading.value = false
  }
}

const refreshPublicationData = async () => {
  await Promise.all([loadRecords(), loadPublicationStats()])
}

const applyFilters = async () => {
  await Promise.all([loadRecords(), loadPublicationStats(), loadCrawlData()])
}

const loadPromptCodeOptions = async (keyword = '') => {
  promptCodeLoading.value = true

  try {
    promptCodeOptions.value = await getGeoPromptCodeOptions(keyword)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '提示词编号加载失败')
  } finally {
    promptCodeLoading.value = false
  }
}

const handleImportFileChange = async (uploadFile: UploadFile) => {
  const file = uploadFile.raw

  if (!file) return

  if (!/\.xlsx$/i.test(file.name)) {
    ElMessage.warning('请上传 .xlsx 格式的 Excel 文件')
    importUploadRef.value?.clearFiles()
    return
  }

  importing.value = true

  try {
    const result = await importGeoPublicationRecords(file)
    importResult.value = result
    importResultVisible.value = true

    if (!result.success) {
      ElMessage.error('Excel 校验失败，请查看问题行后重新上传')
      return
    }

    ElMessage.success(`导入完成，新增 ${result.createdCount} 条发文记录`)
    await loadOptions()
    await refreshPublicationData()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'Excel 导入失败')
  } finally {
    importing.value = false
    importUploadRef.value?.clearFiles()
  }
}

const resetForm = () => {
  editingRecord.value = null
  form.publishedAt = today()
  form.product = publicationOptions.value.products[0] ?? ''
  form.title = ''
  form.platform = publicationOptions.value.platforms[0] ?? ''
  form.accountType = '自媒体'
  form.author = ''
  form.promptCode = ''
  form.link = ''
  form.promptBatchJobItemId = null
}

const openCreateDialog = async () => {
  resetForm()
  await loadPromptCodeOptions()
  dialogVisible.value = true
}

const openEditDialog = async (record: GeoPublicationRecord) => {
  editingRecord.value = record
  form.publishedAt = record.publishedAt
  form.product = record.product
  form.title = record.title
  form.platform = record.platform
  form.accountType = record.accountType
  form.author = record.author
  form.promptCode = record.promptCode
  form.link = record.link
  form.promptBatchJobItemId = record.promptBatchJobItemId
  await loadPromptCodeOptions(record.promptCode)
  dialogVisible.value = true
}

const resetFilters = () => {
  filters.dateRange = []
  filters.product = ''
  filters.platform = ''
  filters.accountType = ''
  filters.promptCode = ''
  filters.keyword = ''
  void applyFilters()
}

const handlePromptCodeChange = (value: string) => {
  const matched = promptCodeOptions.value.find((item) => item.promptCode === value)
  form.promptBatchJobItemId = matched?.promptBatchJobItemId ?? null
}

const validateForm = () => {
  if (!form.publishedAt) return '请选择日期'
  if (!form.product.trim()) return '请选择或输入产品'
  if (!form.title.trim()) return '请填写标题'
  if (!form.platform.trim()) return '请选择或输入平台'
  if (!form.accountType.trim()) return '请选择或输入账号类型'
  if (!form.author.trim()) return '请填写作者'
  if (!form.promptCode.trim()) return '请填写提示词编号'
  if (!form.link.trim()) return '请填写链接'
  return ''
}

const ensureOption = async (type: 'PRODUCT' | 'PLATFORM' | 'ACCOUNT_TYPE', label: string) => {
  const list =
    type === 'PRODUCT'
      ? publicationOptions.value.products
      : type === 'PLATFORM'
        ? publicationOptions.value.platforms
        : publicationOptions.value.accountTypes

  if (list.includes(label)) return

  await createGeoPublicationOption({ type, label })
}

const saveRecord = async () => {
  const errorMessage = validateForm()
  if (errorMessage) {
    ElMessage.warning(errorMessage)
    return
  }

  saving.value = true

  try {
    await ensureOption('PRODUCT', form.product.trim())
    await ensureOption('PLATFORM', form.platform.trim())
    await ensureOption('ACCOUNT_TYPE', form.accountType.trim())

    const payload: GeoPublicationRecordPayload = {
      publishedAt: form.publishedAt,
      product: form.product.trim(),
      title: form.title.trim(),
      platform: form.platform.trim(),
      accountType: form.accountType.trim(),
      author: form.author.trim(),
      promptCode: form.promptCode.trim(),
      link: form.link.trim(),
      promptBatchJobItemId: form.promptBatchJobItemId,
    }

    if (editingRecord.value) {
      await updateGeoPublicationRecord(editingRecord.value.id, payload)
      ElMessage.success('发文记录已更新')
    } else {
      await createGeoPublicationRecord(payload)
      ElMessage.success('发文记录已新增')
    }

    dialogVisible.value = false
    await loadOptions()
    await refreshPublicationData()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '发文记录保存失败')
  } finally {
    saving.value = false
  }
}

const deleteRecord = async (record: GeoPublicationRecord) => {
  try {
    await ElMessageBox.confirm(`确定删除“${record.title}”这条发文记录吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await deleteGeoPublicationRecord(record.id)
    ElMessage.success('发文记录已删除')
    await refreshPublicationData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '发文记录删除失败')
    }
  }
}

const formatDisplayTime = (value: string) => {
  if (!value) return '-'

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const saveCrawlSetting = async () => {
  crawlSaving.value = true

  try {
    const setting = await updateGeoPublicationCrawlSetting({
      isEnabled: crawlSettingForm.isEnabled,
      dailyRunTime: crawlSettingForm.dailyRunTime,
      lookbackDays: crawlSettingForm.lookbackDays,
      maxKeywordsPerRun: crawlSettingForm.maxKeywordsPerRun,
      requestIntervalMinSec: crawlSettingForm.requestIntervalMinSec,
      requestIntervalMaxSec: crawlSettingForm.requestIntervalMaxSec,
    })
    applyCrawlSettingForm(setting)
    ElMessage.success('抓取设置已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '抓取设置保存失败')
  } finally {
    crawlSaving.value = false
  }
}

const startManualCrawl = async () => {
  crawlStarting.value = true

  try {
    const job = await createGeoPublicationCrawlJob({ product: filters.product || undefined })
    ElMessage.success('百度 AI 抓取任务已创建')
    await Promise.all([loadCrawlData(), loadPublicationStats()])
    openCrawlJobDetail(crawlJobs.value.find((item) => item.id === job.id) ?? job)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '抓取任务创建失败')
  } finally {
    crawlStarting.value = false
  }
}

const addCrawlKeyword = async () => {
  if (!newKeyword.product.trim()) {
    ElMessage.warning('请先选择或输入产品')
    return
  }
  if (!newKeyword.keyword.trim()) {
    ElMessage.warning('请填写关键词')
    return
  }

  keywordSaving.value = true

  try {
    await createGeoPublicationCrawlKeyword({
      product: newKeyword.product.trim(),
      keyword: newKeyword.keyword.trim(),
      isActive: true,
    })
    newKeyword.keyword = ''
    await loadCrawlData()
    ElMessage.success('关键词已添加')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '关键词添加失败')
  } finally {
    keywordSaving.value = false
  }
}

const crawlJobStatusText = (status: GeoPublicationCrawlJobStatus) => {
  const map: Record<GeoPublicationCrawlJobStatus, string> = {
    QUEUED: '排队中',
    RUNNING: '抓取中',
    COMPLETED: '已完成',
    PARTIAL_FAILED: '部分失败',
    FAILED: '失败',
  }

  return map[status]
}

const crawlResultStatusText = (status: GeoPublicationCrawlResultStatus) => {
  const map: Record<GeoPublicationCrawlResultStatus, string> = {
    QUEUED: '排队中',
    RUNNING: '抓取中',
    SUCCEEDED: '成功',
    NO_AI: '无 AI',
    BLOCKED: '被拦截',
    FAILED: '失败',
  }

  return map[status]
}

const crawlJobTagType = (status: GeoPublicationCrawlJobStatus) => {
  if (status === 'COMPLETED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'PARTIAL_FAILED') return 'warning'
  return 'info'
}

const crawlResultTagType = (status: GeoPublicationCrawlResultStatus) => {
  if (status === 'SUCCEEDED') return 'success'
  if (status === 'FAILED' || status === 'BLOCKED') return 'danger'
  if (status === 'NO_AI') return 'warning'
  return 'info'
}

const crawlJobProgress = (job: GeoPublicationCrawlJob) => {
  if (job.keywordCount <= 0) return 0

  const finished = job.successCount + job.noAiCount + job.blockedCount + job.failedCount
  return Math.min(100, Math.round((finished / job.keywordCount) * 100))
}

const openCrawlJobDetail = (job: GeoPublicationCrawlJob) => {
  activeCrawlJob.value = job
  crawlDetailVisible.value = true
}

const hasUnfinishedCrawlJobs = () => {
  return crawlJobs.value.some((job) => job.status === 'QUEUED' || job.status === 'RUNNING')
}

const syncCrawlPolling = () => {
  if (hasUnfinishedCrawlJobs()) {
    if (!crawlPollingTimer) {
      crawlPollingTimer = setInterval(() => {
        void loadCrawlData().then(() => loadPublicationStats())
      }, 4000)
    }
    return
  }

  if (crawlPollingTimer) {
    clearInterval(crawlPollingTimer)
    crawlPollingTimer = null
  }
}

onMounted(async () => {
  await loadOptions()
  newKeyword.product = publicationOptions.value.products[0] ?? ''
  await Promise.all([loadRecords(), loadPublicationStats(), loadPromptCodeOptions(), loadCrawlData()])
})

onBeforeUnmount(() => {
  if (crawlPollingTimer) clearInterval(crawlPollingTimer)
})
</script>

<style scoped>
.publication-layout {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.publication-hero,
.publication-card-head,
.publication-filter__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.publication-hero h3,
.publication-card-head h3 {
  margin: 0;
  color: #2f2024;
  font-size: 20px;
}

.publication-hero p,
.publication-card-head p {
  margin: 6px 0 0;
  color: #8f7f83;
}

.publication-hero__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.publication-upload :deep(.el-upload) {
  display: block;
}

.publication-filter__grid,
.publication-dialog-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.publication-filter__actions {
  justify-content: flex-end;
}

.publication-grid {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.publication-stats-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.publication-metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.publication-metric {
  border: 1px solid rgba(216, 107, 114, 0.14);
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(255, 241, 241, 0.86), rgba(255, 255, 255, 0.94));
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-height: 94px;
  padding: 14px 16px;
}

.publication-metric span,
.publication-metric em,
.publication-subhead span {
  color: #958488;
  font-size: 12px;
  font-style: normal;
}

.publication-metric strong {
  color: #3a282c;
  font-size: 26px;
  line-height: 1.15;
}

.publication-stats-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.publication-trend-panel,
.publication-stat-table {
  border: 1px solid rgba(216, 107, 114, 0.12);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  padding: 14px;
}

.publication-stats-tables {
  display: grid;
  grid-template-columns: minmax(220px, 0.8fr) minmax(300px, 1.2fr) minmax(300px, 1.2fr);
  gap: 14px;
}

.publication-subhead {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.publication-subhead strong {
  color: #34272a;
  font-size: 14px;
}

.publication-keyword-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.publication-keyword-cell strong {
  color: #34272a;
  line-height: 1.35;
}

.publication-keyword-cell span {
  color: #9a8a8e;
  font-size: 12px;
}

.publication-prompt-code {
  color: #6f3d45;
  white-space: normal;
  word-break: break-all;
}

.publication-title-cell,
.publication-code-cell,
.publication-code-option,
.publication-ai-cell {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.publication-title-cell strong {
  color: #34272a;
  line-height: 1.45;
}

.publication-title-cell a {
  color: #d85b68;
  font-size: 12px;
  text-decoration: none;
}

.publication-code-cell code {
  color: #6f3d45;
  white-space: normal;
  word-break: break-all;
}

.publication-code-cell span,
.publication-code-option span {
  color: #9a8a8e;
  font-size: 12px;
}

.publication-crawler-card {
  align-self: stretch;
}

.crawler-panel,
.crawler-keywords,
.crawler-jobs {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.crawler-panel__grid,
.crawler-add-keyword {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.crawler-panel__actions,
.crawler-section-title,
.crawler-job__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.crawler-keyword-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 148px;
  overflow: auto;
}

.crawler-add-keyword {
  grid-template-columns: 120px minmax(0, 1fr) auto;
}

.crawler-job {
  border: 1px solid rgba(216, 91, 104, 0.15);
  border-radius: 14px;
  padding: 10px 12px;
  background: rgba(255, 248, 248, 0.7);
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.crawler-job:hover,
.crawler-job:focus-visible {
  border-color: rgba(216, 91, 104, 0.38);
  box-shadow: 0 12px 28px rgba(130, 75, 86, 0.1);
  outline: none;
  transform: translateY(-1px);
}

.crawler-job p,
.crawler-empty {
  margin: 6px 0 0;
  color: #8f7f83;
  font-size: 13px;
}

.crawler-job__error {
  color: #c45656 !important;
}

.crawler-job__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin: 10px 0;
}

.crawler-job__metrics span {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.76);
  color: #8f7f83;
  font-size: 12px;
  padding: 4px 8px;
  text-align: center;
}

.crawler-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.crawler-detail__summary {
  align-items: center;
  background: linear-gradient(135deg, rgba(255, 248, 248, 0.96), rgba(255, 255, 255, 0.92));
  border: 1px solid rgba(216, 91, 104, 0.14);
  border-radius: 16px;
  display: flex;
  justify-content: space-between;
  padding: 14px 16px;
}

.crawler-detail__summary div,
.crawler-result-keyword,
.crawler-citation div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.crawler-detail__summary strong,
.crawler-result-keyword strong {
  color: #34272a;
}

.crawler-detail__summary span,
.crawler-result-keyword span,
.crawler-citation span {
  color: #9a8a8e;
  font-size: 12px;
}

.crawler-citation-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 6px 0 6px 46px;
}

.crawler-citation {
  align-items: center;
  border: 1px solid rgba(216, 91, 104, 0.12);
  border-radius: 12px;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding: 10px 12px;
}

.crawler-citation a {
  color: #6f3d45;
  font-weight: 600;
  line-height: 1.45;
  text-decoration: none;
}

.crawler-result-error {
  color: #c45656;
  font-size: 12px;
}

.publication-dialog-form {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.publication-dialog-form :deep(.el-select),
.publication-dialog-form :deep(.el-date-editor) {
  width: 100%;
}

.publication-import-result {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.publication-import-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid rgba(216, 107, 114, 0.14);
  border-radius: 8px;
  background: #fff7f7;
  color: #8f7f83;
}

.publication-import-summary strong {
  color: #c95a62;
}

.publication-import-summary--failed {
  border-color: rgba(201, 90, 98, 0.24);
  background: #fff1f1;
}

@media (max-width: 1100px) {
  .publication-grid,
  .publication-metric-grid,
  .publication-stats-tables,
  .publication-filter__grid,
  .publication-dialog-grid,
  .crawler-panel__grid,
  .crawler-add-keyword {
    grid-template-columns: 1fr;
  }

  .publication-hero,
  .publication-card-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .publication-hero__actions {
    flex-wrap: wrap;
  }
}
</style>
