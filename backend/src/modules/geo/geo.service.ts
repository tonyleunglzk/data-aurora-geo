import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import JSZip = require('jszip')
import { spawn } from 'child_process'
import { join } from 'path'
import {
  GeoPublicationCrawlJobStatus,
  GeoPublicationCrawlResultStatus,
  type GeoPublicationRecord,
  GeoPromptBatchEngineType,
  type GeoPromptBatchJob,
  type GeoPromptBatchJobItem,
  GeoPromptBatchJobStatus,
  GeoPromptBatchItemStatus,
  type GeoPromptEngineV2FixedRules,
  type GeoPromptEngineVersion,
  type GeoPromptEngineVersionDraftSession,
  type GeoRuleCard,
  type GeoSerpAiSummary,
  type GeoSerpResearchProject,
  type GeoSerpResearchResult,
  GeoSerpProjectStatus,
  GeoSerpResultStatus,
  type GeoProductProfile,
  type GeoProviderConfig,
  type Prisma,
} from '@prisma/client'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import type { Request, Response } from 'express'
import { PrismaService } from '../../common/prisma.service'
import { analyzeSerpArticle } from './core/serp-analysis'
import { collectBaiduBaijiahaoSerp } from './core/baidu-serp'
import { fetchArticle } from './core/fetch'
import { fetchArticleDetail } from './core/fetch'
import {
  buildInsightRepairSystemPrompt,
  buildInsightRepairUserMessage,
  buildProjectAiSummarySystemPrompt,
  buildProjectAiSummaryRetryUserMessage,
  buildProjectAiSummaryUserMessage,
  buildRuleCardSystemPrompt,
  buildRuleCardRetryUserMessage,
  buildRuleCardUserMessage,
  type GeoInsightSummaryPayload,
  type GeoInsightResultInput,
} from './core/insight-prompts'
import {
  buildLegacyPromptEngineSystemPromptPreview,
  buildSystemPrompt,
  buildUserMessage,
  LEGACY_PROMPT_ENGINE_CONDITIONAL_RULE_NOTES,
} from './core/prompt'
import {
  buildPromptEngineV2SystemPrompt,
  buildPromptEngineV2UserMessage,
  DEFAULT_PROMPT_ENGINE_V2_FIXED_RULES,
} from './core/prompt-v2'
import type { ProductInfo } from './core/types'
import {
  buildVersionDraftApplySystemPrompt,
  buildVersionDraftApplyUserMessage,
  buildVersionDraftChatSystemPrompt,
  buildVersionDraftChatUserMessage,
  buildVersionDraftRepairSystemPrompt,
  buildVersionDraftRepairUserMessage,
} from './core/version-draft-prompts'
import { ActivateGeoRuleCardDto } from './dto/activate-geo-rule-card.dto'
import { CreateGeoPublicationCrawlJobDto } from './dto/create-geo-publication-crawl-job.dto'
import { CreateGeoPublicationCrawlKeywordDto } from './dto/create-geo-publication-crawl-keyword.dto'
import { CreateGeoPromptBatchDto } from './dto/create-geo-prompt-batch.dto'
import { CreateGeoPromptEngineVersionDraftSessionDto } from './dto/create-geo-prompt-engine-version-draft-session.dto'
import { CreateGeoPromptEngineVersionDto } from './dto/create-geo-prompt-engine-version.dto'
import { CreateGeoPublicationOptionDto } from './dto/create-geo-publication-option.dto'
import { CreateGeoPublicationRecordDto } from './dto/create-geo-publication-record.dto'
import { CreateSerpResearchProjectDto } from './dto/create-serp-research-project.dto'
import { CreateGeoProfileDto } from './dto/create-geo-profile.dto'
import { FindGeoAiSummariesQueryDto } from './dto/find-geo-ai-summaries-query.dto'
import { FindGeoPromptCodeOptionsQueryDto } from './dto/find-geo-prompt-code-options-query.dto'
import { FindGeoPublicationCrawlJobsQueryDto } from './dto/find-geo-publication-crawl-jobs-query.dto'
import { FindGeoRuleCardsQueryDto } from './dto/find-geo-rule-cards-query.dto'
import { FindGeoPublicationRecordsQueryDto } from './dto/find-geo-publication-records-query.dto'
import { GenerateGeoPromptDto } from './dto/generate-geo-prompt.dto'
import { GenerateGeoPromptV2Dto } from './dto/generate-geo-prompt-v2.dto'
import { GenerateGeoRuleCardDto } from './dto/generate-geo-rule-card.dto'
import { GeoProductDto } from './dto/geo-product.dto'
import { ImportGeoPromptEngineVersionDraftDto } from './dto/import-geo-prompt-engine-version-draft.dto'
import { SaveGeoSerpAiSummaryDto } from './dto/save-geo-serp-ai-summary.dto'
import { StreamGeoPromptEngineVersionDraftChatDto } from './dto/stream-geo-prompt-engine-version-draft-chat.dto'
import { StreamGeoSerpAiSummaryTestDto } from './dto/stream-geo-serp-ai-summary-test.dto'
import { UpdateGeoPromptEngineV2FixedRulesDto } from './dto/update-geo-prompt-engine-v2-fixed-rules.dto'
import { UpdateGeoPromptEngineVersionDraftSessionDto } from './dto/update-geo-prompt-engine-version-draft-session.dto'
import { UpdateGeoPromptEngineVersionDto } from './dto/update-geo-prompt-engine-version.dto'
import { UpdateGeoPublicationCrawlKeywordDto } from './dto/update-geo-publication-crawl-keyword.dto'
import { UpdateGeoPublicationCrawlSettingDto } from './dto/update-geo-publication-crawl-setting.dto'
import { UpdateGeoPublicationRecordDto } from './dto/update-geo-publication-record.dto'
import { UpdateGeoProfileDto } from './dto/update-geo-profile.dto'
import { UpdateGeoProviderConfigDto } from './dto/update-geo-provider-config.dto'

const DEFAULT_MODEL = 'claude-opus-4-6-20250219'
const INSIGHT_FORMATTER_FALLBACK_MODEL = 'claude-3-5-sonnet-20241022'
const DEFAULT_INSIGHT_TIMEOUT_MS = 75_000
const DEFAULT_INSIGHT_MAX_RETRIES = 1
const DEFAULT_INSIGHT_MAX_TOKENS = 4200
const RETRY_INSIGHT_MAX_TOKENS = 2800
const INSIGHT_TIMEOUT_ERROR_NAME = 'InsightRequestTimeoutError'
const MAX_SHORT_TEXT_LENGTH = 180
const MAX_RULE_CARD_ARRAY_ITEMS = 6
const MAX_PROJECT_INSIGHT_RESULTS = 30
const RETRY_PROJECT_INSIGHT_RESULTS = 30
const PROJECT_INSIGHT_FETCH_CONCURRENCY = 3
const RETRY_RULE_CARD_SUMMARIES = 6
const DEFAULT_VERSION_DRAFT_MAX_TOKENS = 3600
const DEFAULT_VERSION_DRAFT_STREAM_MAX_TOKENS = 2400
const DEFAULT_VERSION_DRAFT_REPAIR_MAX_TOKENS = 1800
const DEFAULT_GENERATE_V2_MAX_TOKENS = 8192
const PROMPT_BATCH_WORKER_CONCURRENCY = 2
const PROMPT_BATCH_WORKER_POLL_MS = 3000
const PROMPT_BATCH_REQUEST_TIMEOUT_MS = 600_000
const PROMPT_BATCH_ITEM_MAX_ATTEMPTS = 3
const PROMPT_BATCH_ITEM_RETRY_BASE_DELAY_MS = 2000
const PUBLICATION_CRAWL_WORKER_CONCURRENCY = 1
const PUBLICATION_CRAWL_WORKER_POLL_MS = 5000
const PUBLICATION_CRAWL_SCHEDULER_POLL_MS = 60_000
const PUBLICATION_CRAWL_REQUEST_TIMEOUT_MS = 180_000
const PROMPT_ENGINE_VERSION_DRAFT_MODELS = [
  'claude-opus-4.7',
  'claude-opus-4-6',
  'claude-sonnet-4-6',
] as const
const DEFAULT_VERSION_DRAFT_MODEL = PROMPT_ENGINE_VERSION_DRAFT_MODELS[0]
const PUBLICATION_OPTION_TYPES = ['PRODUCT', 'PLATFORM', 'ACCOUNT_TYPE'] as const
const DEFAULT_PUBLICATION_PRODUCTS = ['防晒衣', '冲锋衣'] as const
const DEFAULT_PUBLICATION_PLATFORMS = ['百家号', '什么值得买', '知乎'] as const
const DEFAULT_PUBLICATION_ACCOUNT_TYPES = ['官网', '自媒体'] as const
const DEFAULT_PUBLICATION_CRAWL_KEYWORDS = [
  { product: '防晒衣', keyword: '防晒衣哪个牌子防晒效果最好' },
  { product: '防晒衣', keyword: '防晒衣最建议买的三个品牌' },
  { product: '防晒衣', keyword: '防晒衣十大排行榜10强' },
  { product: '冲锋衣', keyword: '冲锋衣哪个品牌质量好性价比高' },
  { product: '冲锋衣', keyword: '冲锋衣品牌排行榜前十名' },
  { product: '冲锋衣', keyword: '冲锋衣最建议买的三个品牌' },
] as const

type InsightRetryOptions = {
  userMessage: string
  maxTokens?: number
}

type InsightExecutionResult = {
  insight: GeoInsightSummaryPayload
  model: string
}

type InsightDraftView = {
  projectId: number
  projectKeyword: string
  category: string
  engine: string
  requestedModel: string
  model: string
  fallbackUsed: boolean
  fallbackReason: string
  rawSummary: string
  titlePatterns: string[]
  leadPatterns: string[]
  sectionBlueprint: string[]
  keywordPlacement: string[]
  sellingPointOrder: string[]
  trustSignals: string[]
  endingPatterns: string[]
  antiPatterns: string[]
  rankingHypotheses: string[]
}

type InsightStreamPhase = 'starting' | 'fallback' | 'repairing' | 'completed'

type InsightStreamHooks = {
  onText: (text: string) => void
  onStatus: (phase: InsightStreamPhase, message: string, model?: string) => void
  onResetPreview: () => void
}

type InsightStreamExecutionOptions = {
  requestedModel?: string
  allowFallback?: boolean
  mode?: 'standard' | 'test'
  preservePreviewOnFallback?: boolean
}

type PromptEngineV2VersionView = {
  id: number
  name: string
  description: string
  articleUrl: string
  articleText: string
  ruleText: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

type PromptEngineV2FixedRulesView = {
  ruleText: string
  updatedAt: string
}

type PromptEngineV2VersionDraftSuggestion = {
  suggestedName: string
  suggestedDescription: string
  suggestedRuleText: string
}

type PromptEngineV2VersionDraftSessionStatus = 'ACTIVE' | 'APPLIED' | 'ARCHIVED'

type PromptEngineV2VersionDraftMessage = {
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

type PromptEngineV2VersionDraftSessionView = {
  id: number
  title: string
  articleText: string
  articleUrl: string
  notes: string
  model: string
  messages: PromptEngineV2VersionDraftMessage[]
  status: PromptEngineV2VersionDraftSessionStatus
  ownerUserId: number | null
  ownerName: string
  suggestedName: string
  suggestedDescription: string
  suggestedRuleText: string
  lastMessagePreview: string
  createdAt: string
  updatedAt: string
}

type LegacyPromptEngineRulesView = {
  summary: string
  ruleText: string
  conditionalNotes: string[]
}

type PromptBatchEngineType = 'LEGACY' | 'V2'

type PromptBatchJobViewSource = GeoPromptBatchJob & {
  items?: GeoPromptBatchJobItem[]
}

type PublicationRecordViewSource = Prisma.GeoPublicationRecordGetPayload<{
  include: {
    promptBatchJobItem: {
      include: {
        job: true
      }
    }
  }
}>

type PublicationCrawlJobViewSource = Prisma.GeoPublicationCrawlJobGetPayload<{
  include: {
    results: {
      include: {
        citations: true
      }
    }
  }
}>

type PublicationCrawlScraperCitation = {
  url?: string
  title?: string
  sourceName?: string
  authorName?: string
  brand?: string
  publishTime?: string
  uuid?: string
}

type PublicationCrawlScraperResult = {
  status?: string
  keyword?: string
  aiTitle?: string
  content?: string
  contentSummary?: string
  blockedDetected?: boolean
  errorMessage?: string
  citations?: PublicationCrawlScraperCitation[]
}

type PublicationStatsRecord = Pick<GeoPublicationRecord, 'id' | 'publishedAt' | 'product' | 'promptCode'>

type PublicationStatsGroup = {
  publicationCount: number
  recordIds: Set<number>
  matchedRecordIds: Set<number>
  resultIds: Set<number>
  matchedCitationCount: number
}

type PublicationCrawlResultWithCitations = Prisma.GeoPublicationCrawlResultGetPayload<{
  include: {
    citations: true
  }
}>

type PublicationImportUploadFile = {
  buffer: Buffer
  originalname: string
  mimetype: string
  size: number
}

type PublicationImportRowDraft = {
  rowNumber: number
  publishedAt: string
  product: string
  title: string
  platform: string
  accountType: string
  author: string
  promptCode: string
  link: string
}

type PublicationImportResultItem = {
  rowNumber: number
  title: string
  link: string
  status: 'CREATED' | 'SKIPPED' | 'FAILED'
  reason: string
}

type PublicationRecordDataPayload = Omit<Partial<CreateGeoPublicationRecordDto>, 'promptBatchJobItemId'> & {
  promptBatchJobItemId?: number | null
}

type XlsxCellValue = string | number | boolean | null

type XlsxRow = {
  rowNumber: number
  cells: XlsxCellValue[]
}

type XlsxSheetInfo = {
  name: string
  path: string
}

const PUBLICATION_IMPORT_MAX_FILE_SIZE = 8 * 1024 * 1024
const PUBLICATION_IMPORT_DEFAULT_PROMPT_CODE = '未关联'
const PUBLICATION_IMPORT_HEADER_ALIASES = {
  publishedAt: ['日期', '发文日期', '发布时间', '发布日', 'date', 'publishedat', 'publish_time'],
  product: ['产品', '品类', '项目', 'product'],
  title: ['标题', '文章标题', 'title'],
  platform: ['平台', '渠道', '发布平台', '发布渠道', 'channel', 'platform'],
  accountType: ['账号类型', '账号类别', '账户类型', '类型', 'accounttype'],
  author: ['作者', '账号', '账号名称', '媒体', '发布账号', 'author', 'author_name'],
  promptCode: ['提示词编号', '提示词', '编号', '关键词id', 'promptcode', 'prompt_code'],
  link: ['链接', '文章链接', 'url', 'link', '链接地址'],
  uuid: ['uuid', 'externalid', 'external_id'],
} as const

type PublicationImportHeaderField = keyof typeof PUBLICATION_IMPORT_HEADER_ALIASES

type PromptBatchRuleCardContext = {
  category: string
  rawSummary: string
  titlePatterns: string[]
  leadPatterns: string[]
  sectionBlueprint: string[]
  keywordPlacement: string[]
  sellingPointOrder: string[]
  trustSignals: string[]
  endingPatterns: string[]
  antiPatterns: string[]
  rankingHypotheses: string[]
} | null

type PromptBatchGenerationContext = {
  itemIndex: number
  requestedCount: number
}

type PublicationOptionType = typeof PUBLICATION_OPTION_TYPES[number]

@Injectable()
export class GeoService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  private promptBatchWorkerStarted = false
  private promptBatchWorkerTimer: NodeJS.Timeout | null = null
  private promptBatchWorkerTickRunning = false
  private activePromptBatchItems = 0
  private finalizingPromptBatchJobs = new Set<number>()
  private publicationCrawlWorkerStarted = false
  private publicationCrawlWorkerTimer: NodeJS.Timeout | null = null
  private publicationCrawlSchedulerTimer: NodeJS.Timeout | null = null
  private publicationCrawlWorkerTickRunning = false
  private publicationCrawlSchedulerTickRunning = false
  private activePublicationCrawlResults = 0

  async onModuleInit() {
    await this.ensureProviderConfig()
    await this.ensurePromptEngineV2FixedRules()
    await this.ensurePublicationDefaultOptions()
    await this.ensurePublicationCrawlSetting()
    await this.ensurePublicationCrawlDefaultKeywords()
    await this.recoverPromptBatchJobs()
    await this.recoverPublicationCrawlJobs()
    this.startPromptBatchWorker()
    this.startPublicationCrawlWorker()
  }

  async findProfiles() {
    const profiles = await this.prisma.geoProductProfile.findMany({
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    })

    return profiles.map((profile) => this.toProfileView(profile))
  }

  async createProfile(payload: CreateGeoProfileDto) {
    try {
      const profile = await this.prisma.geoProductProfile.create({
        data: this.toProfileInput(payload),
      })

      return this.toProfileView(profile)
    } catch (error) {
      this.rethrowProfileConflict(error)
    }
  }

  async updateProfile(id: number, payload: UpdateGeoProfileDto) {
    const currentProfile = await this.prisma.geoProductProfile.findUnique({
      where: { id },
    })

    if (!currentProfile) {
      throw new NotFoundException('产品档案不存在')
    }

    const data = this.toProfileUpdateInput(payload)

    try {
      const profile = await this.prisma.geoProductProfile.update({
        where: { id },
        data,
      })

      return this.toProfileView(profile)
    } catch (error) {
      this.rethrowProfileConflict(error)
    }
  }

  async removeProfile(id: number) {
    const currentProfile = await this.prisma.geoProductProfile.findUnique({
      where: { id },
    })

    if (!currentProfile) {
      throw new NotFoundException('产品档案不存在')
    }

    await this.prisma.geoProductProfile.delete({
      where: { id },
    })

    return {
      id,
      success: true,
    }
  }

  async findProviderConfig() {
    const config = await this.ensureProviderConfig()
    return this.toProviderConfigView(config)
  }

  async findPromptEngineV2FixedRules() {
    const fixedRules = await this.ensurePromptEngineV2FixedRules()
    return this.toPromptEngineV2FixedRulesView(fixedRules)
  }

  findLegacyPromptEngineRules() {
    return this.toLegacyPromptEngineRulesView()
  }

  async updatePromptEngineV2FixedRules(payload: UpdateGeoPromptEngineV2FixedRulesDto) {
    const fixedRules = await this.prisma.geoPromptEngineV2FixedRules.upsert({
      where: { id: 1 },
      update: {
        ruleText: payload.ruleText.trim() || DEFAULT_PROMPT_ENGINE_V2_FIXED_RULES,
      },
      create: {
        id: 1,
        ruleText: payload.ruleText.trim() || DEFAULT_PROMPT_ENGINE_V2_FIXED_RULES,
      },
    })

    return this.toPromptEngineV2FixedRulesView(fixedRules)
  }

  async findPromptEngineV2Versions() {
    const versions = await this.prisma.geoPromptEngineVersion.findMany({
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }, { id: 'desc' }],
    })

    return versions.map((item) => this.toPromptEngineV2VersionView(item))
  }

  async createPromptEngineV2Version(payload: CreateGeoPromptEngineVersionDto) {
    const version = await this.prisma.geoPromptEngineVersion.create({
      data: {
        name: payload.name.trim(),
        description: payload.description?.trim() ?? '',
        articleUrl: payload.articleUrl?.trim() ?? '',
        articleText: payload.articleText?.trim() ?? '',
        ruleText: payload.ruleText.trim(),
        isActive: payload.isActive ?? true,
        sortOrder: payload.sortOrder ?? 0,
      },
    })

    return this.toPromptEngineV2VersionView(version)
  }

  async updatePromptEngineV2Version(id: number, payload: UpdateGeoPromptEngineVersionDto) {
    const currentVersion = await this.prisma.geoPromptEngineVersion.findUnique({
      where: { id },
    })

    if (!currentVersion) {
      throw new NotFoundException('版本不存在')
    }

    const data: Prisma.GeoPromptEngineVersionUpdateInput = {}

    if (payload.name !== undefined) data.name = payload.name.trim()
    if (payload.description !== undefined) data.description = payload.description.trim()
    if (payload.articleUrl !== undefined) data.articleUrl = payload.articleUrl.trim()
    if (payload.articleText !== undefined) data.articleText = payload.articleText.trim()
    if (payload.ruleText !== undefined) data.ruleText = payload.ruleText.trim()
    if (payload.isActive !== undefined) data.isActive = payload.isActive
    if (payload.sortOrder !== undefined) data.sortOrder = payload.sortOrder

    const version = await this.prisma.geoPromptEngineVersion.update({
      where: { id },
      data,
    })

    return this.toPromptEngineV2VersionView(version)
  }

  async removePromptEngineV2Version(id: number) {
    const currentVersion = await this.prisma.geoPromptEngineVersion.findUnique({
      where: { id },
    })

    if (!currentVersion) {
      throw new NotFoundException('版本不存在')
    }

    await this.prisma.geoPromptEngineVersion.delete({
      where: { id },
    })

    return {
      id,
      success: true,
    }
  }

  async findPromptEngineV2VersionDraftSessions() {
    const sessions = await this.prisma.geoPromptEngineVersionDraftSession.findMany({
      where: {
        status: {
          not: 'ARCHIVED',
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    })

    return sessions.map((session) => this.toPromptEngineV2VersionDraftSessionView(session))
  }

  async findPromptEngineV2VersionDraftSession(id: number) {
    const session = await this.findPromptEngineV2VersionDraftSessionRecord(id, true)
    return this.toPromptEngineV2VersionDraftSessionView(session)
  }

  async createPromptEngineV2VersionDraftSession(payload: CreateGeoPromptEngineVersionDraftSessionDto) {
    const providerConfig = await this.ensureProviderConfig()
    const messages = this.normalizePromptEngineV2VersionDraftMessages(payload.messages ?? [])
    const session = await this.prisma.geoPromptEngineVersionDraftSession.create({
      data: {
        title: this.toVersionDraftSessionTitle(payload.title, messages, payload.articleUrl, payload.notes),
        articleText: payload.articleText?.trim() ?? '',
        articleUrl: payload.articleUrl?.trim() ?? '',
        notes: payload.notes?.trim() ?? '',
        model: this.resolvePromptEngineV2VersionDraftModel(payload.model, providerConfig.model),
        messages: this.toVersionDraftMessageJson(messages),
        ownerUserId: payload.ownerUserId ?? null,
        ownerName: payload.ownerName?.trim() ?? '',
        suggestedDescription: '',
        suggestedRuleText: '',
      },
    })

    return this.toPromptEngineV2VersionDraftSessionView(session)
  }

  async updatePromptEngineV2VersionDraftSession(
    id: number,
    payload: UpdateGeoPromptEngineVersionDraftSessionDto
  ) {
    await this.findPromptEngineV2VersionDraftSessionRecord(id, true)

    const data: Prisma.GeoPromptEngineVersionDraftSessionUpdateInput = {}

    if (payload.title !== undefined) {
      data.title = this.toShortText(payload.title || '未命名会话', 120)
    }
    if (payload.articleText !== undefined) data.articleText = payload.articleText.trim()
    if (payload.articleUrl !== undefined) data.articleUrl = payload.articleUrl.trim()
    if (payload.notes !== undefined) data.notes = payload.notes.trim()
    if (payload.model !== undefined) data.model = this.resolvePromptEngineV2VersionDraftModel(payload.model)
    if (payload.messages !== undefined) {
      data.messages = this.toVersionDraftMessageJson(
        this.normalizePromptEngineV2VersionDraftMessages(payload.messages)
      )
    }
    if (payload.status !== undefined) data.status = payload.status
    if (payload.ownerUserId !== undefined) data.ownerUserId = payload.ownerUserId
    if (payload.ownerName !== undefined) data.ownerName = payload.ownerName.trim()
    if (payload.suggestedName !== undefined) data.suggestedName = payload.suggestedName.trim()
    if (payload.suggestedDescription !== undefined) data.suggestedDescription = payload.suggestedDescription.trim()
    if (payload.suggestedRuleText !== undefined) data.suggestedRuleText = payload.suggestedRuleText.trim()

    const session = await this.prisma.geoPromptEngineVersionDraftSession.update({
      where: { id },
      data,
    })

    return this.toPromptEngineV2VersionDraftSessionView(session)
  }

  async removePromptEngineV2VersionDraftSession(id: number) {
    await this.findPromptEngineV2VersionDraftSessionRecord(id, true)

    const session = await this.prisma.geoPromptEngineVersionDraftSession.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
      },
    })

    return this.toPromptEngineV2VersionDraftSessionView(session)
  }

  async streamPromptEngineV2VersionDraftSessionChat(id: number, request: Request, response: Response) {
    const providerConfig = await this.ensureProviderConfig()

    if (!providerConfig.apiKey.trim()) {
      response.status(400).json({ error: '请先完成 Anthropic 配置后再使用 AI 对话创建版本' })
      return
    }

    const session = await this.findPromptEngineV2VersionDraftSessionRecord(id)
    const messages = this.readVersionDraftMessages(session.messages as Prisma.JsonValue)

    if (messages.length === 0) {
      response.status(400).json({ error: '请先发送一条消息后再生成 AI 回复' })
      return
    }

    let articleText = ''

    try {
      articleText = await this.resolveVersionDraftArticleText(session.articleText, session.articleUrl)
    } catch (error) {
      response.status(400).json({
        error: error instanceof Error ? error.message : '参考文章抓取失败，请尝试手动粘贴文章内容',
      })
      return
    }

    const userMessage = buildVersionDraftChatUserMessage({
      articleText,
      notes: session.notes,
      messages: messages.map((item) => ({
        role: item.role,
        content: item.content,
      })),
    })

    response.status(200)
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache')
    response.setHeader('Connection', 'keep-alive')
    response.setHeader('X-Accel-Buffering', 'no')
    response.flushHeaders()

    const client = this.createAnthropicClient(providerConfig)
    const requestedModel = this.resolvePromptEngineV2VersionDraftModel(session.model, providerConfig.model)
    const stream = client.messages.stream({
      model: requestedModel,
      max_tokens: DEFAULT_VERSION_DRAFT_STREAM_MAX_TOKENS,
      system: buildVersionDraftChatSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    })

    await this.pipeTextStreamToSse(stream, request, response)
  }

  async applyPromptEngineV2VersionDraftSession(id: number) {
    const session = await this.findPromptEngineV2VersionDraftSessionRecord(id)
    const messages = this.readVersionDraftMessages(session.messages as Prisma.JsonValue)
    const storedSuggestion = this.normalizePromptEngineVersionDraftSuggestion({
      suggestedName: session.suggestedName || session.title || 'AI 建版规则',
      suggestedDescription: session.suggestedDescription,
      suggestedRuleText: session.suggestedRuleText,
    })

    if (storedSuggestion.suggestedRuleText) {
      if (session.status !== 'APPLIED') {
        await this.prisma.geoPromptEngineVersionDraftSession.update({
          where: { id },
          data: {
            status: 'APPLIED',
          },
        })
      }

      return storedSuggestion
    }

    if (messages.length === 0) {
      throw new BadRequestException('先和模型聊出一版可用规则，再应用到草稿')
    }

    const suggestion = await this.applyPromptEngineV2VersionDraftChat({
      messages: messages.map((item) => ({
        role: item.role,
        content: item.content,
        createdAt: item.createdAt,
      })),
      articleText: session.articleText,
      articleUrl: session.articleUrl,
      notes: session.notes,
      model: session.model,
    })

    await this.prisma.geoPromptEngineVersionDraftSession.update({
      where: { id },
      data: {
        status: 'APPLIED',
        suggestedName: suggestion.suggestedName,
        suggestedDescription: suggestion.suggestedDescription,
        suggestedRuleText: suggestion.suggestedRuleText,
      },
    })

    return suggestion
  }

  async findSerpProjects() {
    const projects = await this.prisma.geoSerpResearchProject.findMany({
      include: {
        aiSummary: {
          select: { id: true, updatedAt: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    })

    return projects.map((project) => this.toSerpProjectSummaryView(project))
  }

  async findSerpProject(id: number) {
    const project = await this.prisma.geoSerpResearchProject.findUnique({
      where: { id },
      include: {
        aiSummary: true,
        results: {
          orderBy: [{ rank: 'asc' }, { id: 'asc' }],
        },
      },
    })

    if (!project) {
      throw new NotFoundException('研究项目不存在')
    }

    return this.toSerpProjectDetailView(project)
  }

  async findSerpProjectAiSummary(id: number) {
    const summary = await this.prisma.geoSerpAiSummary.findUnique({
      where: { projectId: id },
      include: {
        project: {
          select: {
            id: true,
            keyword: true,
            category: true,
            engine: true,
            updatedAt: true,
          },
        },
      },
    })

    if (!summary) {
      throw new NotFoundException('当前研究项目还没有 AI 总结')
    }

    return this.toAiSummaryView(summary)
  }

  async findAiSummaries(query: FindGeoAiSummariesQueryDto) {
    const category = query.category?.trim()
    const summaries = await this.prisma.geoSerpAiSummary.findMany({
      where: {
        ...(category ? { category } : {}),
      },
      include: {
        project: {
          select: {
            id: true,
            keyword: true,
            category: true,
            engine: true,
            updatedAt: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    })

    return summaries.map((summary) => this.toAiSummaryView(summary))
  }

  async findRuleCards(query: FindGeoRuleCardsQueryDto) {
    const cards = await this.prisma.geoRuleCard.findMany({
      where: {
        ...(query.category?.trim() ? { category: query.category.trim() } : {}),
        ...(query.activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
    })

    return cards.map((card) => this.toRuleCardView(card))
  }

  async findRuleCard(id: number) {
    const card = await this.prisma.geoRuleCard.findUnique({
      where: { id },
    })

    if (!card) {
      throw new NotFoundException('规则卡不存在')
    }

    return this.toRuleCardView(card)
  }

  async createSerpProject(payload: CreateSerpResearchProjectDto) {
    const mode = payload.mode ?? 'automatic'
    const category = payload.category.trim()

    if (!category) {
      throw new BadRequestException('请先填写本次研究对应的产品品类')
    }

    if (mode === 'manual') {
      return this.createManualSerpProject(payload)
    }

    const keyword = payload.keyword?.trim()
    const rankLimit = payload.rankLimit

    if (!keyword) {
      throw new BadRequestException('自动模式下请先输入要研究的搜索关键词')
    }

    if (!rankLimit) {
      throw new BadRequestException('自动模式下请先设置要抓取的前 N 名')
    }

    const collection = await collectBaiduBaijiahaoSerp({
      keyword,
      rankLimit,
    })

    const resultInputs: Prisma.GeoSerpResearchResultCreateWithoutProjectInput[] = []

    for (const item of collection.items) {
      resultInputs.push(await this.buildSerpResultInput(keyword, item))
    }

    const project = await this.prisma.geoSerpResearchProject.create({
      data: {
        category,
        keyword,
        rankLimit,
        status: collection.blockedDetected ? GeoSerpProjectStatus.BLOCKED : GeoSerpProjectStatus.SUCCEEDED,
        statusMessage: collection.statusMessage,
        inspectedCount: collection.inspectedCount,
        matchedCount: collection.matchedCount,
        baiduBlockedDetected: collection.blockedDetected,
        results: {
          create: resultInputs,
        },
      },
      include: {
        results: {
          orderBy: [{ rank: 'asc' }, { id: 'asc' }],
        },
      },
    })

    return this.toSerpProjectDetailView(project)
  }

  private async createManualSerpProject(payload: CreateSerpResearchProjectDto) {
    const articleUrls = Array.from(
      new Set((payload.articleUrls ?? []).map((item) => item.trim()).filter(Boolean))
    )

    if (articleUrls.length === 0) {
      throw new BadRequestException('手动模式下请至少提供一篇百家号文章链接')
    }

    if (articleUrls.length > 20) {
      throw new BadRequestException('手动模式下最多一次录入 20 个链接')
    }

    if (articleUrls.some((url) => !this.isBaijiahaoArticleUrl(url))) {
      throw new BadRequestException('手动模式当前只支持 baijiahao.baidu.com 的文章链接')
    }

    const keyword = payload.keyword?.trim() || '手动百家号文章研究'
    const category = payload.category.trim()
    const resultInputs: Prisma.GeoSerpResearchResultCreateWithoutProjectInput[] = []

    for (const [index, url] of articleUrls.entries()) {
      resultInputs.push(await this.buildManualSerpResultInput(keyword, url, index + 1))
    }

    const successCount = resultInputs.filter((item) => item.fetchStatus === GeoSerpResultStatus.ANALYZED).length
    const failedCount = resultInputs.length - successCount
    const status =
      successCount > 0 ? GeoSerpProjectStatus.SUCCEEDED : GeoSerpProjectStatus.FAILED
    const statusMessage =
      failedCount > 0
        ? `已手动录入 ${articleUrls.length} 篇文章，其中 ${successCount} 篇解剖成功，${failedCount} 篇抓取失败。`
        : `已手动录入 ${articleUrls.length} 篇文章，并完成全部解剖。`

    const project = await this.prisma.geoSerpResearchProject.create({
      data: {
        category,
        keyword,
        rankLimit: articleUrls.length,
        engine: 'manual',
        status,
        statusMessage,
        inspectedCount: articleUrls.length,
        matchedCount: articleUrls.length,
        baiduBlockedDetected: false,
        results: {
          create: resultInputs,
        },
      },
      include: {
        results: {
          orderBy: [{ rank: 'asc' }, { id: 'asc' }],
        },
      },
    })

    return this.toSerpProjectDetailView(project)
  }

  async generateSerpProjectAiSummary(id: number) {
    const { project, analyzedResults, providerConfig } = await this.prepareSerpProjectAiSummary(id)
    const insightResult = await this.generateProjectInsight(project, analyzedResults, providerConfig)
    return this.persistSerpProjectAiSummary(project, insightResult)
  }

  async saveSerpProjectAiSummary(id: number, payload: SaveGeoSerpAiSummaryDto) {
    const project = await this.findSerpProjectWithResults(id)
    const normalizedInsight = this.normalizeInsightPayload({
      rawSummary: payload.rawSummary,
      titlePatterns: payload.titlePatterns,
      leadPatterns: payload.leadPatterns,
      sectionBlueprint: payload.sectionBlueprint,
      keywordPlacement: payload.keywordPlacement,
      sellingPointOrder: payload.sellingPointOrder,
      trustSignals: payload.trustSignals,
      endingPatterns: payload.endingPatterns,
      antiPatterns: payload.antiPatterns,
      rankingHypotheses: payload.rankingHypotheses,
    })

    return this.persistSerpProjectAiSummary(project, {
      insight: normalizedInsight,
      model: payload.model.trim() || DEFAULT_MODEL,
    })
  }

  async streamSerpProjectAiSummary(id: number, request: Request, response: Response) {
    await this.streamSerpProjectAiSummaryPreview(id, request, response, {
      allowFallback: true,
      mode: 'standard',
    })
  }

  async streamSerpProjectAiSummaryTest(
    id: number,
    payload: StreamGeoSerpAiSummaryTestDto,
    request: Request,
    response: Response
  ) {
    await this.streamSerpProjectAiSummaryPreview(id, request, response, {
      requestedModel: payload.model?.trim() || undefined,
      allowFallback: payload.allowFallback ?? false,
      mode: 'test',
      preservePreviewOnFallback: true,
    })
  }

  async getSerpProjectAiSummaryTestPrompt(id: number, payload: StreamGeoSerpAiSummaryTestDto) {
    const { project, analyzedResults } = await this.prepareSerpProjectAiSummaryPromptPreview(id)
    const providerConfig = await this.ensureProviderConfig()
    const requestedModel = payload.model?.trim() || providerConfig.model || DEFAULT_MODEL

    return this.buildProjectInsightPromptPreview(project, analyzedResults, requestedModel)
  }

  async getSerpProjectAiSummaryPromptPreview(id: number) {
    const { project, analyzedResults } = await this.prepareSerpProjectAiSummaryPromptPreview(id)
    const providerConfig = await this.ensureProviderConfig()
    const requestedModel = providerConfig.model || DEFAULT_MODEL

    return this.buildProjectInsightPromptPreview(project, analyzedResults, requestedModel)
  }

  private async streamSerpProjectAiSummaryPreview(
    id: number,
    request: Request,
    response: Response,
    options: InsightStreamExecutionOptions
  ) {
    const { project, analyzedResults, providerConfig } = await this.prepareSerpProjectAiSummary(id)
    const requestedModel = options.requestedModel || providerConfig.model || DEFAULT_MODEL
    const runtimeConfig = {
      ...providerConfig,
      model: requestedModel,
    }
    const allowFallback = options.allowFallback ?? true
    const preservePreviewOnFallback = options.preservePreviewOnFallback ?? false

    response.status(200)
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache')
    response.setHeader('Connection', 'keep-alive')
    response.setHeader('X-Accel-Buffering', 'no')
    response.flushHeaders()

    let closed = false

    const cleanup = () => {
      request.off('close', handleClientClose)
      response.off('close', handleClientClose)
    }

    const safeWrite = (event: Record<string, unknown>) => {
      if (response.writableEnded || response.destroyed) return false
      response.write(`data: ${JSON.stringify(event)}\n\n`)
      return true
    }

    const finishStream = (event?: Record<string, unknown>) => {
      if (closed) return

      if (event) {
        safeWrite(event)
      }

      closed = true

      if (!response.writableEnded && !response.destroyed) {
        response.end()
      }

      cleanup()
    }

    const handleClientClose = () => {
      if (closed) return
      closed = true
      cleanup()
    }

    request.once('close', handleClientClose)
    response.once('close', handleClientClose)

    try {
      const insightResult = await this.streamProjectInsight(project, analyzedResults, runtimeConfig, {
        onText: (text) => {
          safeWrite({ type: 'text', content: text })
        },
        onStatus: (phase, message, model) => {
          safeWrite({ type: 'status', phase, content: message, model: model || null })
        },
        onResetPreview: () => {
          safeWrite({ type: 'reset' })
        },
      }, {
        allowFallback,
        preservePreviewOnFallback,
      })

      safeWrite({
        type: 'result',
        summary: this.toAiSummaryDraftView(project, insightResult, {
          requestedModel,
          fallbackUsed: insightResult.model !== requestedModel,
          fallbackReason:
            insightResult.model !== requestedModel
              ? allowFallback
                ? '主模型未稳定完成，已切换保底链路。'
                : '当前是纯测试模式，未启用保底链路。'
              : '',
        }),
      })

      finishStream({ type: 'done' })
    } catch (error) {
      if (!response.headersSent) {
        response.status(500).json({
          error: error instanceof Error ? error.message : 'AI 总结生成失败',
        })
        return
      }

      finishStream({
        type: 'error',
        content: this.toInsightStreamErrorMessage(error, allowFallback, options.mode ?? 'standard'),
      })
    }
  }

  private async prepareSerpProjectAiSummaryPromptPreview(id: number) {
    const project = await this.findSerpProjectWithResults(id)
    const analyzedResults = project.results.filter((item) => item.fetchStatus === GeoSerpResultStatus.ANALYZED)

    if (analyzedResults.length === 0) {
      throw new BadRequestException('当前项目至少需要一篇解剖成功的文章，才能查看 AI 总结 Prompt')
    }

    return {
      project,
      analyzedResults,
    }
  }

  async generateRuleCard(payload: GenerateGeoRuleCardDto) {
    const category = payload.category.trim()
    if (!category) {
      throw new BadRequestException('请先指定要沉淀规则卡的品类')
    }

    const providerConfig = await this.ensureProviderConfig()
    if (!providerConfig.apiKey.trim()) {
      throw new BadRequestException('请先完成 Anthropic 配置后再生成规则卡')
    }

    const fromDate = payload.fromDate ? this.toBoundaryDate(payload.fromDate, false) : null
    const toDate = payload.toDate ? this.toBoundaryDate(payload.toDate, true) : null
    const summaries = await this.prisma.geoSerpAiSummary.findMany({
      where: {
        category,
        ...(fromDate || toDate
          ? {
              createdAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    })

    if (summaries.length === 0) {
      throw new BadRequestException('当前时间范围内还没有可用于沉淀规则卡的 AI 总结')
    }

    const insightResult = await this.generateRuleCardInsight(category, summaries, providerConfig, payload)
    const insight = insightResult.insight
    const sortedByCreatedAt = [...summaries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    const sourceTimeStart = fromDate ?? sortedByCreatedAt[0]?.createdAt ?? null
    const sourceTimeEnd = toDate ?? sortedByCreatedAt[sortedByCreatedAt.length - 1]?.createdAt ?? null
    const existingActive = await this.prisma.geoRuleCard.findFirst({
      where: {
        category,
        isActive: true,
      },
      select: { id: true },
    })

    const card = await this.prisma.geoRuleCard.create({
      data: {
        category,
        model: insightResult.model,
        rawSummary: insight.rawSummary,
        titlePatterns: this.toJsonArray(insight.titlePatterns),
        leadPatterns: this.toJsonArray(insight.leadPatterns),
        sectionBlueprint: this.toJsonArray(insight.sectionBlueprint),
        keywordPlacement: this.toJsonArray(insight.keywordPlacement),
        sellingPointOrder: this.toJsonArray(insight.sellingPointOrder),
        trustSignals: this.toJsonArray(insight.trustSignals),
        endingPatterns: this.toJsonArray(insight.endingPatterns),
        antiPatterns: this.toJsonArray(insight.antiPatterns),
        rankingHypotheses: this.toJsonArray(insight.rankingHypotheses),
        sourceSummaryCount: summaries.length,
        sourceSummaryIds: this.toNumberJsonArray(summaries.map((item) => item.id)),
        sourceTimeStart,
        sourceTimeEnd,
        isActive: !existingActive,
      },
    })

    return this.toRuleCardView(card)
  }

  async activateRuleCard(id: number, payload: ActivateGeoRuleCardDto) {
    const ruleCard = await this.prisma.geoRuleCard.findUnique({
      where: { id },
    })

    if (!ruleCard) {
      throw new NotFoundException('规则卡不存在')
    }

    const isActive = payload.isActive ?? true

    if (isActive) {
      const [_, updated] = await this.prisma.$transaction([
        this.prisma.geoRuleCard.updateMany({
          where: { category: ruleCard.category },
          data: { isActive: false },
        }),
        this.prisma.geoRuleCard.update({
          where: { id },
          data: { isActive: true },
        }),
      ])

      return this.toRuleCardView(updated)
    }

    const updated = await this.prisma.geoRuleCard.update({
      where: { id },
      data: { isActive: false },
    })

    return this.toRuleCardView(updated)
  }

  async removeSerpProject(id: number) {
    const project = await this.prisma.geoSerpResearchProject.findUnique({
      where: { id },
    })

    if (!project) {
      throw new NotFoundException('研究项目不存在')
    }

    await this.prisma.geoSerpResearchProject.delete({
      where: { id },
    })

    return {
      id,
      success: true,
    }
  }

  async updateProviderConfig(payload: UpdateGeoProviderConfigDto) {
    const config = await this.prisma.geoProviderConfig.upsert({
      where: { id: 1 },
      update: {
        ...(payload.apiKey !== undefined ? { apiKey: payload.apiKey.trim() } : {}),
        ...(payload.baseUrl !== undefined ? { baseUrl: payload.baseUrl.trim() } : {}),
        ...(payload.model !== undefined ? { model: payload.model.trim() || DEFAULT_MODEL } : {}),
      },
      create: {
        id: 1,
        apiKey: payload.apiKey?.trim() ?? process.env.ANTHROPIC_API_KEY?.trim() ?? '',
        baseUrl: payload.baseUrl?.trim() ?? process.env.ANTHROPIC_BASE_URL?.trim() ?? '',
        model: payload.model?.trim() || process.env.MODEL_NAME?.trim() || DEFAULT_MODEL,
      },
    })

    return this.toProviderConfigView(config)
  }

  async generatePromptV2(payload: GenerateGeoPromptV2Dto, request: Request, response: Response) {
    const articleText = payload.articleText?.trim()
    const articleUrl = payload.articleUrl?.trim()

    if (!articleText && !articleUrl) {
      response.status(400).json({ error: '请提供文章内容或文章 URL' })
      return
    }

    const providerConfig = await this.ensureProviderConfig()

    if (!providerConfig.apiKey.trim()) {
      response.status(400).json({ error: '请先完成 Anthropic 配置后再生成 Prompt' })
      return
    }

    const version = await this.prisma.geoPromptEngineVersion.findUnique({
      where: { id: payload.versionId },
    })

    if (!version || !version.isActive) {
      response.status(400).json({ error: '当前选择的版本不存在或已停用' })
      return
    }

    const fixedRules = await this.ensurePromptEngineV2FixedRules()
    let article = articleText!

    if (articleUrl) {
      try {
        article = await fetchArticle(articleUrl)
      } catch (error) {
        response.status(400).json({
          error: error instanceof Error ? error.message : '参考文章抓取失败，请尝试手动粘贴文章内容',
        })
        return
      }
    }

    const product = this.toProductInfo(payload.product)

    response.status(200)
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache')
    response.setHeader('Connection', 'keep-alive')
    response.setHeader('X-Accel-Buffering', 'no')
    response.flushHeaders()

    try {
      const stream = this.createClaudeStreamV2(article, product, providerConfig, fixedRules.ruleText, version)
      await this.pipeTextStreamToSse(stream, request, response)
    } catch (error) {
      if (!response.writableEnded && !response.destroyed) {
        response.write(`data: ${JSON.stringify({
          type: 'error',
          content: error instanceof Error ? error.message : '生成失败',
        })}\n\n`)
        response.end()
      }
    }
  }

  async streamPromptEngineV2VersionDraftChat(
    payload: StreamGeoPromptEngineVersionDraftChatDto,
    request: Request,
    response: Response
  ) {
    const providerConfig = await this.ensureProviderConfig()

    if (!providerConfig.apiKey.trim()) {
      response.status(400).json({ error: '请先完成 Anthropic 配置后再使用 AI 对话创建版本' })
      return
    }

    let articleText = ''

    try {
      articleText = await this.resolveVersionDraftArticleText(payload.articleText, payload.articleUrl)
    } catch (error) {
      response.status(400).json({
        error: error instanceof Error ? error.message : '参考文章抓取失败，请尝试手动粘贴文章内容',
      })
      return
    }

    const userMessage = buildVersionDraftChatUserMessage({
      articleText,
      notes: payload.notes?.trim() ?? '',
      messages: payload.messages.map((item) => ({
        role: item.role,
        content: item.content.trim(),
      })),
    })

    response.status(200)
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache')
    response.setHeader('Connection', 'keep-alive')
    response.setHeader('X-Accel-Buffering', 'no')
    response.flushHeaders()

    const client = this.createAnthropicClient(providerConfig)
    const requestedModel = this.resolvePromptEngineV2VersionDraftModel(payload.model, providerConfig.model)
    const stream = client.messages.stream({
      model: requestedModel,
      max_tokens: DEFAULT_VERSION_DRAFT_STREAM_MAX_TOKENS,
      system: buildVersionDraftChatSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    })

    await this.pipeTextStreamToSse(stream, request, response)
  }

  async applyPromptEngineV2VersionDraftChat(payload: StreamGeoPromptEngineVersionDraftChatDto) {
    const providerConfig = await this.ensureProviderConfig()

    if (!providerConfig.apiKey.trim()) {
      throw new BadRequestException('请先完成 Anthropic 配置后再应用 AI 对话结果')
    }

    const messages = this.normalizePromptEngineV2VersionDraftMessages(payload.messages ?? [])
    let articleText = ''

    try {
      articleText = await this.resolveVersionDraftArticleText(payload.articleText, payload.articleUrl)
    } catch (error) {
      const fallbackSuggestion = this.buildPromptEngineVersionDraftFallbackSuggestion(messages, payload.notes)
      if (fallbackSuggestion) return fallbackSuggestion

      throw new BadRequestException(
        error instanceof Error ? error.message : '参考文章抓取失败，请尝试手动粘贴文章内容'
      )
    }

    const client = this.createAnthropicClient(providerConfig)
    const requestedModel = this.resolvePromptEngineV2VersionDraftModel(payload.model, providerConfig.model)
    let response: Anthropic.Messages.Message

    try {
      response = await this.runInsightRequest(
        client.messages.create({
          model: requestedModel,
          max_tokens: DEFAULT_VERSION_DRAFT_MAX_TOKENS,
          temperature: 0,
          system: buildVersionDraftApplySystemPrompt(),
          messages: [
            {
              role: 'user',
              content: buildVersionDraftApplyUserMessage({
                articleText,
                notes: payload.notes?.trim() ?? '',
                messages: messages.map((item) => ({
                  role: item.role,
                  content: item.content,
                })),
              }),
            },
          ],
          output_config: {
            format: {
              type: 'json_schema',
              schema: this.buildPromptEngineVersionDraftOutputSchema(),
            },
          },
        })
      )
    } catch (error) {
      const fallbackSuggestion = this.buildPromptEngineVersionDraftFallbackSuggestion(messages, payload.notes)
      if (fallbackSuggestion) return fallbackSuggestion

      throw new BadRequestException(error instanceof Error ? error.message : 'AI 对话结果应用失败，请稍后重试')
    }

    const outputText = response.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('\n')
      .trim()

    try {
      return this.normalizePromptEngineVersionDraftSuggestion(
        this.parsePromptEngineVersionDraftSuggestion(outputText)
      )
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof BadRequestException) {
        try {
          return this.normalizePromptEngineVersionDraftSuggestion(
            await this.repairPromptEngineVersionDraftWithFallbackModel(outputText, providerConfig)
          )
        } catch {
          const fallbackSuggestion = this.buildPromptEngineVersionDraftFallbackSuggestion(messages, payload.notes)
          if (fallbackSuggestion) return fallbackSuggestion

          throw new BadRequestException('AI 返回内容无法解析为版本草稿，请稍后重试')
        }
      }

      throw error
    }
  }

  async importPromptEngineV2VersionDraft(payload: ImportGeoPromptEngineVersionDraftDto) {
    return this.parsePromptEngineVersionDraftMarkdown(payload.fileName, payload.content)
  }

  async findPublicationRecords(query: FindGeoPublicationRecordsQueryDto) {
    const where = this.buildPublicationRecordWhere(query)

    const records = await this.prisma.geoPublicationRecord.findMany({
      where,
      include: {
        promptBatchJobItem: {
          include: {
            job: true,
          },
        },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: 300,
    })

    const crawlStats = await this.buildPublicationRecordCrawlStats(records.map((record) => record.id))

    return records.map((record) => this.toPublicationRecordView(record, crawlStats.get(record.id)))
  }

  async findPublicationStats(query: FindGeoPublicationRecordsQueryDto) {
    const where = this.buildPublicationRecordWhere(query)
    const records = await this.prisma.geoPublicationRecord.findMany({
      where,
      select: {
        id: true,
        publishedAt: true,
        product: true,
        promptCode: true,
      },
      orderBy: [{ publishedAt: 'asc' }, { id: 'asc' }],
    })
    const recordIds = records.map((record) => record.id)
    const recordIdSet = new Set(recordIds)
    const matchedCitations = recordIds.length
      ? await this.prisma.geoPublicationCrawlCitation.findMany({
          where: {
            publicationRecordId: {
              in: recordIds,
            },
            isMatched: true,
          },
          include: {
            result: true,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
      : []
    const recordMetrics = new Map<number, { matchedCitationCount: number; resultIds: Set<number> }>()
    const resultCitationCount = new Map<number, number>()

    matchedCitations.forEach((citation) => {
      if (!citation.publicationRecordId) return

      const metric = recordMetrics.get(citation.publicationRecordId) ?? {
        matchedCitationCount: 0,
        resultIds: new Set<number>(),
      }
      metric.matchedCitationCount += 1
      metric.resultIds.add(citation.resultId)
      recordMetrics.set(citation.publicationRecordId, metric)
      resultCitationCount.set(citation.resultId, citation.result.citationCount)
    })

    const earliestRecord = await this.prisma.geoPublicationRecord.findFirst({
      select: { publishedAt: true },
      orderBy: { publishedAt: 'asc' },
    })
    const projectWeekStart = earliestRecord
      ? this.toMondayStart(earliestRecord.publishedAt)
      : this.toMondayStart(new Date())
    const summaryGroup = this.createPublicationStatsGroup(records, recordMetrics)
    const productGroups = new Map<string, PublicationStatsGroup>()
    const promptCodeGroups = new Map<string, PublicationStatsGroup>()
    const weeklyGroups = new Map<number, PublicationStatsGroup & { startDate: Date; endDate: Date; weekLabel: string }>()

    records.forEach((record) => {
      this.addRecordToPublicationStatsGroup(
        this.ensurePublicationStatsGroup(productGroups, record.product || '未分类'),
        record,
        recordMetrics
      )
      this.addRecordToPublicationStatsGroup(
        this.ensurePublicationStatsGroup(promptCodeGroups, record.promptCode || '未关联编号'),
        record,
        recordMetrics
      )

      const week = this.toProjectWeek(record.publishedAt, projectWeekStart)
      const weekGroup = weeklyGroups.get(week.weekNo) ?? {
        ...this.createEmptyPublicationStatsGroup(),
        startDate: week.startDate,
        endDate: week.endDate,
        weekLabel: week.weekLabel,
      }
      this.addRecordToPublicationStatsGroup(weekGroup, record, recordMetrics)
      weeklyGroups.set(week.weekNo, weekGroup)
    })

    const productScope = query.product
      ? [query.product]
      : Array.from(new Set(records.map((record) => record.product).filter(Boolean)))
    const crawlResultWhere: Prisma.GeoPublicationCrawlResultWhereInput = productScope.length
      ? { product: { in: productScope } }
      : { id: { in: [] } }
    const crawlResults = await this.prisma.geoPublicationCrawlResult.findMany({
      where: crawlResultWhere,
      include: {
        citations: true,
      },
      orderBy: [{ completedAt: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
    })
    const latestCrawledAt = crawlResults.reduce<Date | null>((latest, result) => {
      const candidate = result.completedAt ?? result.updatedAt
      if (!latest || candidate > latest) return candidate
      return latest
    }, null)

    return {
      summary: {
        ...this.toPublicationStatsMetric(summaryGroup, resultCitationCount),
        crawlKeywordCount: new Set(crawlResults.map((result) => `${result.product}::${result.keyword}`)).size,
        latestCrawledAt: latestCrawledAt?.toISOString() ?? '',
      },
      weeklyTrend: Array.from(weeklyGroups.entries())
        .sort(([a], [b]) => a - b)
        .map(([weekNo, group]) => ({
          weekNo,
          weekLabel: group.weekLabel,
          startDate: this.toShanghaiDateString(group.startDate),
          endDate: this.toShanghaiDateString(group.endDate),
          ...this.toPublicationStatsMetric(group, resultCitationCount),
        })),
      productStats: Array.from(productGroups.entries())
        .map(([product, group]) => ({
          product,
          ...this.toPublicationStatsMetric(group, resultCitationCount),
        }))
        .sort((a, b) => b.publicationCount - a.publicationCount || b.matchedCitationCount - a.matchedCitationCount),
      keywordStats: this.toPublicationKeywordStats(crawlResults, recordIdSet),
      promptCodeStats: Array.from(promptCodeGroups.entries())
        .map(([promptCode, group]) => ({
          promptCode,
          ...this.toPublicationStatsMetric(group, resultCitationCount),
        }))
        .sort((a, b) => b.publicationCount - a.publicationCount || b.matchedCitationCount - a.matchedCitationCount),
    }
  }

  async createPublicationRecord(payload: CreateGeoPublicationRecordDto) {
    const data = await this.toPublicationRecordData(payload, true) as Prisma.GeoPublicationRecordUncheckedCreateInput

    const record = await this.prisma.geoPublicationRecord.create({
      data,
      include: {
        promptBatchJobItem: {
          include: {
            job: true,
          },
        },
      },
    })

    await this.ensurePublicationOption('PRODUCT', record.product)
    await this.ensurePublicationOption('PLATFORM', record.platform)
    await this.ensurePublicationOption('ACCOUNT_TYPE', record.accountType)

    return this.toPublicationRecordView(record)
  }

  async importPublicationRecords(file?: PublicationImportUploadFile) {
    if (!file?.buffer) {
      throw new BadRequestException('请上传 Excel 文件')
    }

    if (file.size > PUBLICATION_IMPORT_MAX_FILE_SIZE) {
      throw new BadRequestException('Excel 文件不能超过 8MB')
    }

    if (!/\.xlsx$/i.test(file.originalname)) {
      throw new BadRequestException('仅支持 .xlsx 格式的 Excel 文件')
    }

    const parsed = await this.parsePublicationImportWorkbook(file.buffer)

    if (parsed.rows.length === 0) {
      throw new BadRequestException('Excel 中没有可导入的发文记录')
    }

    const existingRecords = await this.prisma.geoPublicationRecord.findMany({
      select: {
        id: true,
        link: true,
      },
    })
    const existingLinkSet = new Set(existingRecords.map((record) => this.normalizePublicationUrl(record.link)).filter(Boolean))
    const promptCodeMap = await this.buildPublicationImportPromptCodeMap()
    const seenLinkSet = new Set<string>()
    const createData: Prisma.GeoPublicationRecordCreateManyInput[] = []
    const createdRows: PublicationImportRowDraft[] = []
    const resultItems: PublicationImportResultItem[] = []

    for (const row of parsed.rows) {
      const normalizedLink = this.normalizePublicationUrl(row.link)

      if (!normalizedLink) {
        resultItems.push(this.toPublicationImportResultItem(row, 'FAILED', '链接为空或格式不正确'))
        continue
      }

      if (seenLinkSet.has(normalizedLink)) {
        resultItems.push(this.toPublicationImportResultItem(row, 'SKIPPED', 'Excel 内链接重复'))
        continue
      }

      seenLinkSet.add(normalizedLink)

      if (existingLinkSet.has(normalizedLink)) {
        resultItems.push(this.toPublicationImportResultItem(row, 'SKIPPED', '系统中已存在相同链接'))
        continue
      }

      try {
        const promptBatchJobItemId = promptCodeMap.get(row.promptCode) ?? null
        const data = await this.toPublicationRecordData(
          {
            publishedAt: row.publishedAt,
            product: row.product,
            title: row.title,
            platform: row.platform,
            accountType: row.accountType,
            author: row.author,
            promptCode: row.promptCode,
            link: row.link,
            promptBatchJobItemId,
          },
          true
        ) as Prisma.GeoPublicationRecordCreateManyInput

        createData.push(data)
        createdRows.push(row)
        resultItems.push(this.toPublicationImportResultItem(row, 'CREATED', '导入成功'))
      } catch (error) {
        resultItems.push(this.toPublicationImportResultItem(
          row,
          'FAILED',
          error instanceof Error ? error.message : '记录校验失败'
        ))
      }
    }

    const blockedItems = resultItems.filter((item) => item.status !== 'CREATED')

    if (blockedItems.length > 0) {
      return {
        success: false,
        message: 'Excel 校验未通过，请按失败原因调整后重新上传',
        fileName: file.originalname,
        sheetName: parsed.sheetName,
        totalRows: parsed.rows.length,
        createdCount: 0,
        skippedCount: blockedItems.filter((item) => item.status === 'SKIPPED').length,
        failedCount: blockedItems.filter((item) => item.status === 'FAILED').length,
        rematchedCitationCount: 0,
        items: blockedItems,
      }
    }

    const createdCount = createData.length > 0
      ? (await this.prisma.geoPublicationRecord.createMany({
        data: createData,
      })).count
      : 0

    if (createdCount > 0) {
      await this.ensurePublicationImportOptions(createdRows)
    }

    const rematchedCitationCount = createdRows.length > 0
      ? await this.rematchPublicationCitationsByLinks(createdRows.map((row) => row.link))
      : 0

    return {
      success: true,
      message: 'Excel 导入成功',
      fileName: file.originalname,
      sheetName: parsed.sheetName,
      totalRows: parsed.rows.length,
      createdCount,
      skippedCount: resultItems.filter((item) => item.status === 'SKIPPED').length,
      failedCount: resultItems.filter((item) => item.status === 'FAILED').length,
      rematchedCitationCount,
      items: resultItems,
    }
  }

  async updatePublicationRecord(id: number, payload: UpdateGeoPublicationRecordDto) {
    await this.findPublicationRecordRecord(id)

    const data = await this.toPublicationRecordData(payload, false) as Prisma.GeoPublicationRecordUncheckedUpdateInput

    const record = await this.prisma.geoPublicationRecord.update({
      where: { id },
      data,
      include: {
        promptBatchJobItem: {
          include: {
            job: true,
          },
        },
      },
    })

    await this.ensurePublicationOption('PRODUCT', record.product)
    await this.ensurePublicationOption('PLATFORM', record.platform)
    await this.ensurePublicationOption('ACCOUNT_TYPE', record.accountType)

    return this.toPublicationRecordView(record)
  }

  async removePublicationRecord(id: number) {
    await this.findPublicationRecordRecord(id)

    await this.prisma.geoPublicationRecord.delete({
      where: { id },
    })

    return { id, success: true }
  }

  async findPublicationOptions() {
    await this.ensurePublicationDefaultOptions()

    const options = await this.prisma.geoPublicationOption.findMany({
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    })
    const products = options.filter((item) => item.type === 'PRODUCT').map((item) => item.label)
    const platforms = options.filter((item) => item.type === 'PLATFORM').map((item) => item.label)
    const accountTypes = options.filter((item) => item.type === 'ACCOUNT_TYPE').map((item) => item.label)

    return {
      products,
      platforms,
      accountTypes,
      items: options.map((item) => ({
        id: item.id,
        type: item.type,
        label: item.label,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    }
  }

  async createPublicationOption(payload: CreateGeoPublicationOptionDto) {
    const option = await this.ensurePublicationOption(payload.type, payload.label)

    return {
      id: option.id,
      type: option.type,
      label: option.label,
      sortOrder: option.sortOrder,
      createdAt: option.createdAt.toISOString(),
      updatedAt: option.updatedAt.toISOString(),
    }
  }

  async findPromptCodeOptions(query: FindGeoPromptCodeOptionsQueryDto) {
    const keyword = query.keyword?.trim()
    const items = await this.prisma.geoPromptBatchJobItem.findMany({
      where: {
        status: GeoPromptBatchItemStatus.SUCCEEDED,
        sequence: {
          not: null,
        },
        promptText: {
          not: '',
        },
        ...(keyword
          ? {
              OR: [
                { fileName: { contains: keyword } },
                { job: { profileName: { contains: keyword } } },
                { job: { versionName: { contains: keyword } } },
              ],
            }
          : {}),
      },
      include: {
        job: true,
      },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      take: 50,
    })

    return items.map((item) => {
      const fileName = this.buildPromptBatchTxtFileName(item.job, item.sequence ?? item.itemIndex)

      return {
        promptCode: fileName.replace(/\.txt$/i, ''),
        fileName,
        promptBatchJobItemId: item.id,
        promptBatchJobId: item.jobId,
        productProfile: item.job.profileName,
        versionName: item.job.engineType === GeoPromptBatchEngineType.LEGACY ? '旧版' : item.job.versionName,
        engineType: item.job.engineType,
        sequence: item.sequence,
        generatedAt: item.completedAt?.toISOString() ?? item.updatedAt.toISOString(),
      }
    })
  }

  async findPublicationCrawlSetting() {
    const setting = await this.ensurePublicationCrawlSetting()
    return this.toPublicationCrawlSettingView(setting)
  }

  async updatePublicationCrawlSetting(payload: UpdateGeoPublicationCrawlSettingDto) {
    const current = await this.ensurePublicationCrawlSetting()
    const minInterval = payload.requestIntervalMinSec ?? current.requestIntervalMinSec
    const maxInterval = payload.requestIntervalMaxSec ?? current.requestIntervalMaxSec

    if (minInterval > maxInterval) {
      throw new BadRequestException('最小请求间隔不能大于最大请求间隔')
    }

    const setting = await this.prisma.geoPublicationCrawlSetting.update({
      where: { id: 1 },
      data: {
        ...(payload.isEnabled !== undefined ? { isEnabled: payload.isEnabled } : {}),
        ...(payload.dailyRunTime !== undefined ? { dailyRunTime: payload.dailyRunTime } : {}),
        ...(payload.lookbackDays !== undefined ? { lookbackDays: payload.lookbackDays } : {}),
        ...(payload.maxKeywordsPerRun !== undefined ? { maxKeywordsPerRun: payload.maxKeywordsPerRun } : {}),
        ...(payload.requestIntervalMinSec !== undefined ? { requestIntervalMinSec: payload.requestIntervalMinSec } : {}),
        ...(payload.requestIntervalMaxSec !== undefined ? { requestIntervalMaxSec: payload.requestIntervalMaxSec } : {}),
      },
    })

    return this.toPublicationCrawlSettingView(setting)
  }

  async findPublicationCrawlKeywords() {
    const keywords = await this.prisma.geoPublicationCrawlKeyword.findMany({
      orderBy: [{ product: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    })

    return keywords.map((keyword) => this.toPublicationCrawlKeywordView(keyword))
  }

  async createPublicationCrawlKeyword(payload: CreateGeoPublicationCrawlKeywordDto) {
    const product = this.requireShortText(payload.product, '请填写产品')
    const keyword = this.requireShortText(payload.keyword, '请填写关键词')

    try {
      const created = await this.prisma.geoPublicationCrawlKeyword.create({
        data: {
          product,
          keyword,
          isActive: payload.isActive ?? true,
          sortOrder: payload.sortOrder ?? 0,
        },
      })

      return this.toPublicationCrawlKeywordView(created)
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('该产品下已存在相同关键词')
      }
      throw error
    }
  }

  async updatePublicationCrawlKeyword(id: number, payload: UpdateGeoPublicationCrawlKeywordDto) {
    const current = await this.prisma.geoPublicationCrawlKeyword.findUnique({ where: { id } })

    if (!current) {
      throw new NotFoundException('抓取关键词不存在')
    }

    try {
      const updated = await this.prisma.geoPublicationCrawlKeyword.update({
        where: { id },
        data: {
          ...(payload.product !== undefined ? { product: this.requireShortText(payload.product, '请填写产品') } : {}),
          ...(payload.keyword !== undefined ? { keyword: this.requireShortText(payload.keyword, '请填写关键词') } : {}),
          ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
          ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}),
        },
      })

      return this.toPublicationCrawlKeywordView(updated)
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('该产品下已存在相同关键词')
      }
      throw error
    }
  }

  async removePublicationCrawlKeyword(id: number) {
    const current = await this.prisma.geoPublicationCrawlKeyword.findUnique({ where: { id } })

    if (!current) {
      throw new NotFoundException('抓取关键词不存在')
    }

    await this.prisma.geoPublicationCrawlKeyword.delete({ where: { id } })

    return { id, success: true }
  }

  async createPublicationCrawlJob(payload: CreateGeoPublicationCrawlJobDto = {}, triggerType = 'MANUAL', scheduleDate = '') {
    const setting = await this.ensurePublicationCrawlSetting()
    const product = payload.product?.trim() ?? ''
    const where: Prisma.GeoPublicationCrawlKeywordWhereInput = {
      isActive: true,
      ...(product ? { product } : {}),
    }
    const keywordRows = await this.prisma.geoPublicationCrawlKeyword.findMany({
      where,
      orderBy: [{ product: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
      take: setting.maxKeywordsPerRun,
    })

    if (keywordRows.length === 0) {
      throw new BadRequestException(product ? '该产品还没有启用的抓取关键词' : '还没有启用的抓取关键词')
    }

    const job = await this.prisma.geoPublicationCrawlJob.create({
      data: {
        triggerType,
        scheduleDate,
        product,
        keywordCount: keywordRows.length,
        queuedCount: keywordRows.length,
        lastError: '',
        results: {
          create: keywordRows.map((row) => ({
            product: row.product,
            keyword: row.keyword,
            contentSummary: '',
            rawContent: '',
            errorMessage: '',
          })),
        },
      },
      include: {
        results: {
          include: {
            citations: true,
          },
          orderBy: [{ id: 'asc' }],
        },
      },
    })

    this.kickPublicationCrawlWorker()

    return this.toPublicationCrawlJobView(job)
  }

  async findPublicationCrawlJobs(query: FindGeoPublicationCrawlJobsQueryDto = {}) {
    const jobs = await this.prisma.geoPublicationCrawlJob.findMany({
      where: query.product ? { product: query.product } : {},
      include: {
        results: {
          include: {
            citations: true,
          },
          orderBy: [{ id: 'asc' }],
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 30,
    })

    return jobs.map((job) => this.toPublicationCrawlJobView(job))
  }

  async findPublicationCrawlJob(id: number) {
    const job = await this.prisma.geoPublicationCrawlJob.findUnique({
      where: { id },
      include: {
        results: {
          include: {
            citations: true,
          },
          orderBy: [{ id: 'asc' }],
        },
      },
    })

    if (!job) {
      throw new NotFoundException('抓取任务不存在')
    }

    return this.toPublicationCrawlJobView(job)
  }

  async createPromptBatch(payload: CreateGeoPromptBatchDto) {
    const providerConfig = await this.ensureProviderConfig()

    if (!providerConfig.apiKey.trim()) {
      throw new BadRequestException('请先完成 Anthropic 配置后再批量生成 Prompt')
    }

    const profile = await this.prisma.geoProductProfile.findUnique({
      where: { id: payload.profileId },
    })

    if (!profile) {
      throw new NotFoundException('产品档案不存在')
    }

    const engineType = payload.engineType as PromptBatchEngineType
    const requestedCount = payload.count
    const product = this.toProductInfoFromProfile(profile)
    const article = await this.resolvePromptBatchArticle(profile, payload.articleText, payload.articleUrl)
    const dateCode = this.toShanghaiDateCode(new Date())
    let fixedRulesText = ''
    let versionId: number | null = null
    let versionName = ''
    let versionDescription = ''
    let versionRuleText = ''
    let ruleCardSnapshot: Prisma.InputJsonValue | undefined

    if (engineType === 'V2') {
      if (!payload.versionId) {
        throw new BadRequestException('新版批量生成必须选择版本')
      }

      const version = await this.prisma.geoPromptEngineVersion.findUnique({
        where: { id: payload.versionId },
      })

      if (!version || !version.isActive) {
        throw new BadRequestException('当前选择的版本不存在或已停用')
      }

      const fixedRules = await this.ensurePromptEngineV2FixedRules()
      versionId = version.id
      versionName = version.name
      versionDescription = version.description
      versionRuleText = version.ruleText
      fixedRulesText = fixedRules.ruleText
    } else {
      const activeRuleCard = await this.findActiveRuleCardByCategory(product.type)
      const context = this.toRuleCardPromptContext(activeRuleCard)
      ruleCardSnapshot = context ? (context as Prisma.InputJsonValue) : undefined
    }

    const job = await this.prisma.geoPromptBatchJob.create({
      data: {
        engineType,
        profileId: profile.id,
        profileName: profile.profileName,
        versionId,
        versionName,
        versionDescription,
        versionRuleText,
        fixedRulesText,
        articleUrl: article.url,
        articleText: article.text,
        productSnapshot: product as unknown as Prisma.InputJsonValue,
        ruleCardSnapshot,
        requestedCount,
        queuedCount: requestedCount,
        dateCode,
        lastError: '',
        items: {
          create: Array.from({ length: requestedCount }, (_, index) => ({
            itemIndex: index + 1,
            promptText: '',
            rawOutput: '',
            errorMessage: '',
          })),
        },
      },
      include: {
        items: {
          orderBy: { itemIndex: 'asc' },
        },
      },
    })

    this.kickPromptBatchWorker()

    return this.toPromptBatchJobView(job)
  }

  async findPromptBatches() {
    const jobs = await this.prisma.geoPromptBatchJob.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    })

    return jobs.map((job) => this.toPromptBatchJobView(job))
  }

  async findPromptBatch(id: number) {
    const job = await this.prisma.geoPromptBatchJob.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { itemIndex: 'asc' },
        },
      },
    })

    if (!job) {
      throw new NotFoundException('批量任务不存在')
    }

    return this.toPromptBatchJobView(job)
  }

  async downloadPromptBatch(id: number, response: Response) {
    const job = await this.prisma.geoPromptBatchJob.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { itemIndex: 'asc' },
        },
      },
    })

    if (!job) {
      throw new NotFoundException('批量任务不存在')
    }

    const successItems = job.items.filter((item) => item.status === GeoPromptBatchItemStatus.SUCCEEDED && item.promptText.trim())

    if (successItems.length === 0) {
      throw new BadRequestException('当前任务还没有可下载的成功结果')
    }

    const zip = new JSZip()

    for (const item of successItems) {
      const fileName = this.buildPromptBatchTxtFileName(job, item.sequence ?? item.itemIndex)
      zip.file(fileName, item.promptText)
    }

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    })
    const fileName = this.buildPromptBatchZipFileName(
      job,
      successItems[0].sequence ?? successItems[0].itemIndex,
      successItems[successItems.length - 1].sequence ?? successItems[successItems.length - 1].itemIndex
    )

    response.status(200)
    response.setHeader('Content-Type', 'application/zip')
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`)
    response.setHeader('Content-Length', String(buffer.length))
    response.end(buffer)
  }

  async generatePrompt(payload: GenerateGeoPromptDto, request: Request, response: Response) {
    const articleText = payload.articleText?.trim()
    const articleUrl = payload.articleUrl?.trim()

    if (!articleText && !articleUrl) {
      response.status(400).json({ error: '请提供文章内容或文章 URL' })
      return
    }

    const providerConfig = await this.ensureProviderConfig()

    if (!providerConfig.apiKey.trim()) {
      response.status(400).json({ error: '请先完成 Anthropic 配置后再生成 Prompt' })
      return
    }

    let article = articleText!

    if (articleUrl) {
      try {
        article = await fetchArticle(articleUrl)
      } catch (error) {
        response.status(400).json({
          error: error instanceof Error ? error.message : '参考文章抓取失败，请尝试手动粘贴文章内容',
        })
        return
      }
    }

    const product = this.toProductInfo(payload.product)
    const activeRuleCard = await this.findActiveRuleCardByCategory(product.type)

    response.status(200)
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache')
    response.setHeader('Connection', 'keep-alive')
    response.setHeader('X-Accel-Buffering', 'no')
    response.flushHeaders()

    let closed = false
    let abortableStream: { abort?: () => void } | null = null

    const cleanup = () => {
      request.off('close', handleClientClose)
      response.off('close', handleClientClose)
      abortableStream?.abort?.()
    }

    const safeWrite = (event: { type: 'text' | 'error' | 'done'; content?: string }) => {
      if (response.writableEnded || response.destroyed) return false

      response.write(`data: ${JSON.stringify(event)}\n\n`)
      return true
    }

    const finishStream = (event?: { type: 'error' | 'done'; content?: string }) => {
      if (closed) return

      if (event) {
        safeWrite(event)
      }

      closed = true

      if (!response.writableEnded && !response.destroyed) {
        response.end()
      }

      cleanup()
    }

    const handleClientClose = () => {
      if (closed) return

      closed = true
      cleanup()
    }

    request.once('close', handleClientClose)
    response.once('close', handleClientClose)

    try {
      const stream = this.createClaudeStream(article, product, providerConfig, activeRuleCard)
      abortableStream = stream as { abort?: () => void }

      stream.on('text', (text: string) => {
        safeWrite({ type: 'text', content: text })
      })

      stream.on('end', () => {
        finishStream({ type: 'done' })
      })

      stream.on('error', (error: Error) => {
        finishStream({ type: 'error', content: error.message })
      })
    } catch (error) {
      if (!response.headersSent) {
        response.status(500).json({
          error: error instanceof Error ? error.message : '生成失败',
        })
        return
      }

      finishStream({
        type: 'error',
        content: error instanceof Error ? error.message : '生成失败',
      })
    }
  }

  private async ensureProviderConfig() {
    return this.prisma.geoProviderConfig.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        apiKey: process.env.ANTHROPIC_API_KEY?.trim() ?? '',
        baseUrl: process.env.ANTHROPIC_BASE_URL?.trim() ?? '',
        model: process.env.MODEL_NAME?.trim() || DEFAULT_MODEL,
      },
    })
  }

  private async ensurePromptEngineV2FixedRules() {
    return this.prisma.geoPromptEngineV2FixedRules.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        ruleText: DEFAULT_PROMPT_ENGINE_V2_FIXED_RULES,
      },
    })
  }

  private createClaudeStream(
    article: string,
    product: ProductInfo,
    config: GeoProviderConfig,
    ruleCard: GeoRuleCard | null
  ) {
    const client = this.createAnthropicClient(config)

    return client.messages.stream({
      model: config.model || DEFAULT_MODEL,
      max_tokens: 8192,
      system: buildSystemPrompt(product),
      messages: [
        {
          role: 'user',
          content: buildUserMessage(article, product, this.toRuleCardPromptContext(ruleCard)),
        },
      ],
    })
  }

  private createClaudeStreamV2(
    article: string,
    product: ProductInfo,
    config: GeoProviderConfig,
    fixedRules: string,
    version: GeoPromptEngineVersion
  ) {
    const client = this.createAnthropicClient(config)

    return client.messages.stream({
      model: config.model || DEFAULT_MODEL,
      max_tokens: DEFAULT_GENERATE_V2_MAX_TOKENS,
      system: buildPromptEngineV2SystemPrompt(),
      messages: [
        {
          role: 'user',
          content: buildPromptEngineV2UserMessage({
            article,
            product,
            fixedRules,
            version: {
              name: version.name,
              description: version.description,
              ruleText: version.ruleText,
            },
          }),
        },
      ],
    })
  }

  private async pipeTextStreamToSse(
    stream: {
      on: (event: 'text' | 'end' | 'error', handler: (...args: any[]) => void) => void
      abort?: () => void
    },
    request: Request,
    response: Response
  ) {
    let closed = false

    const cleanup = () => {
      request.off('close', handleClientClose)
      response.off('close', handleClientClose)
      stream.abort?.()
    }

    const safeWrite = (event: { type: 'text' | 'error' | 'done'; content?: string }) => {
      if (response.writableEnded || response.destroyed) return false

      response.write(`data: ${JSON.stringify(event)}\n\n`)
      return true
    }

    const finishStream = (event?: { type: 'error' | 'done'; content?: string }) => {
      if (closed) return

      if (event) {
        safeWrite(event)
      }

      closed = true

      if (!response.writableEnded && !response.destroyed) {
        response.end()
      }

      cleanup()
    }

    const handleClientClose = () => {
      if (closed) return

      closed = true
      cleanup()
    }

    request.once('close', handleClientClose)
    response.once('close', handleClientClose)

    try {
      stream.on('text', (text: string) => {
        safeWrite({ type: 'text', content: text })
      })

      stream.on('end', () => {
        finishStream({ type: 'done' })
      })

      stream.on('error', (error: Error) => {
        finishStream({ type: 'error', content: error.message })
      })
    } catch (error) {
      if (!response.headersSent) {
        response.status(500).json({
          error: error instanceof Error ? error.message : '生成失败',
        })
        return
      }

      finishStream({
        type: 'error',
        content: error instanceof Error ? error.message : '生成失败',
      })
    }
  }

  private async recoverPromptBatchJobs() {
    try {
      await this.prisma.geoPromptBatchJobItem.updateMany({
        where: { status: GeoPromptBatchItemStatus.RUNNING },
        data: {
          status: GeoPromptBatchItemStatus.QUEUED,
          startedAt: null,
        },
      })

      await this.prisma.geoPromptBatchJob.updateMany({
        where: { status: GeoPromptBatchJobStatus.RUNNING },
        data: {
          status: GeoPromptBatchJobStatus.QUEUED,
          runningCount: 0,
        },
      })
    } catch (error) {
      console.error('[PromptBatch] Failed to recover unfinished jobs', error)
    }
  }

  private startPromptBatchWorker() {
    if (this.promptBatchWorkerStarted) return

    this.promptBatchWorkerStarted = true
    this.promptBatchWorkerTimer = setInterval(() => {
      void this.processPromptBatchQueue()
    }, PROMPT_BATCH_WORKER_POLL_MS)
    this.promptBatchWorkerTimer.unref?.()
    this.kickPromptBatchWorker()
  }

  private kickPromptBatchWorker() {
    setTimeout(() => {
      void this.processPromptBatchQueue()
    }, 0).unref?.()
  }

  private async processPromptBatchQueue() {
    if (this.promptBatchWorkerTickRunning) return

    this.promptBatchWorkerTickRunning = true

    try {
      while (this.activePromptBatchItems < PROMPT_BATCH_WORKER_CONCURRENCY) {
        const itemId = await this.claimPromptBatchItem()

        if (!itemId) break

        this.activePromptBatchItems += 1

        void this.runPromptBatchItem(itemId)
          .catch((error) => {
            console.error('[PromptBatch] Worker item failed unexpectedly', error)
          })
          .finally(() => {
            this.activePromptBatchItems = Math.max(this.activePromptBatchItems - 1, 0)
            this.kickPromptBatchWorker()
          })
      }
    } finally {
      this.promptBatchWorkerTickRunning = false
    }
  }

  private async claimPromptBatchItem() {
    const nextItem = await this.prisma.geoPromptBatchJobItem.findFirst({
      where: {
        status: GeoPromptBatchItemStatus.QUEUED,
        job: {
          status: {
            in: [GeoPromptBatchJobStatus.QUEUED, GeoPromptBatchJobStatus.RUNNING],
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })

    if (!nextItem) return null

    const claimed = await this.prisma.geoPromptBatchJobItem.updateMany({
      where: {
        id: nextItem.id,
        status: GeoPromptBatchItemStatus.QUEUED,
      },
      data: {
        status: GeoPromptBatchItemStatus.RUNNING,
        startedAt: new Date(),
        errorMessage: '',
      },
    })

    if (claimed.count === 0) return null

    await this.prisma.geoPromptBatchJob.update({
      where: { id: nextItem.jobId },
      data: { status: GeoPromptBatchJobStatus.RUNNING },
    })
    await this.refreshPromptBatchJobCounts(nextItem.jobId)

    return nextItem.id
  }

  private async runPromptBatchItem(itemId: number) {
    const item = await this.prisma.geoPromptBatchJobItem.findUnique({
      where: { id: itemId },
      include: { job: true },
    })

    if (!item) return

    let lastError: unknown = null

    for (let attempt = 1; attempt <= PROMPT_BATCH_ITEM_MAX_ATTEMPTS; attempt += 1) {
      await this.prisma.geoPromptBatchJobItem.update({
        where: { id: item.id },
        data: {
          status: GeoPromptBatchItemStatus.RUNNING,
          errorMessage: `正在尝试第 ${attempt}/${PROMPT_BATCH_ITEM_MAX_ATTEMPTS} 次生成 Prompt`,
        },
      })
      await this.refreshPromptBatchJobCounts(item.jobId)

      try {
        const output = await this.generatePromptBatchOutput(
          item.job,
          {
            itemIndex: item.itemIndex,
            requestedCount: item.job.requestedCount,
          },
          attempt > 1
        )

        await this.prisma.geoPromptBatchJobItem.update({
          where: { id: item.id },
          data: {
            status: GeoPromptBatchItemStatus.SUCCEEDED,
            rawOutput: output.rawOutput,
            promptText: output.promptText,
            errorMessage: '',
            completedAt: new Date(),
          },
        })
        await this.finalizePromptBatchJobIfDone(item.jobId)
        return
      } catch (error) {
        lastError = error
        const message = this.toPromptBatchRawErrorMessage(error)

        if (attempt < PROMPT_BATCH_ITEM_MAX_ATTEMPTS) {
          await this.prisma.geoPromptBatchJobItem.update({
            where: { id: item.id },
            data: {
              errorMessage: `第 ${attempt}/${PROMPT_BATCH_ITEM_MAX_ATTEMPTS} 次失败：${message}。正在准备第 ${attempt + 1}/${PROMPT_BATCH_ITEM_MAX_ATTEMPTS} 次重试`,
            },
          })
          await this.sleep(this.getPromptBatchItemRetryDelayMs(attempt))
          continue
        }
      }
    }

    await this.prisma.geoPromptBatchJobItem.update({
      where: { id: item.id },
      data: {
        status: GeoPromptBatchItemStatus.FAILED,
        errorMessage: `已尝试 ${PROMPT_BATCH_ITEM_MAX_ATTEMPTS}/${PROMPT_BATCH_ITEM_MAX_ATTEMPTS} 次仍失败：${this.toPromptBatchItemErrorMessage(lastError)}`,
        completedAt: new Date(),
      },
    })
    await this.finalizePromptBatchJobIfDone(item.jobId)
  }

  private async generatePromptBatchOutput(
    job: GeoPromptBatchJob,
    batchContext: PromptBatchGenerationContext,
    isRetryAttempt = false
  ) {
    const output = await this.requestPromptBatchOutput(job, batchContext, isRetryAttempt)

    if (output.promptText) {
      return output
    }

    if (output.rejectionReason) {
      throw new BadRequestException(output.rejectionReason)
    }

    throw new BadRequestException('模型返回内容不完整，未保存到下载文件')
  }

  private async requestPromptBatchOutput(
    job: GeoPromptBatchJob,
    batchContext: PromptBatchGenerationContext,
    isRetry = false
  ) {
    const providerConfig = await this.ensureProviderConfig()

    if (!providerConfig.apiKey.trim()) {
      throw new BadRequestException('Anthropic 配置缺少 API Key')
    }

    const client = this.createAnthropicClient(providerConfig)
    const product = this.toProductInfoFromSnapshot(job.productSnapshot)
    const batchInstruction = `${this.buildPromptBatchVariationInstruction(batchContext)}${isRetry ? this.buildPromptBatchRetryInstruction() : ''}`
    const stream = (
      job.engineType === GeoPromptBatchEngineType.V2
        ? client.messages.stream({
            model: providerConfig.model || DEFAULT_MODEL,
            max_tokens: DEFAULT_GENERATE_V2_MAX_TOKENS,
            temperature: 0.7,
            system: buildPromptEngineV2SystemPrompt(),
            messages: [
              {
                role: 'user',
                content: `${buildPromptEngineV2UserMessage({
                  article: job.articleText,
                  product,
                  fixedRules: job.fixedRulesText,
                  version: {
                    name: job.versionName,
                    description: job.versionDescription,
                    ruleText: job.versionRuleText,
                  },
                  variationIndex: batchContext.itemIndex,
                })}\n\n${batchInstruction}`,
              },
            ],
          })
        : client.messages.stream({
            model: providerConfig.model || DEFAULT_MODEL,
            max_tokens: 8192,
            temperature: 0.7,
            system: buildSystemPrompt(product),
            messages: [
              {
                role: 'user',
                content: `${buildUserMessage(
                  job.articleText,
                  product,
                  this.toPromptBatchRuleCardContext(job.ruleCardSnapshot),
                  { variationIndex: batchContext.itemIndex }
                )}\n\n${batchInstruction}`,
              },
            ],
          })
    )
    const rawOutput = await this.collectPromptBatchStreamOutput(stream)
    const promptText = this.extractGeneratedPrompt(rawOutput)
    const cleanedPromptText = promptText ? this.cleanPromptInternalLeakage(promptText) : ''
    const saveablePromptText = cleanedPromptText.length >= 500 ? cleanedPromptText : ''
    const leakageReasons = saveablePromptText ? this.findPromptLeakageReasons(saveablePromptText) : []

    return {
      rawOutput,
      promptText: leakageReasons.length > 0 ? '' : saveablePromptText,
      rejectionReason: leakageReasons.length > 0
        ? `生成结果包含内部执行痕迹：${leakageReasons.join('、')}，未保存到下载文件`
        : '',
    }
  }

  private toPromptBatchItemErrorMessage(error: unknown) {
    const message = this.toPromptBatchRawErrorMessage(error)

    if (this.isRetryablePromptBatchUpstreamError(error)) {
      return `模型上游暂时不可用：${message}`
    }

    return message || '生成失败'
  }

  private toPromptBatchRawErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message.trim()
    if (typeof error === 'string') return error.trim()
    return '生成失败'
  }

  private isRetryablePromptBatchUpstreamError(error: unknown) {
    const status = this.toPromptBatchErrorStatus(error)
    const message = this.toPromptBatchRawErrorMessage(error).toLowerCase()

    return (
      status === 429 ||
      status === 500 ||
      status === 502 ||
      status === 503 ||
      status === 504 ||
      message.includes('502') ||
      message.includes('upstream') ||
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('fetch failed') ||
      message.includes('terminated') ||
      message.includes('request was aborted')
    )
  }

  private toPromptBatchErrorStatus(error: unknown) {
    const status = (error as { status?: unknown })?.status

    return typeof status === 'number' ? status : null
  }

  private getPromptBatchItemRetryDelayMs(attempt: number) {
    return PROMPT_BATCH_ITEM_RETRY_BASE_DELAY_MS * attempt + Math.floor(Math.random() * 750)
  }

  private sleep(delayMs: number) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, delayMs)
    })
  }

  private async refreshPromptBatchJobCounts(jobId: number) {
    const job = await this.prisma.geoPromptBatchJob.findUnique({
      where: { id: jobId },
      select: { id: true, completedAt: true },
    })

    if (!job || job.completedAt) return

    const grouped = await this.prisma.geoPromptBatchJobItem.groupBy({
      by: ['status'],
      where: { jobId },
      _count: { _all: true },
    })
    const countByStatus = new Map(grouped.map((item) => [item.status, item._count._all]))
    const queuedCount = countByStatus.get(GeoPromptBatchItemStatus.QUEUED) ?? 0
    const runningCount = countByStatus.get(GeoPromptBatchItemStatus.RUNNING) ?? 0
    const successCount = countByStatus.get(GeoPromptBatchItemStatus.SUCCEEDED) ?? 0
    const failedCount = countByStatus.get(GeoPromptBatchItemStatus.FAILED) ?? 0
    const latestFailure = failedCount > 0
      ? await this.prisma.geoPromptBatchJobItem.findFirst({
          where: { jobId, status: GeoPromptBatchItemStatus.FAILED },
          orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        })
      : null

    if (queuedCount + runningCount === 0) return

    await this.prisma.geoPromptBatchJob.update({
      where: { id: jobId },
      data: {
        status: runningCount > 0 ? GeoPromptBatchJobStatus.RUNNING : GeoPromptBatchJobStatus.QUEUED,
        queuedCount,
        runningCount,
        successCount,
        failedCount,
        lastError: latestFailure?.errorMessage ?? '',
      },
    })
  }

  private async finalizePromptBatchJobIfDone(jobId: number) {
    if (this.finalizingPromptBatchJobs.has(jobId)) return

    this.finalizingPromptBatchJobs.add(jobId)

    try {
      const job = await this.prisma.geoPromptBatchJob.findUnique({
        where: { id: jobId },
        include: {
          items: {
            orderBy: { itemIndex: 'asc' },
          },
        },
      })

      if (!job || job.completedAt) return

      const queuedCount = job.items.filter((item) => item.status === GeoPromptBatchItemStatus.QUEUED).length
      const runningCount = job.items.filter((item) => item.status === GeoPromptBatchItemStatus.RUNNING).length
      const successItems = job.items.filter((item) => item.status === GeoPromptBatchItemStatus.SUCCEEDED)
      const failedItems = job.items.filter((item) => item.status === GeoPromptBatchItemStatus.FAILED)

      if (queuedCount + runningCount > 0) {
        await this.prisma.geoPromptBatchJob.update({
          where: { id: job.id },
          data: {
            status: runningCount > 0 ? GeoPromptBatchJobStatus.RUNNING : GeoPromptBatchJobStatus.QUEUED,
            queuedCount,
            runningCount,
            successCount: successItems.length,
            failedCount: failedItems.length,
            lastError: failedItems[failedItems.length - 1]?.errorMessage ?? '',
          },
        })
        return
      }

      if (successItems.length === 0) {
        await this.prisma.geoPromptBatchJob.update({
          where: { id: job.id },
          data: {
            status: GeoPromptBatchJobStatus.FAILED,
            queuedCount: 0,
            runningCount: 0,
            successCount: 0,
            failedCount: failedItems.length,
            lastError: failedItems[failedItems.length - 1]?.errorMessage ?? '批量任务全部失败',
            completedAt: new Date(),
          },
        })
        return
      }

      await this.prisma.$transaction(async (tx) => {
        const currentJob = await tx.geoPromptBatchJob.findUnique({
          where: { id: job.id },
          select: { completedAt: true },
        })

        if (!currentJob || currentJob.completedAt) return

        await tx.geoPromptBatchCounter.upsert({
          where: { profileId: job.profileId },
          update: {},
          create: {
            profileId: job.profileId,
            lastSequence: -1,
          },
        })

        const counter = await tx.geoPromptBatchCounter.update({
          where: { profileId: job.profileId },
          data: {
            lastSequence: {
              increment: successItems.length,
            },
          },
        })
        const sequenceStart = counter.lastSequence - successItems.length + 1
        const sequenceEnd = counter.lastSequence
        const zipFileName = this.buildPromptBatchZipFileName(job, sequenceStart, sequenceEnd)

        await Promise.all(
          successItems.map((item, index) => {
            const sequence = sequenceStart + index

            return tx.geoPromptBatchJobItem.update({
              where: { id: item.id },
              data: {
                sequence,
                fileName: this.buildPromptBatchTxtFileName(job, sequence),
              },
            })
          })
        )

        await tx.geoPromptBatchJob.update({
          where: { id: job.id },
          data: {
            status: failedItems.length > 0
              ? GeoPromptBatchJobStatus.PARTIAL_FAILED
              : GeoPromptBatchJobStatus.COMPLETED,
            queuedCount: 0,
            runningCount: 0,
            successCount: successItems.length,
            failedCount: failedItems.length,
            sequenceStart,
            sequenceEnd,
            zipFileName,
            lastError: failedItems[failedItems.length - 1]?.errorMessage ?? '',
            completedAt: new Date(),
          },
        })
      })
    } finally {
      this.finalizingPromptBatchJobs.delete(jobId)
    }
  }

  private async runPromptBatchRequest<T>(request: Promise<T>) {
    let timer: NodeJS.Timeout | null = null

    try {
      return await Promise.race([
        request,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error('Prompt batch request timed out'))
          }, PROMPT_BATCH_REQUEST_TIMEOUT_MS)
        }),
      ])
    } finally {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }

  private async collectPromptBatchStreamOutput(stream: {
    on: (event: 'text' | 'end' | 'error', handler: (...args: any[]) => void) => void
    abort?: () => void
  }) {
    return await new Promise<string>((resolve, reject) => {
      let outputText = ''
      let settled = false
      let timer: NodeJS.Timeout | null = setTimeout(() => {
        stream.abort?.()
        settled = true
        reject(new Error('Prompt batch request timed out'))
      }, PROMPT_BATCH_REQUEST_TIMEOUT_MS)

      const clear = () => {
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
      }

      stream.on('text', (text: string) => {
        if (settled) return
        outputText += text
      })

      stream.on('end', () => {
        if (settled) return
        settled = true
        clear()
        resolve(outputText.trim())
      })

      stream.on('error', (error: Error) => {
        if (settled) return
        settled = true
        clear()
        reject(error)
      })
    })
  }

  private buildPromptBatchVariationInstruction(context: PromptBatchGenerationContext) {
    const anglePool = [
      '痛点开场',
      '真实使用场景开场',
      '选购困惑提问开场',
      '参数/数据切入开场',
      '对比反差开场',
      '避坑经验开场',
      '人群需求开场',
      '榜单发布感开场',
      '朋友推荐口吻开场',
      '行业趋势切入开场',
    ]
    const structurePool = [
      '先讲选购难点，再进入榜单推荐',
      '先建立判断标准，再逐个解释品牌',
      '先按人群场景拆需求，再给排行结论',
      '先用对比制造差异，再说明每个品牌适合谁',
      '先讲避坑逻辑，再展开推荐理由',
    ]
    const labelStylePool = [
      '偏专业测评',
      '偏口语种草',
      '偏避坑指南',
      '偏理性清单',
      '偏朋友建议',
    ]
    const itemOffset = Math.max(context.itemIndex - 1, 0)
    const angle = anglePool[itemOffset % anglePool.length]
    const structure = structurePool[itemOffset % structurePool.length]
    const labelStyle = labelStylePool[itemOffset % labelStylePool.length]

    return `---

## 批量生成差异化要求

这是本批次第 ${context.itemIndex} / ${context.requestedCount} 篇。请为这一篇生成一份独立、完整、可直接复制使用的 Prompt，不要输出多篇。

- 本篇优先采用「${angle}」和「${structure}」，整体表达风格偏「${labelStyle}」。
- 同批次每一篇都必须尽量使用不同的开头切入、小节标题候选、模板标签候选、品牌点评表达顺序和句式组合。
- 不要复用固定开头句、固定段落模板或完全相同的小标题组合；即使产品、文章和版本规则相同，也要让这一篇 Prompt 指向不同的写法变化。
- 仍然必须遵守系统固定规则、版本规则、产品信息和编号一致性要求。
- 批量差异化只能改变写法角度，绝对不能改变、弱化或省略产品信息里的标题硬性规则。
- 不要把“第 ${context.itemIndex} / ${context.requestedCount} 篇”这类批次信息写进最终 Prompt，只把差异化方向转化成写作规则。
- 最终输出必须包含「### 生成提示词」和一个完整闭合的代码块，代码块内只能放最终 Prompt。`
  }

  private buildPromptBatchRetryInstruction() {
    return `

## 重试修正要求

上一次模型输出没有形成完整可保存的 Prompt，或包含了不应出现在最终 Prompt 里的内部执行痕迹。请这次压缩结构摘要，优先保证「### 生成提示词」下面的代码块完整闭合，不要中途停在半句话、半个列表或未闭合代码块。

如果原规则里包含随机值、取模、轮转、候选池选择、模块编号或变量计算，请只保留已经确定后的自然语言写作要求，禁止输出算法、公式、变量名、模块编号、计算过程或“顺序为 A-B-C”这类执行说明。

最终 Prompt 可以保留“禁止输出计算过程、变量名、取模公式”这类给写作模型看的约束，但不要写出任何具体计算步骤、变量取值、模块命中过程或标题随机值计算说明。`
  }

  private extractAnthropicText(response: unknown) {
    const content = (response as { content?: Array<{ type?: string; text?: string }> }).content ?? []

    return content
      .flatMap((block) => (block.type === 'text' && block.text ? [block.text] : []))
      .join('\n')
      .trim()
  }

  private extractGeneratedPrompt(rawText: string) {
    const promptMarker = '### 生成提示词'
    const text = rawText.trim()

    if (!text) return ''

    const index = text.indexOf(promptMarker)

    if (index === -1 && text.includes('### 结构摘要')) {
      return ''
    }

    const prompt = (index === -1 ? text : text.substring(index + promptMarker.length)).trim()
    const fencedPrompt = prompt.match(/^```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n```\s*$/)

    if (fencedPrompt) {
      return fencedPrompt[1].trim()
    }

    if (prompt.startsWith('```') && !/\n```\s*$/.test(prompt)) {
      return ''
    }

    const cleaned = prompt
      .replace(/^```[a-zA-Z0-9_-]*\s*\n/, '')
      .replace(/\n```\s*$/, '')
      .trim()

    return cleaned.length >= 500 ? cleaned : ''
  }

  private cleanPromptInternalLeakage(promptText: string) {
    const lines = promptText.split(/\r?\n/)
    const cleanedLines: string[] = []

    for (const line of lines) {
      if (this.isPromptInternalLeakageLine(line)) {
        continue
      }

      cleanedLines.push(line)
    }

    return cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  }

  private isPromptInternalLeakageLine(line: string) {
    const normalized = line.trim()

    if (!normalized) return false

    const leakagePatterns: RegExp[] = [
      /标题随机值计算|随机值计算|随机值\s*[:：]/,
      /\bUSER_[A-Z0-9_]+\b/i,
      /(?:^|[\s，,；;。])mod(?:[\s\d+\-*/=]|$)|取模|求余|余数|[a-z]\d[a-z\d]*\s*=\s*\d+/i,
      /对应模块\s*[A-ZＡ-Ｚ]|模块\s*[A-ZＡ-Ｚ]\s*第\s*\d+\s*项/,
      /顺序为\s*[A-ZＡ-Ｚ](?:[-—–][A-ZＡ-Ｚ])+/,
      /计算过程|计算公式|变量计算|公式如下/,
    ]

    return leakagePatterns.some((pattern) => this.hasPromptLeakagePattern(normalized, pattern))
  }

  private findPromptLeakageReasons(promptText: string) {
    const checks: Array<{ reason: string; pattern: RegExp }> = [
      { reason: '标题随机值/随机值计算', pattern: /标题随机值计算|随机值计算|随机值\s*[:：]/ },
      { reason: '内部变量名', pattern: /\bUSER_[A-Z0-9_]+\b/i },
      { reason: '取模或公式过程', pattern: /(?:^|[\s，,；;。])mod(?:[\s\d+\-*/=]|$)|取模|求余|余数|[a-z]\d[a-z\d]*\s*=\s*\d+/i },
      { reason: '模块编号选择过程', pattern: /对应模块\s*[A-ZＡ-Ｚ]|模块\s*[A-ZＡ-Ｚ]\s*第\s*\d+\s*项/ },
      { reason: '模块顺序说明', pattern: /顺序为\s*[A-ZＡ-Ｚ](?:[-—–][A-ZＡ-Ｚ])+/ },
      { reason: '内部计算说明', pattern: /计算过程|计算公式|变量计算|公式如下/ },
    ]

    return checks
      .filter((check) => this.hasPromptLeakagePattern(promptText, check.pattern))
      .map((check) => check.reason)
  }

  private hasPromptLeakagePattern(promptText: string, pattern: RegExp) {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
    const matcher = new RegExp(pattern.source, flags)
    let match: RegExpExecArray | null = null

    while ((match = matcher.exec(promptText)) !== null) {
      if (!this.isPromptLeakageInstructionContext(promptText, match.index)) {
        return true
      }

      if (match[0].length === 0) {
        matcher.lastIndex += 1
      }
    }

    return false
  }

  private isPromptLeakageInstructionContext(promptText: string, index: number) {
    const negativeCue =
      /(?:不要|禁止|不得|不能|不可|严禁|避免|不允许|请勿|杜绝|拒绝|不应|不准|不许|移除|删除|去掉|剔除|过滤)[^\n。；;]*$/
    const before = promptText.slice(Math.max(0, index - 60), index)
    const after = promptText.slice(index, Math.min(promptText.length, index + 60))

    return negativeCue.test(before) || /^[^\n。；;]*(?:不要|禁止|不得|不能|不可|严禁|避免|不允许|请勿|杜绝|拒绝|不应|不准|不许|移除|删除|去掉|剔除|过滤)/.test(after)
  }

  private async resolvePromptBatchArticle(
    profile: GeoProductProfile,
    articleText?: string,
    articleUrl?: string
  ) {
    const text = articleText?.trim()

    if (text) {
      return {
        text,
        url: articleUrl?.trim() ?? '',
      }
    }

    const url = articleUrl?.trim() || profile.articleUrl.trim()

    if (!url) {
      throw new BadRequestException('批量生成必须提供文章内容或文章 URL')
    }

    return {
      text: await fetchArticle(url),
      url,
    }
  }

  private toProductInfoFromProfile(profile: GeoProductProfile): ProductInfo {
    return {
      brand: profile.brand,
      name: profile.productName,
      type: profile.type,
      specs: profile.specs,
      sellingPoints: this.toStringArray(profile.sellingPoints),
      sellingPointsRange: profile.sellingPointsRange,
      targetAudience: profile.targetAudience,
      emphasis: this.toStringArray(profile.emphasis),
      emphasisRange: profile.emphasisRange,
      keyword: profile.keyword,
      keywordMode: profile.keywordMode === 'recompose' ? 'recompose' : 'exact',
      seoKeywords: this.toStringArray(profile.seoKeywords),
      brandPool: this.toStringArray(profile.brandPool),
      brandPoolCount: profile.brandPoolCount,
    }
  }

  private toProductInfoFromSnapshot(value: Prisma.JsonValue): ProductInfo {
    const source = this.toJsonObject(value) as Record<string, unknown>
    const readString = (key: keyof ProductInfo) => {
      const field = source[key]
      return typeof field === 'string' ? field : ''
    }
    const readStringArray = (key: keyof ProductInfo) => {
      const field = source[key]
      return Array.isArray(field) ? field.map((item) => String(item)).filter(Boolean) : []
    }

    return {
      brand: readString('brand'),
      name: readString('name'),
      type: readString('type'),
      specs: readString('specs'),
      sellingPoints: readStringArray('sellingPoints'),
      sellingPointsRange: readString('sellingPointsRange'),
      targetAudience: readString('targetAudience'),
      emphasis: readStringArray('emphasis'),
      emphasisRange: readString('emphasisRange'),
      keyword: readString('keyword'),
      keywordMode: readString('keywordMode') === 'recompose' ? 'recompose' : 'exact',
      seoKeywords: readStringArray('seoKeywords'),
      brandPool: readStringArray('brandPool'),
      brandPoolCount: readString('brandPoolCount'),
    }
  }

  private toPromptBatchRuleCardContext(value: Prisma.JsonValue | null): PromptBatchRuleCardContext {
    if (!value) return null

    const source = this.toJsonObject(value) as Record<string, unknown>
    const readString = (key: string) => {
      const field = source[key]
      return typeof field === 'string' ? field : ''
    }
    const readArray = (key: string) => {
      const field = source[key]
      return Array.isArray(field) ? field.map((item) => String(item)).filter(Boolean) : []
    }

    return {
      category: readString('category'),
      rawSummary: readString('rawSummary'),
      titlePatterns: readArray('titlePatterns'),
      leadPatterns: readArray('leadPatterns'),
      sectionBlueprint: readArray('sectionBlueprint'),
      keywordPlacement: readArray('keywordPlacement'),
      sellingPointOrder: readArray('sellingPointOrder'),
      trustSignals: readArray('trustSignals'),
      endingPatterns: readArray('endingPatterns'),
      antiPatterns: readArray('antiPatterns'),
      rankingHypotheses: readArray('rankingHypotheses'),
    }
  }

  private async findPublicationRecordRecord(id: number) {
    const record = await this.prisma.geoPublicationRecord.findUnique({
      where: { id },
    })

    if (!record) {
      throw new NotFoundException('发文记录不存在')
    }

    return record
  }

  private async parsePublicationImportWorkbook(buffer: Buffer) {
    let zip: JSZip

    try {
      zip = await JSZip.loadAsync(buffer)
    } catch {
      throw new BadRequestException('Excel 文件无法读取，请确认上传的是 .xlsx 文件')
    }

    const sheets = await this.readXlsxSheets(zip)
    const sharedStrings = await this.readXlsxSharedStrings(zip)
    let bestMatch: {
      sheetName: string
      rows: XlsxRow[]
      headerRowIndex: number
      headerMap: Map<PublicationImportHeaderField, number>
      score: number
    } | null = null

    for (const sheet of sheets) {
      const rows = await this.readXlsxRows(zip, sheet.path, sharedStrings)
      const header = this.findPublicationImportHeader(rows)

      if (!header) continue

      const sheetScore = header.score
        + (sheet.name === '发文数据' ? 80 : 0)
        + (sheet.name.includes('发文') ? 20 : 0)

      if (!bestMatch || sheetScore > bestMatch.score) {
        bestMatch = {
          sheetName: sheet.name,
          rows,
          headerRowIndex: header.headerRowIndex,
          headerMap: header.headerMap,
          score: sheetScore,
        }
      }
    }

    if (!bestMatch) {
      throw new BadRequestException('Excel 中未找到发文记录表头，请至少包含日期、产品、标题、链接或 UUID')
    }

    return {
      sheetName: bestMatch.sheetName,
      rows: this.toPublicationImportRows(bestMatch.rows, bestMatch.headerRowIndex, bestMatch.headerMap),
    }
  }

  private async readXlsxSheets(zip: JSZip): Promise<XlsxSheetInfo[]> {
    const workbookEntry = zip.file('xl/workbook.xml')
    const relsEntry = zip.file('xl/_rels/workbook.xml.rels')

    if (!workbookEntry || !relsEntry) {
      throw new BadRequestException('Excel 工作簿结构不完整')
    }

    const [workbookXml, relsXml] = await Promise.all([
      workbookEntry.async('string'),
      relsEntry.async('string'),
    ])
    const relTargetById = new Map<string, string>()

    for (const match of relsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
      const id = this.getXmlAttribute(match[1], 'Id')
      const target = this.getXmlAttribute(match[1], 'Target')

      if (id && target) relTargetById.set(id, this.toXlsxPath(target))
    }

    const sheets: XlsxSheetInfo[] = []

    for (const match of workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g)) {
      const attrs = match[1]
      const name = this.decodeXmlText(this.getXmlAttribute(attrs, 'name') || `Sheet${sheets.length + 1}`)
      const relId = this.getXmlAttribute(attrs, 'r:id')
      const target = relId ? relTargetById.get(relId) : ''

      if (target) {
        sheets.push({ name, path: target })
      }
    }

    if (sheets.length === 0) {
      throw new BadRequestException('Excel 中没有可读取的工作表')
    }

    return sheets
  }

  private toXlsxPath(target: string) {
    const cleaned = target.replace(/^\/+/, '')
    if (cleaned.startsWith('xl/')) return cleaned
    return `xl/${cleaned.replace(/^\/+/, '')}`
  }

  private async readXlsxSharedStrings(zip: JSZip) {
    const entry = zip.file('xl/sharedStrings.xml')
    if (!entry) return [] as string[]

    const xml = await entry.async('string')
    return Array.from(xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)).map((match) => {
      const parts = Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))
      return parts.map((part) => this.decodeXmlText(part[1])).join('')
    })
  }

  private async readXlsxRows(zip: JSZip, sheetPath: string, sharedStrings: string[]) {
    const entry = zip.file(sheetPath)
    if (!entry) return [] as XlsxRow[]

    const xml = await entry.async('string')
    const rows: XlsxRow[] = []

    for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const rowNumber = Number(this.getXmlAttribute(rowMatch[1], 'r')) || rows.length + 1
      const cells: XlsxCellValue[] = []

      for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const cellRef = this.getXmlAttribute(cellMatch[1], 'r')
        const columnIndex = this.toXlsxColumnIndex(cellRef)

        if (columnIndex < 0) continue

        cells[columnIndex] = this.readXlsxCellValue(cellMatch[1], cellMatch[2] ?? '', sharedStrings)
      }

      rows.push({
        rowNumber,
        cells,
      })
    }

    return rows
  }

  private readXlsxCellValue(attrs: string, cellXml: string, sharedStrings: string[]): XlsxCellValue {
    const type = this.getXmlAttribute(attrs, 't')

    if (type === 'inlineStr') {
      return Array.from(cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))
        .map((match) => this.decodeXmlText(match[1]))
        .join('')
    }

    const valueMatch = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)
    if (!valueMatch) return null

    const rawValue = this.decodeXmlText(valueMatch[1])

    if (type === 's') {
      return sharedStrings[Number(rawValue)] ?? ''
    }

    if (type === 'b') {
      return rawValue === '1'
    }

    const numericValue = Number(rawValue)
    if (rawValue !== '' && Number.isFinite(numericValue)) {
      return numericValue
    }

    return rawValue
  }

  private findPublicationImportHeader(rows: XlsxRow[]): {
    headerRowIndex: number
    headerMap: Map<PublicationImportHeaderField, number>
    score: number
  } | null {
    let bestMatch: {
      headerRowIndex: number
      headerMap: Map<PublicationImportHeaderField, number>
      score: number
    } | null = null

    rows.slice(0, 20).forEach((row, index) => {
      const headerMap = this.toPublicationImportHeaderMap(row)
      const hasCoreFields = headerMap.has('publishedAt') && headerMap.has('product') && headerMap.has('title')
      const hasLinkField = headerMap.has('link') || headerMap.has('uuid')

      if (!hasCoreFields || !hasLinkField) return

      const score = headerMap.size

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          headerRowIndex: index,
          headerMap,
          score,
        }
      }
    })

    return bestMatch
  }

  private toPublicationImportHeaderMap(row: XlsxRow) {
    const headerMap = new Map<PublicationImportHeaderField, number>()
    const aliasEntries = Object.entries(PUBLICATION_IMPORT_HEADER_ALIASES) as Array<[
      PublicationImportHeaderField,
      readonly string[],
    ]>

    row.cells.forEach((cell, index) => {
      const header = this.normalizePublicationImportHeader(this.toPublicationImportText(cell))
      if (!header) return

      const matched = aliasEntries.find(([, aliases]) => {
        return aliases.some((alias) => this.normalizePublicationImportHeader(alias) === header)
      })

      if (matched && !headerMap.has(matched[0])) {
        headerMap.set(matched[0], index)
      }
    })

    const promptHeaderIndex = row.cells.findIndex((cell) => {
      const header = this.normalizePublicationImportHeader(this.toPublicationImportText(cell))
      return header === this.normalizePublicationImportHeader('提示词编号')
        || header === this.normalizePublicationImportHeader('提示词')
    })

    if (promptHeaderIndex >= 0) {
      headerMap.set('promptCode', promptHeaderIndex)
    }

    return headerMap
  }

  private toPublicationImportRows(
    rows: XlsxRow[],
    headerRowIndex: number,
    headerMap: Map<PublicationImportHeaderField, number>
  ) {
    const importedRows: PublicationImportRowDraft[] = []

    rows.slice(headerRowIndex + 1).forEach((row) => {
      if (row.cells.every((cell) => !this.toPublicationImportText(cell))) return

      const rawLink = this.readPublicationImportCell(row, headerMap, 'link')
      const rawUuid = this.readPublicationImportCell(row, headerMap, 'uuid')
      const platformSource = this.readPublicationImportCell(row, headerMap, 'platform')
      const link = this.toPublicationImportLink(rawLink, rawUuid)
      const promptCode = this.readPublicationImportCell(row, headerMap, 'promptCode')

      importedRows.push({
        rowNumber: row.rowNumber,
        publishedAt: this.toPublicationImportDate(this.readPublicationImportValue(row, headerMap, 'publishedAt')),
        product: this.readPublicationImportCell(row, headerMap, 'product'),
        title: this.readPublicationImportCell(row, headerMap, 'title'),
        platform: this.toPublicationImportPlatform(platformSource, link),
        accountType: this.toPublicationImportAccountType(this.readPublicationImportCell(row, headerMap, 'accountType'), platformSource),
        author: this.readPublicationImportCell(row, headerMap, 'author') || '未填写',
        promptCode: promptCode || PUBLICATION_IMPORT_DEFAULT_PROMPT_CODE,
        link,
      })
    })

    return importedRows
  }

  private readPublicationImportValue(
    row: XlsxRow,
    headerMap: Map<PublicationImportHeaderField, number>,
    field: PublicationImportHeaderField
  ) {
    const index = headerMap.get(field)
    return index === undefined ? null : row.cells[index] ?? null
  }

  private readPublicationImportCell(
    row: XlsxRow,
    headerMap: Map<PublicationImportHeaderField, number>,
    field: PublicationImportHeaderField
  ) {
    return this.toPublicationImportText(this.readPublicationImportValue(row, headerMap, field))
  }

  private toPublicationImportText(value: XlsxCellValue) {
    if (value === null || value === undefined) return ''
    if (typeof value === 'boolean') return value ? '1' : '0'
    if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value)
    return value.trim().replace(/\s+/g, ' ')
  }

  private toPublicationImportDate(value: XlsxCellValue) {
    if (typeof value === 'number' && value > 1) {
      const date = new Date(Math.round((value - 25569) * 86400 * 1000))
      if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10)
    }

    const text = this.toPublicationImportText(value)
    const dateMatch = text.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/)

    if (dateMatch) {
      return [
        dateMatch[1],
        dateMatch[2].padStart(2, '0'),
        dateMatch[3].padStart(2, '0'),
      ].join('-')
    }

    return text
  }

  private toPublicationImportLink(linkValue: string, uuidValue: string) {
    const markdownMatch = linkValue.match(/\((https?:\/\/[^)]+)\)/i)
    if (markdownMatch?.[1]) return markdownMatch[1].trim()

    const urlMatch = linkValue.match(/https?:\/\/\S+/i)
    if (urlMatch?.[0]) return urlMatch[0].replace(/[),，。；;]+$/, '')

    const uuid = uuidValue.trim()
    if (/^\d{8,}$/.test(uuid)) {
      return `https://baijiahao.baidu.com/s?id=${uuid}`
    }

    return linkValue.trim()
  }

  private toPublicationImportPlatform(value: string, link: string) {
    const text = value.trim()
    const source = `${text} ${link}`

    if (source.includes('百家号') || source.includes('baijiahao')) return '百家号'
    if (source.includes('值得买') || source.includes('smzdm')) return '什么值得买'
    if (source.includes('知乎') || source.includes('zhihu')) return '知乎'

    return text || '百家号'
  }

  private toPublicationImportAccountType(value: string, platformSource: string) {
    const text = value.trim()
    if (text) return text

    return /官网|官方/.test(platformSource) ? '官网' : '自媒体'
  }

  private normalizePublicationImportHeader(value: string) {
    return value.trim().replace(/\s+/g, '').replace(/[：:]/g, '').toLowerCase()
  }

  private toPublicationImportResultItem(
    row: PublicationImportRowDraft,
    status: PublicationImportResultItem['status'],
    reason: string
  ): PublicationImportResultItem {
    return {
      rowNumber: row.rowNumber,
      title: row.title,
      link: row.link,
      status,
      reason,
    }
  }

  private async buildPublicationImportPromptCodeMap() {
    const map = new Map<string, number>()
    const items = await this.prisma.geoPromptBatchJobItem.findMany({
      where: {
        status: GeoPromptBatchItemStatus.SUCCEEDED,
        sequence: {
          not: null,
        },
      },
      include: {
        job: true,
      },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
    })

    items.forEach((item) => {
      if (!item.job || item.sequence === null) return

      const fileName = this.buildPromptBatchTxtFileName(item.job, item.sequence)
      const promptCode = fileName.replace(/\.txt$/i, '')

      if (!map.has(promptCode)) map.set(promptCode, item.id)
      if (!map.has(fileName)) map.set(fileName, item.id)
    })

    return map
  }

  private async ensurePublicationImportOptions(rows: PublicationImportRowDraft[]) {
    const ensureList = async (type: PublicationOptionType, labels: string[]) => {
      for (const label of Array.from(new Set(labels.map((item) => item.trim()).filter(Boolean)))) {
        await this.ensurePublicationOption(type, label)
      }
    }

    await ensureList('PRODUCT', rows.map((row) => row.product))
    await ensureList('PLATFORM', rows.map((row) => row.platform))
    await ensureList('ACCOUNT_TYPE', rows.map((row) => row.accountType))
  }

  private async rematchPublicationCitationsByLinks(links: string[]) {
    const normalizedLinks = new Set(links.map((link) => this.normalizePublicationUrl(link)).filter(Boolean))
    const externalIds = new Set(links.map((link) => this.extractPublicationExternalId(link)).filter(Boolean))
    const citationOr: Prisma.GeoPublicationCrawlCitationWhereInput[] = []

    if (normalizedLinks.size > 0) {
      citationOr.push({
        normalizedUrl: {
          in: Array.from(normalizedLinks),
        },
      })
    }

    if (externalIds.size > 0) {
      citationOr.push({
        externalId: {
          in: Array.from(externalIds),
        },
      })
    }

    if (citationOr.length === 0) return 0

    const [records, citations] = await Promise.all([
      this.prisma.geoPublicationRecord.findMany({
        select: {
          id: true,
          link: true,
        },
      }),
      this.prisma.geoPublicationCrawlCitation.findMany({
        where: {
          isMatched: false,
          OR: citationOr,
        },
        include: {
          result: {
            select: {
              id: true,
              jobId: true,
            },
          },
        },
      }),
    ])
    const matchers = this.buildPublicationRecordMatchers(records)
      .filter((record) => normalizedLinks.has(record.normalizedUrl) || externalIds.has(record.externalId))
    const resultIds = new Set<number>()
    const jobIds = new Set<number>()
    let matchedCount = 0

    for (const citation of citations) {
      const matchedRecordId = this.matchPublicationRecord(matchers, citation.normalizedUrl, citation.externalId)
      if (!matchedRecordId) continue

      await this.prisma.geoPublicationCrawlCitation.update({
        where: { id: citation.id },
        data: {
          publicationRecordId: matchedRecordId,
          isMatched: true,
        },
      })
      resultIds.add(citation.resultId)
      jobIds.add(citation.result.jobId)
      matchedCount += 1
    }

    for (const resultId of resultIds) {
      const count = await this.prisma.geoPublicationCrawlCitation.count({
        where: {
          resultId,
          isMatched: true,
        },
      })

      await this.prisma.geoPublicationCrawlResult.update({
        where: { id: resultId },
        data: {
          matchedCitationCount: count,
        },
      })
    }

    for (const jobId of jobIds) {
      await this.refreshPublicationCrawlJobCounts(jobId)
    }

    return matchedCount
  }

  private getXmlAttribute(attrs: string, name: string) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = attrs.match(new RegExp(`${escapedName}="([^"]*)"`, 'i'))
    return match?.[1] ?? ''
  }

  private decodeXmlText(value: string) {
    return value
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
  }

  private toXlsxColumnIndex(cellRef: string) {
    const letters = cellRef.match(/^[A-Z]+/i)?.[0].toUpperCase()
    if (!letters) return -1

    return letters.split('').reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1
  }

  private buildPublicationRecordWhere(query: FindGeoPublicationRecordsQueryDto) {
    const where: Prisma.GeoPublicationRecordWhereInput = {}
    const startDate = query.startDate ? this.toBoundaryDate(query.startDate, false) : null
    const endDate = query.endDate ? this.toBoundaryDate(query.endDate, true) : null

    if (query.product) where.product = query.product
    if (query.platform) where.platform = query.platform
    if (query.accountType) where.accountType = query.accountType
    if (query.promptCode) where.promptCode = { contains: query.promptCode }
    if (query.keyword) {
      where.OR = [
        { title: { contains: query.keyword } },
        { author: { contains: query.keyword } },
        { link: { contains: query.keyword } },
      ]
    }
    if (startDate || endDate) {
      where.publishedAt = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      }
    }

    return where
  }

  private createEmptyPublicationStatsGroup(): PublicationStatsGroup {
    return {
      publicationCount: 0,
      recordIds: new Set<number>(),
      matchedRecordIds: new Set<number>(),
      resultIds: new Set<number>(),
      matchedCitationCount: 0,
    }
  }

  private ensurePublicationStatsGroup(map: Map<string, PublicationStatsGroup>, key: string) {
    const current = map.get(key)
    if (current) return current

    const group = this.createEmptyPublicationStatsGroup()
    map.set(key, group)
    return group
  }

  private createPublicationStatsGroup(
    records: PublicationStatsRecord[],
    recordMetrics: Map<number, { matchedCitationCount: number; resultIds: Set<number> }>
  ) {
    const group = this.createEmptyPublicationStatsGroup()
    records.forEach((record) => this.addRecordToPublicationStatsGroup(group, record, recordMetrics))
    return group
  }

  private addRecordToPublicationStatsGroup(
    group: PublicationStatsGroup,
    record: PublicationStatsRecord,
    recordMetrics: Map<number, { matchedCitationCount: number; resultIds: Set<number> }>
  ) {
    group.publicationCount += 1
    group.recordIds.add(record.id)

    const metric = recordMetrics.get(record.id)
    if (!metric) return

    if (metric.matchedCitationCount > 0) group.matchedRecordIds.add(record.id)
    group.matchedCitationCount += metric.matchedCitationCount
    metric.resultIds.forEach((resultId) => group.resultIds.add(resultId))
  }

  private toPublicationStatsMetric(
    group: PublicationStatsGroup,
    resultCitationCount: Map<number, number>
  ) {
    const matchedRecordCount = group.matchedRecordIds.size
    const citationCount = Array.from(group.resultIds)
      .reduce((sum, resultId) => sum + (resultCitationCount.get(resultId) ?? 0), 0)

    return {
      publicationCount: group.publicationCount,
      matchedRecordCount,
      matchedCitationCount: group.matchedCitationCount,
      citationCount,
      matchRate: this.toRate(matchedRecordCount, group.publicationCount),
    }
  }

  private toPublicationKeywordStats(
    crawlResults: PublicationCrawlResultWithCitations[],
    recordIdSet: Set<number>
  ) {
    const groups = new Map<string, {
      product: string
      keyword: string
      resultCount: number
      successCount: number
      noAiCount: number
      blockedCount: number
      failedCount: number
      citationCount: number
      matchedCitationCount: number
      matchedRecordIds: Set<number>
      latestCrawledAt: Date | null
    }>()

    crawlResults.forEach((result) => {
      const key = `${result.product}::${result.keyword}`
      const group = groups.get(key) ?? {
        product: result.product,
        keyword: result.keyword,
        resultCount: 0,
        successCount: 0,
        noAiCount: 0,
        blockedCount: 0,
        failedCount: 0,
        citationCount: 0,
        matchedCitationCount: 0,
        matchedRecordIds: new Set<number>(),
        latestCrawledAt: null,
      }

      group.resultCount += 1
      if (result.status === GeoPublicationCrawlResultStatus.SUCCEEDED) group.successCount += 1
      if (result.status === GeoPublicationCrawlResultStatus.NO_AI) group.noAiCount += 1
      if (result.status === GeoPublicationCrawlResultStatus.BLOCKED) group.blockedCount += 1
      if (result.status === GeoPublicationCrawlResultStatus.FAILED) group.failedCount += 1
      group.citationCount += result.citationCount
      result.citations.forEach((citation) => {
        if (!citation.publicationRecordId || !recordIdSet.has(citation.publicationRecordId)) return
        group.matchedCitationCount += 1
        group.matchedRecordIds.add(citation.publicationRecordId)
      })

      const latest = result.completedAt ?? result.updatedAt
      if (!group.latestCrawledAt || latest > group.latestCrawledAt) {
        group.latestCrawledAt = latest
      }
      groups.set(key, group)
    })

    return Array.from(groups.values())
      .map((group) => ({
        product: group.product,
        keyword: group.keyword,
        resultCount: group.resultCount,
        successCount: group.successCount,
        noAiCount: group.noAiCount,
        blockedCount: group.blockedCount,
        failedCount: group.failedCount,
        citationCount: group.citationCount,
        matchedRecordCount: group.matchedRecordIds.size,
        matchedCitationCount: group.matchedCitationCount,
        matchRate: this.toRate(group.matchedCitationCount, group.citationCount),
        latestCrawledAt: group.latestCrawledAt?.toISOString() ?? '',
      }))
      .sort((a, b) => b.matchedCitationCount - a.matchedCitationCount || b.citationCount - a.citationCount)
  }

  private toRate(numerator: number, denominator: number) {
    if (denominator <= 0) return 0
    return Math.round((numerator / denominator) * 1000) / 10
  }

  private toMondayStart(date: Date) {
    const monday = new Date(date)
    monday.setHours(0, 0, 0, 0)
    const day = monday.getDay()
    const diff = day === 0 ? 6 : day - 1
    monday.setDate(monday.getDate() - diff)
    return monday
  }

  private addPublicationDays(date: Date, days: number) {
    const next = new Date(date)
    next.setDate(next.getDate() + days)
    return next
  }

  private toProjectWeek(date: Date, projectWeekStart: Date) {
    const currentWeekStart = this.toMondayStart(date)
    const weekNo = Math.floor((currentWeekStart.getTime() - projectWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
    const startDate = this.addPublicationDays(projectWeekStart, (Math.max(weekNo, 1) - 1) * 7)
    const endDate = this.addPublicationDays(startDate, 6)

    return {
      weekNo: Math.max(weekNo, 1),
      weekLabel: `第${Math.max(weekNo, 1)}周`,
      startDate,
      endDate,
    }
  }

  private async toPublicationRecordData(
    payload: PublicationRecordDataPayload,
    requireAllFields: boolean
  ): Promise<Prisma.GeoPublicationRecordUncheckedCreateInput | Prisma.GeoPublicationRecordUncheckedUpdateInput> {
    const data: Prisma.GeoPublicationRecordUncheckedCreateInput | Prisma.GeoPublicationRecordUncheckedUpdateInput = {}

    if (payload.publishedAt !== undefined) {
      data.publishedAt = this.toPublicationDate(payload.publishedAt)
    } else if (requireAllFields) {
      throw new BadRequestException('请选择发文日期')
    }

    if (payload.product !== undefined) {
      data.product = this.requireShortText(payload.product, '请选择产品')
    } else if (requireAllFields) {
      throw new BadRequestException('请选择产品')
    }

    if (payload.title !== undefined) {
      data.title = this.requireShortText(payload.title, '请填写标题')
    } else if (requireAllFields) {
      throw new BadRequestException('请填写标题')
    }

    if (payload.platform !== undefined) {
      data.platform = this.requireShortText(payload.platform, '请选择平台')
    } else if (requireAllFields) {
      throw new BadRequestException('请选择平台')
    }

    if (payload.accountType !== undefined) {
      data.accountType = this.requireShortText(payload.accountType, '请选择或输入账号类型')
    } else if (requireAllFields) {
      throw new BadRequestException('请选择账号类型')
    }

    if (payload.author !== undefined) {
      data.author = this.requireShortText(payload.author, '请填写作者')
    } else if (requireAllFields) {
      throw new BadRequestException('请填写作者')
    }

    if (payload.promptCode !== undefined) {
      data.promptCode = this.requireShortText(payload.promptCode, '请填写提示词编号')
    } else if (requireAllFields) {
      throw new BadRequestException('请填写提示词编号')
    }

    if (payload.link !== undefined) {
      data.link = this.requireShortText(payload.link, '请填写链接', 2048)
    } else if (requireAllFields) {
      throw new BadRequestException('请填写链接')
    }

    if ('promptBatchJobItemId' in payload) {
      const promptBatchJobItemId = (payload as { promptBatchJobItemId?: number | null }).promptBatchJobItemId

      if (promptBatchJobItemId === null || promptBatchJobItemId === undefined) {
        data.promptBatchJobItemId = null
      } else {
        const item = await this.prisma.geoPromptBatchJobItem.findUnique({
          where: { id: promptBatchJobItemId },
        })

        if (!item || item.status !== GeoPromptBatchItemStatus.SUCCEEDED) {
          throw new BadRequestException('关联的提示词编号不存在或尚未生成成功')
        }

        data.promptBatchJobItemId = promptBatchJobItemId
      }
    }

    return data
  }

  private async buildPublicationRecordCrawlStats(recordIds: number[]) {
    const stats = new Map<number, {
      citationCount: number
      keywordSet: Set<string>
      latestMatchedAt: Date | null
    }>()

    if (recordIds.length === 0) return stats

    const citations = await this.prisma.geoPublicationCrawlCitation.findMany({
      where: {
        publicationRecordId: {
          in: recordIds,
        },
        isMatched: true,
      },
      include: {
        result: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })

    citations.forEach((citation) => {
      if (!citation.publicationRecordId) return

      const current = stats.get(citation.publicationRecordId) ?? {
        citationCount: 0,
        keywordSet: new Set<string>(),
        latestMatchedAt: null,
      }

      current.citationCount += 1
      if (citation.result.keyword) current.keywordSet.add(citation.result.keyword)
      if (!current.latestMatchedAt || citation.createdAt > current.latestMatchedAt) {
        current.latestMatchedAt = citation.createdAt
      }
      stats.set(citation.publicationRecordId, current)
    })

    return stats
  }

  private toPublicationRecordView(
    record: PublicationRecordViewSource,
    crawlStats?: { citationCount: number; keywordSet: Set<string>; latestMatchedAt: Date | null }
  ) {
    const item = record.promptBatchJobItem
    const promptFileName = item?.job && item.sequence !== null
      ? this.buildPromptBatchTxtFileName(item.job, item.sequence)
      : ''
    const citationCount = crawlStats?.citationCount ?? 0
    const keywordCount = crawlStats?.keywordSet.size ?? 0

    return {
      id: record.id,
      publishedAt: this.toShanghaiDateString(record.publishedAt),
      product: record.product,
      title: record.title,
      platform: record.platform,
      accountType: record.accountType,
      author: record.author,
      promptCode: record.promptCode,
      link: record.link,
      promptBatchJobItemId: record.promptBatchJobItemId,
      promptFileName,
      promptBatchJobId: item?.jobId ?? null,
      promptProductProfile: item?.job.profileName ?? '',
      promptVersionName: item
        ? item.job.engineType === GeoPromptBatchEngineType.LEGACY ? '旧版' : item.job.versionName
        : '',
      baiduAiMatched: citationCount > 0,
      baiduAiCitationCount: citationCount,
      baiduAiMatchedKeywordCount: keywordCount,
      baiduAiLatestMatchedAt: crawlStats?.latestMatchedAt?.toISOString() ?? '',
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }
  }

  private async ensurePublicationDefaultOptions() {
    const data = [
      ...DEFAULT_PUBLICATION_PRODUCTS.map((label, index) => ({
        type: 'PRODUCT',
        label,
        sortOrder: index,
      })),
      ...DEFAULT_PUBLICATION_PLATFORMS.map((label, index) => ({
        type: 'PLATFORM',
        label,
        sortOrder: index,
      })),
      ...DEFAULT_PUBLICATION_ACCOUNT_TYPES.map((label, index) => ({
        type: 'ACCOUNT_TYPE',
        label,
        sortOrder: index,
      })),
    ]

    await this.prisma.geoPublicationOption.createMany({
      data,
      skipDuplicates: true,
    })
  }

  private async ensurePublicationOption(type: PublicationOptionType, label: string) {
    const normalizedLabel = this.requireShortText(label, '选项名称不能为空')
    const normalizedType = this.resolvePublicationOptionType(type)
    const existing = await this.prisma.geoPublicationOption.findUnique({
      where: {
        type_label: {
          type: normalizedType,
          label: normalizedLabel,
        },
      },
    })

    if (existing) return existing

    const count = await this.prisma.geoPublicationOption.count({
      where: {
        type: normalizedType,
      },
    })

    try {
      return await this.prisma.geoPublicationOption.create({
        data: {
          type: normalizedType,
          label: normalizedLabel,
          sortOrder: count,
        },
      })
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        const option = await this.prisma.geoPublicationOption.findUnique({
          where: {
            type_label: {
              type: normalizedType,
              label: normalizedLabel,
            },
          },
        })

        if (option) return option
      }

      throw error
    }
  }

  private resolvePublicationOptionType(type: string) {
    if (!PUBLICATION_OPTION_TYPES.includes(type as PublicationOptionType)) {
      throw new BadRequestException('发文选项类型不支持')
    }

    return type as PublicationOptionType
  }

  private toPublicationDate(value: string) {
    const date = this.toBoundaryDate(value, false)

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('发文日期格式不正确')
    }

    return date
  }

  private toShanghaiDateString(date: Date) {
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)
    const read = (type: string) => parts.find((part) => part.type === type)?.value ?? ''

    return `${read('year')}-${read('month')}-${read('day')}`
  }

  private requireShortText(value: string, message: string, maxLength = MAX_SHORT_TEXT_LENGTH) {
    const text = this.toShortText(value, maxLength)

    if (!text) {
      throw new BadRequestException(message)
    }

    return text
  }

  private async ensurePublicationCrawlSetting() {
    return this.prisma.geoPublicationCrawlSetting.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
      },
    })
  }

  private async ensurePublicationCrawlDefaultKeywords() {
    await this.prisma.geoPublicationCrawlKeyword.createMany({
      data: DEFAULT_PUBLICATION_CRAWL_KEYWORDS.map((item, index) => ({
        ...item,
        sortOrder: index,
      })),
      skipDuplicates: true,
    })
  }

  private toPublicationCrawlSettingView(setting: {
    isEnabled: boolean
    dailyRunTime: string
    lookbackDays: number
    maxKeywordsPerRun: number
    requestIntervalMinSec: number
    requestIntervalMaxSec: number
    createdAt: Date
    updatedAt: Date
  }) {
    return {
      isEnabled: setting.isEnabled,
      dailyRunTime: setting.dailyRunTime,
      lookbackDays: setting.lookbackDays,
      maxKeywordsPerRun: setting.maxKeywordsPerRun,
      requestIntervalMinSec: setting.requestIntervalMinSec,
      requestIntervalMaxSec: setting.requestIntervalMaxSec,
      createdAt: setting.createdAt.toISOString(),
      updatedAt: setting.updatedAt.toISOString(),
    }
  }

  private toPublicationCrawlKeywordView(keyword: {
    id: number
    product: string
    keyword: string
    isActive: boolean
    sortOrder: number
    createdAt: Date
    updatedAt: Date
  }) {
    return {
      id: keyword.id,
      product: keyword.product,
      keyword: keyword.keyword,
      isActive: keyword.isActive,
      sortOrder: keyword.sortOrder,
      createdAt: keyword.createdAt.toISOString(),
      updatedAt: keyword.updatedAt.toISOString(),
    }
  }

  private toPublicationCrawlJobView(job: PublicationCrawlJobViewSource) {
    return {
      id: job.id,
      triggerType: job.triggerType,
      scheduleDate: job.scheduleDate,
      product: job.product,
      status: job.status,
      keywordCount: job.keywordCount,
      successCount: job.successCount,
      noAiCount: job.noAiCount,
      blockedCount: job.blockedCount,
      failedCount: job.failedCount,
      runningCount: job.runningCount,
      queuedCount: job.queuedCount,
      matchedCitationCount: job.matchedCitationCount,
      lastError: job.lastError,
      startedAt: job.startedAt?.toISOString() ?? '',
      completedAt: job.completedAt?.toISOString() ?? '',
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      results: job.results.map((result) => ({
        id: result.id,
        jobId: result.jobId,
        product: result.product,
        keyword: result.keyword,
        status: result.status,
        aiTitle: result.aiTitle,
        contentSummary: result.contentSummary,
        citationCount: result.citationCount,
        matchedCitationCount: result.matchedCitationCount,
        blockedDetected: result.blockedDetected,
        errorMessage: result.errorMessage,
        startedAt: result.startedAt?.toISOString() ?? '',
        completedAt: result.completedAt?.toISOString() ?? '',
        citations: result.citations.map((citation) => ({
          id: citation.id,
          url: citation.url,
          title: citation.title,
          sourceName: citation.sourceName,
          authorName: citation.authorName,
          brand: citation.brand,
          publishTime: citation.publishTime,
          isMatched: citation.isMatched,
          publicationRecordId: citation.publicationRecordId,
          externalId: citation.externalId,
        })),
      })),
    }
  }

  private async recoverPublicationCrawlJobs() {
    try {
      await this.prisma.geoPublicationCrawlResult.updateMany({
        where: { status: GeoPublicationCrawlResultStatus.RUNNING },
        data: {
          status: GeoPublicationCrawlResultStatus.QUEUED,
          startedAt: null,
        },
      })

      await this.prisma.geoPublicationCrawlJob.updateMany({
        where: { status: GeoPublicationCrawlJobStatus.RUNNING },
        data: {
          status: GeoPublicationCrawlJobStatus.QUEUED,
          runningCount: 0,
        },
      })
    } catch (error) {
      console.error('[PublicationCrawl] Failed to recover unfinished jobs', error)
    }
  }

  private startPublicationCrawlWorker() {
    if (this.publicationCrawlWorkerStarted) return

    this.publicationCrawlWorkerStarted = true
    this.publicationCrawlWorkerTimer = setInterval(() => {
      void this.processPublicationCrawlQueue()
    }, PUBLICATION_CRAWL_WORKER_POLL_MS)
    this.publicationCrawlWorkerTimer.unref?.()
    this.publicationCrawlSchedulerTimer = setInterval(() => {
      void this.processPublicationCrawlSchedule()
    }, PUBLICATION_CRAWL_SCHEDULER_POLL_MS)
    this.publicationCrawlSchedulerTimer.unref?.()
    this.kickPublicationCrawlWorker()
    void this.processPublicationCrawlSchedule()
  }

  private kickPublicationCrawlWorker() {
    setTimeout(() => {
      void this.processPublicationCrawlQueue()
    }, 0).unref?.()
  }

  private async processPublicationCrawlSchedule() {
    if (this.publicationCrawlSchedulerTickRunning) return

    this.publicationCrawlSchedulerTickRunning = true

    try {
      const setting = await this.ensurePublicationCrawlSetting()
      if (!setting.isEnabled) return

      const today = this.toShanghaiDateString(new Date())
      const currentTime = this.toShanghaiTimeString(new Date())
      if (currentTime < setting.dailyRunTime) return

      const existing = await this.prisma.geoPublicationCrawlJob.findFirst({
        where: {
          triggerType: 'AUTO',
          scheduleDate: today,
        },
      })

      if (existing) return

      await this.createPublicationCrawlJob({}, 'AUTO', today)
    } catch (error) {
      console.error('[PublicationCrawl] Failed to create scheduled job', error)
    } finally {
      this.publicationCrawlSchedulerTickRunning = false
    }
  }

  private async processPublicationCrawlQueue() {
    if (this.publicationCrawlWorkerTickRunning) return

    this.publicationCrawlWorkerTickRunning = true

    try {
      while (this.activePublicationCrawlResults < PUBLICATION_CRAWL_WORKER_CONCURRENCY) {
        const resultId = await this.claimPublicationCrawlResult()
        if (!resultId) break

        this.activePublicationCrawlResults += 1

        void this.runPublicationCrawlResult(resultId)
          .catch((error) => {
            console.error('[PublicationCrawl] Worker result failed unexpectedly', error)
          })
          .finally(() => {
            this.activePublicationCrawlResults = Math.max(this.activePublicationCrawlResults - 1, 0)
            this.kickPublicationCrawlWorker()
          })
      }
    } finally {
      this.publicationCrawlWorkerTickRunning = false
    }
  }

  private async claimPublicationCrawlResult() {
    const nextResult = await this.prisma.geoPublicationCrawlResult.findFirst({
      where: {
        status: GeoPublicationCrawlResultStatus.QUEUED,
        job: {
          status: {
            in: [GeoPublicationCrawlJobStatus.QUEUED, GeoPublicationCrawlJobStatus.RUNNING],
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })

    if (!nextResult) return null

    const claimed = await this.prisma.geoPublicationCrawlResult.updateMany({
      where: {
        id: nextResult.id,
        status: GeoPublicationCrawlResultStatus.QUEUED,
      },
      data: {
        status: GeoPublicationCrawlResultStatus.RUNNING,
        startedAt: new Date(),
        errorMessage: '',
      },
    })

    if (claimed.count === 0) return null

    await this.prisma.geoPublicationCrawlJob.update({
      where: { id: nextResult.jobId },
      data: {
        status: GeoPublicationCrawlJobStatus.RUNNING,
        startedAt: new Date(),
      },
    })
    await this.refreshPublicationCrawlJobCounts(nextResult.jobId)

    return nextResult.id
  }

  private async runPublicationCrawlResult(resultId: number) {
    const result = await this.prisma.geoPublicationCrawlResult.findUnique({
      where: { id: resultId },
      include: {
        job: true,
      },
    })

    if (!result) return

    try {
      const publicationRecords = await this.findPublicationRecordsForCrawl(result.product, result.job)
      const scraperResult = await this.runPublicationCrawlScraper(result.keyword, publicationRecords)
      await this.savePublicationCrawlResult(result.id, scraperResult, publicationRecords)
      const setting = await this.ensurePublicationCrawlSetting()
      await this.delayPublicationCrawlRequest(setting.requestIntervalMinSec, setting.requestIntervalMaxSec)
    } catch (error) {
      await this.prisma.geoPublicationCrawlResult.update({
        where: { id: result.id },
        data: {
          status: GeoPublicationCrawlResultStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : '抓取失败',
          completedAt: new Date(),
        },
      })
    }

    await this.finalizePublicationCrawlJobIfDone(result.jobId)
  }

  private async findPublicationRecordsForCrawl(product: string, job: { createdAt: Date }) {
    const setting = await this.ensurePublicationCrawlSetting()
    const minDate = new Date(job.createdAt.getTime() - setting.lookbackDays * 24 * 60 * 60 * 1000)

    return this.prisma.geoPublicationRecord.findMany({
      where: {
        product,
        publishedAt: {
          gte: minDate,
        },
      },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: 1000,
    })
  }

  private async runPublicationCrawlScraper(
    keyword: string,
    records: Array<{ id: number; link: string; title: string; product: string }>
  ): Promise<PublicationCrawlScraperResult> {
    const scriptPath = process.env.BAIDU_AI_SCRAPER_PATH?.trim()
      || join(process.cwd(), 'src/modules/geo/scripts/baidu-ai-scraper.py')
    const pythonBin = process.env.PYTHON_BIN?.trim() || 'python3'
    const payload = JSON.stringify({
      keyword,
      records: records.map((record) => ({
        id: record.id,
        url: record.link,
        title: record.title,
        product: record.product,
      })),
    })

    return new Promise((resolve, reject) => {
      const child = spawn(pythonBin, [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      let stdout = ''
      let stderr = ''
      const timeout = setTimeout(() => {
        child.kill('SIGTERM')
        reject(new Error('百度 AI 抓取超时'))
      }, PUBLICATION_CRAWL_REQUEST_TIMEOUT_MS)

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString()
      })
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })
      child.on('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
      child.on('close', (code) => {
        clearTimeout(timeout)
        if (code !== 0) {
          reject(new Error(stderr.trim() || `百度 AI 抓取脚本退出码 ${code}`))
          return
        }

        try {
          resolve(JSON.parse(stdout) as PublicationCrawlScraperResult)
        } catch {
          reject(new Error(`百度 AI 抓取脚本返回非 JSON：${stdout.slice(0, 300)}`))
        }
      })
      child.stdin.write(payload)
      child.stdin.end()
    })
  }

  private async savePublicationCrawlResult(
    resultId: number,
    scraperResult: PublicationCrawlScraperResult,
    records: Array<{ id: number; link: string }>
  ) {
    const status = this.toPublicationCrawlResultStatus(scraperResult)
    const citations = Array.isArray(scraperResult.citations) ? scraperResult.citations : []
    const recordMatchers = this.buildPublicationRecordMatchers(records)
    const citationData = citations.map((citation) => {
      const url = this.requireCrawlUrl(citation.url ?? '')
      const normalizedUrl = this.normalizePublicationUrl(url)
      const externalId = this.extractPublicationExternalId(url)
      const matchedRecordId = this.matchPublicationRecord(recordMatchers, normalizedUrl, externalId)

      return {
        url,
        normalizedUrl,
        externalId,
        title: this.toShortText(citation.title ?? '', MAX_SHORT_TEXT_LENGTH),
        sourceName: this.toShortText(citation.sourceName ?? '', MAX_SHORT_TEXT_LENGTH),
        authorName: this.toShortText(citation.authorName ?? '', MAX_SHORT_TEXT_LENGTH),
        brand: this.toShortText(citation.brand ?? '', MAX_SHORT_TEXT_LENGTH),
        publishTime: this.toShortText(citation.publishTime ?? '', MAX_SHORT_TEXT_LENGTH),
        publicationRecordId: matchedRecordId,
        isMatched: Boolean(matchedRecordId),
      }
    })
    const matchedCitationCount = citationData.filter((citation) => citation.isMatched).length

    await this.prisma.$transaction(async (tx) => {
      await tx.geoPublicationCrawlCitation.deleteMany({
        where: { resultId },
      })

      await tx.geoPublicationCrawlResult.update({
        where: { id: resultId },
        data: {
          status,
          aiTitle: this.toShortText(scraperResult.aiTitle ?? '', MAX_SHORT_TEXT_LENGTH),
          contentSummary: this.toLongText(scraperResult.contentSummary || scraperResult.content || '', 1200),
          rawContent: this.toLongText(scraperResult.content ?? '', 200_000),
          citationCount: citationData.length,
          matchedCitationCount,
          blockedDetected: Boolean(scraperResult.blockedDetected) || status === GeoPublicationCrawlResultStatus.BLOCKED,
          errorMessage: scraperResult.errorMessage ?? '',
          completedAt: new Date(),
          citations: citationData.length > 0
            ? {
                create: citationData,
              }
            : undefined,
        },
      })
    })
  }

  private toPublicationCrawlResultStatus(scraperResult: PublicationCrawlScraperResult) {
    const status = String(scraperResult.status ?? '').toUpperCase()

    if (status === 'BLOCKED' || scraperResult.blockedDetected) return GeoPublicationCrawlResultStatus.BLOCKED
    if (status === 'NO_AI') return GeoPublicationCrawlResultStatus.NO_AI
    if (status === 'FAILED') return GeoPublicationCrawlResultStatus.FAILED
    return GeoPublicationCrawlResultStatus.SUCCEEDED
  }

  private buildPublicationRecordMatchers(records: Array<{ id: number; link: string }>) {
    return records.map((record) => ({
      id: record.id,
      normalizedUrl: this.normalizePublicationUrl(record.link),
      externalId: this.extractPublicationExternalId(record.link),
    }))
  }

  private matchPublicationRecord(
    records: Array<{ id: number; normalizedUrl: string; externalId: string }>,
    normalizedUrl: string,
    externalId: string
  ) {
    const exact = records.find((record) => record.normalizedUrl && record.normalizedUrl === normalizedUrl)
    if (exact) return exact.id

    if (!externalId) return null

    const byExternalId = records.find((record) => record.externalId && record.externalId === externalId)
    return byExternalId?.id ?? null
  }

  private normalizePublicationUrl(url: string) {
    const text = String(url ?? '').trim()
    if (!text) return ''

    try {
      const parsed = new URL(text)
      parsed.hash = ''
      ;['from', 'wfr', 'for', 'spm', 'utm_source', 'utm_medium', 'utm_campaign'].forEach((key) => {
        parsed.searchParams.delete(key)
      })
      return parsed.toString().replace(/\/$/, '')
    } catch {
      return text.replace(/#.*$/, '').replace(/\/$/, '')
    }
  }

  private extractPublicationExternalId(url: string) {
    const text = String(url ?? '')
    const baijiahaoId = text.match(/[?&]id=(\d+)/)
    if (baijiahaoId?.[1]) return baijiahaoId[1]

    const smzdmId = text.match(/\/p\/([^/?#]+)/)
    if (smzdmId?.[1]) return smzdmId[1]

    const sohuId = text.match(/\/a\/(\d+)_/)
    if (sohuId?.[1]) return sohuId[1]

    const zhihuId = text.match(/\/(?:question|p)\/(\d+)/)
    if (zhihuId?.[1]) return zhihuId[1]

    return ''
  }

  private requireCrawlUrl(url: string) {
    return this.toLongText(url, 2048)
  }

  private async refreshPublicationCrawlJobCounts(jobId: number) {
    const grouped = await this.prisma.geoPublicationCrawlResult.groupBy({
      by: ['status'],
      where: { jobId },
      _count: { _all: true },
    })
    const countByStatus = new Map(grouped.map((item) => [item.status, item._count._all]))
    const queuedCount = countByStatus.get(GeoPublicationCrawlResultStatus.QUEUED) ?? 0
    const runningCount = countByStatus.get(GeoPublicationCrawlResultStatus.RUNNING) ?? 0
    const successCount = countByStatus.get(GeoPublicationCrawlResultStatus.SUCCEEDED) ?? 0
    const noAiCount = countByStatus.get(GeoPublicationCrawlResultStatus.NO_AI) ?? 0
    const blockedCount = countByStatus.get(GeoPublicationCrawlResultStatus.BLOCKED) ?? 0
    const failedCount = countByStatus.get(GeoPublicationCrawlResultStatus.FAILED) ?? 0
    const matched = await this.prisma.geoPublicationCrawlResult.aggregate({
      where: { jobId },
      _sum: {
        matchedCitationCount: true,
      },
    })
    const latestFailure = failedCount + blockedCount > 0
      ? await this.prisma.geoPublicationCrawlResult.findFirst({
          where: {
            jobId,
            status: {
              in: [GeoPublicationCrawlResultStatus.FAILED, GeoPublicationCrawlResultStatus.BLOCKED],
            },
          },
          orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        })
      : null

    await this.prisma.geoPublicationCrawlJob.update({
      where: { id: jobId },
      data: {
        status: runningCount > 0 ? GeoPublicationCrawlJobStatus.RUNNING : GeoPublicationCrawlJobStatus.QUEUED,
        queuedCount,
        runningCount,
        successCount,
        noAiCount,
        blockedCount,
        failedCount,
        matchedCitationCount: matched._sum.matchedCitationCount ?? 0,
        lastError: latestFailure?.errorMessage ?? '',
      },
    })
  }

  private async finalizePublicationCrawlJobIfDone(jobId: number) {
    const job = await this.prisma.geoPublicationCrawlJob.findUnique({
      where: { id: jobId },
      include: {
        results: true,
      },
    })

    if (!job || job.completedAt) return

    const queuedCount = job.results.filter((result) => result.status === GeoPublicationCrawlResultStatus.QUEUED).length
    const runningCount = job.results.filter((result) => result.status === GeoPublicationCrawlResultStatus.RUNNING).length
    const successCount = job.results.filter((result) => result.status === GeoPublicationCrawlResultStatus.SUCCEEDED).length
    const noAiCount = job.results.filter((result) => result.status === GeoPublicationCrawlResultStatus.NO_AI).length
    const blockedCount = job.results.filter((result) => result.status === GeoPublicationCrawlResultStatus.BLOCKED).length
    const failedCount = job.results.filter((result) => result.status === GeoPublicationCrawlResultStatus.FAILED).length
    const matchedCitationCount = job.results.reduce((sum, result) => sum + result.matchedCitationCount, 0)
    const latestFailure = [...job.results]
      .reverse()
      .find((result) => result.status === GeoPublicationCrawlResultStatus.FAILED || result.status === GeoPublicationCrawlResultStatus.BLOCKED)

    if (queuedCount + runningCount > 0) {
      await this.refreshPublicationCrawlJobCounts(jobId)
      return
    }

    await this.prisma.geoPublicationCrawlJob.update({
      where: { id: jobId },
      data: {
        status: failedCount + blockedCount > 0
          ? successCount + noAiCount > 0
            ? GeoPublicationCrawlJobStatus.PARTIAL_FAILED
            : GeoPublicationCrawlJobStatus.FAILED
          : GeoPublicationCrawlJobStatus.COMPLETED,
        queuedCount,
        runningCount,
        successCount,
        noAiCount,
        blockedCount,
        failedCount,
        matchedCitationCount,
        lastError: latestFailure?.errorMessage ?? '',
        completedAt: new Date(),
      },
    })
  }

  private delayPublicationCrawlRequest(minSec: number, maxSec: number) {
    const min = Math.max(minSec, 0)
    const max = Math.max(maxSec, min)
    const duration = (min + Math.random() * (max - min)) * 1000

    return new Promise((resolve) => setTimeout(resolve, duration))
  }

  private toShanghaiTimeString(date: Date) {
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(date)
    const read = (type: string) => parts.find((part) => part.type === type)?.value ?? ''

    return `${read('hour')}:${read('minute')}`
  }

  private toPromptBatchJobView(job: PromptBatchJobViewSource) {
    const items = Array.isArray(job.items)
      ? job.items.map((item) => this.toPromptBatchJobItemView(item, job))
      : undefined
    const finishedCount = job.successCount + job.failedCount
    const progress = job.requestedCount > 0
      ? Math.round((finishedCount / job.requestedCount) * 100)
      : 0

    return {
      id: job.id,
      engineType: job.engineType,
      profileId: job.profileId,
      profileName: job.profileName,
      versionId: job.versionId,
      versionName: job.versionName,
      articleUrl: job.articleUrl,
      requestedCount: job.requestedCount,
      successCount: job.successCount,
      failedCount: job.failedCount,
      queuedCount: job.queuedCount,
      runningCount: job.runningCount,
      progress,
      status: job.status,
      lastError: job.lastError,
      sequenceStart: job.sequenceStart,
      sequenceEnd: job.sequenceEnd,
      zipFileName: job.sequenceStart !== null && job.sequenceEnd !== null
        ? this.buildPromptBatchZipFileName(job, job.sequenceStart, job.sequenceEnd)
        : job.zipFileName,
      canDownload: job.successCount > 0 && Boolean(job.completedAt),
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
      ...(items ? { items } : {}),
    }
  }

  private toPromptBatchJobItemView(item: GeoPromptBatchJobItem, job?: Pick<GeoPromptBatchJob, 'dateCode' | 'engineType' | 'profileName' | 'versionName'>) {
    return {
      id: item.id,
      jobId: item.jobId,
      itemIndex: item.itemIndex,
      status: item.status,
      sequence: item.sequence,
      fileName: job && item.sequence !== null ? this.buildPromptBatchTxtFileName(job, item.sequence) : item.fileName,
      promptText: item.promptText,
      rawOutput: item.rawOutput,
      errorMessage: item.errorMessage,
      startedAt: item.startedAt?.toISOString() ?? null,
      completedAt: item.completedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }
  }

  private buildPromptBatchTxtFileName(
    job: Pick<GeoPromptBatchJob, 'dateCode' | 'engineType' | 'profileName' | 'versionName'>,
    sequence: number
  ) {
    return `${job.dateCode}_${this.toPromptBatchVersionFileSegment(job)}_${this.toSafeFileSegment(job.profileName)}_${sequence}.txt`
  }

  private buildPromptBatchZipFileName(
    job: Pick<GeoPromptBatchJob, 'dateCode' | 'engineType' | 'profileName' | 'versionName'>,
    sequenceStart: number,
    sequenceEnd: number
  ) {
    return `${job.dateCode}_${this.toPromptBatchVersionFileSegment(job)}_${this.toSafeFileSegment(job.profileName)}_${sequenceStart}-${sequenceEnd}.zip`
  }

  private toPromptBatchVersionFileSegment(job: Pick<GeoPromptBatchJob, 'engineType' | 'versionName'>) {
    if (job.engineType === GeoPromptBatchEngineType.LEGACY) return '旧版'

    return this.toSafeFileSegment(job.versionName || '新版')
  }

  private toSafeFileSegment(value: string) {
    return value
      .trim()
      .replace(/[\\/:*?"<>|\r\n]+/g, '_')
      .replace(/\s+/g, ' ')
      .slice(0, 80) || '产品档案'
  }

  private toShanghaiDateCode(date: Date) {
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)
    const read = (type: string) => parts.find((part) => part.type === type)?.value ?? ''

    return `${read('year')}${read('month')}${read('day')}`
  }

  private createAnthropicClient(config: GeoProviderConfig) {
    return new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined,
      timeout: DEFAULT_INSIGHT_TIMEOUT_MS,
      maxRetries: DEFAULT_INSIGHT_MAX_RETRIES,
    })
  }

  private async buildProjectInsightPromptPreview(
    project: GeoSerpResearchProject,
    analyzedResults: GeoSerpResearchResult[],
    requestedModel: string
  ) {
    const inputCollection = await this.buildInsightResultInputCollection(
      analyzedResults,
      Math.max(MAX_PROJECT_INSIGHT_RESULTS, RETRY_PROJECT_INSIGHT_RESULTS)
    )
    const resultInputs = inputCollection.inputs.slice(0, MAX_PROJECT_INSIGHT_RESULTS)
    const retryInputs = inputCollection.inputs.slice(0, RETRY_PROJECT_INSIGHT_RESULTS)
    const systemPrompt = buildProjectAiSummarySystemPrompt()
    const userPrompt = buildProjectAiSummaryUserMessage({
      category: project.category,
      keyword: project.keyword,
      engine: project.engine,
      analyzedCount: analyzedResults.length,
      results: resultInputs,
    })
    const retryUserPrompt = buildProjectAiSummaryRetryUserMessage({
      category: project.category,
      keyword: project.keyword,
      engine: project.engine,
      analyzedCount: analyzedResults.length,
      results: retryInputs,
    })

    return {
      requestedModel,
      fallbackModel: INSIGHT_FORMATTER_FALLBACK_MODEL,
      analyzedCount: analyzedResults.length,
      primaryIncludedCount: resultInputs.length,
      retryIncludedCount: retryInputs.length,
      fullTextIncludedCount: inputCollection.fullTextIncludedCount,
      excerptFallbackCount: inputCollection.excerptFallbackCount,
      systemPrompt,
      userPrompt,
      retryUserPrompt,
    }
  }

  private async buildInsightResultInputCollection(
    analyzedResults: GeoSerpResearchResult[],
    maxResults: number
  ) {
    const selectedResults = analyzedResults.slice(0, maxResults)
    const resolvedInputs = await this.mapWithConcurrency(
      selectedResults,
      PROJECT_INSIGHT_FETCH_CONCURRENCY,
      async (item) => {
        const articleTextResult = await this.resolveInsightArticleText(item)

        return {
          source: articleTextResult.source,
          input: {
            rank: item.rank,
            title: item.title,
            snippet: item.snippet,
            fetchStatus: item.fetchStatus,
            fetchMessage: item.fetchMessage,
            contentLength: item.contentLength,
            paragraphCount: item.paragraphCount,
            titleLength: item.titleLength,
            patternTags: this.toStringArray(item.patternTags),
            headingOutline: this.toStringArray(item.headingOutline),
            analysisSummary: this.toJsonObject(item.analysisSummary) as GeoInsightResultInput['analysisSummary'],
            articleText: articleTextResult.text,
          } satisfies GeoInsightResultInput,
        }
      }
    )

    return {
      inputs: resolvedInputs.map((item) => item.input),
      fullTextIncludedCount: resolvedInputs.filter((item) => item.source === 'full_text').length,
      excerptFallbackCount: resolvedInputs.filter((item) => item.source === 'excerpt_fallback').length,
    }
  }

  private async resolveInsightArticleText(item: GeoSerpResearchResult) {
    const targetUrl = (item.finalUrl || item.searchUrl || '').trim()
    const fallbackText = this.buildInsightFallbackArticleText(item)

    if (!targetUrl) {
      return {
        text: fallbackText,
        source: 'excerpt_fallback' as const,
      }
    }

    try {
      const detail = await fetchArticleDetail(targetUrl)
      const normalizedText = this.normalizeInsightArticleText(detail.text)

      if (!normalizedText) {
        return {
          text: fallbackText,
          source: 'excerpt_fallback' as const,
        }
      }

      return {
        text: normalizedText,
        source: 'full_text' as const,
      }
    } catch {
      return {
        text: fallbackText,
        source: 'excerpt_fallback' as const,
      }
    }
  }

  private buildInsightFallbackArticleText(item: GeoSerpResearchResult) {
    const analysisSummary = this.toJsonObject(item.analysisSummary) as GeoInsightResultInput['analysisSummary']

    return [
      analysisSummary.leadPreview,
      item.articleExcerpt,
      item.snippet,
      item.title,
    ]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean)
      .join('\n\n')
      .trim()
  }

  private normalizeInsightArticleText(value: string) {
    return value
      .replace(/\r\n/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  private async generateProjectInsight(
    project: GeoSerpResearchProject,
    analyzedResults: GeoSerpResearchResult[],
    config: GeoProviderConfig
  ) {
    const promptPreview = await this.buildProjectInsightPromptPreview(
      project,
      analyzedResults,
      config.model || DEFAULT_MODEL
    )

    try {
      return await this.generateStructuredInsight(
        promptPreview.systemPrompt,
        promptPreview.userPrompt,
        config,
        {
          userMessage: promptPreview.retryUserPrompt,
          maxTokens: RETRY_INSIGHT_MAX_TOKENS,
        }
      )
    } catch (error) {
      if (this.isInsightTimeoutError(error) || this.isInsightParseError(error)) {
        return {
          insight: this.buildDeterministicProjectInsight(project, analyzedResults),
          model: 'local-heuristic-fallback',
        }
      }

      throw error
    }
  }

  private async streamProjectInsight(
    project: GeoSerpResearchProject,
    analyzedResults: GeoSerpResearchResult[],
    config: GeoProviderConfig,
    hooks: InsightStreamHooks,
    options?: {
      allowFallback?: boolean
      preservePreviewOnFallback?: boolean
    }
  ) {
    const allowFallback = options?.allowFallback ?? true
    const preservePreviewOnFallback = options?.preservePreviewOnFallback ?? false
    const model = config.model || DEFAULT_MODEL
    const promptPreview = await this.buildProjectInsightPromptPreview(project, analyzedResults, model)
    const systemPrompt = promptPreview.systemPrompt
    const primaryUserMessage = promptPreview.userPrompt
    const fallbackUserMessage = promptPreview.retryUserPrompt

    hooks.onStatus('starting', `正在使用 ${model} 生成 AI 总结`, model)

    try {
      return await this.requestStructuredInsightStream(
        {
          model,
          systemPrompt,
          userMessage: primaryUserMessage,
          maxTokens: DEFAULT_INSIGHT_MAX_TOKENS,
        },
        config,
        hooks,
        {
          allowFormatterFallback: allowFallback,
        }
      )
    } catch (error) {
      if (!allowFallback) {
        throw new Error(this.toInsightStreamErrorMessage(error, false, 'test'))
      }

      if (this.shouldUseInsightModelFallback(model)) {
        hooks.onStatus(
          'fallback',
          `${model} 当前没有稳定完成，正在切换 ${INSIGHT_FORMATTER_FALLBACK_MODEL} 继续生成`,
          INSIGHT_FORMATTER_FALLBACK_MODEL
        )
        if (!preservePreviewOnFallback) {
          hooks.onResetPreview()
        }

        try {
          return await this.requestStructuredInsightStream(
            {
              model: INSIGHT_FORMATTER_FALLBACK_MODEL,
              systemPrompt,
              userMessage: fallbackUserMessage,
              maxTokens: RETRY_INSIGHT_MAX_TOKENS,
            },
            config,
            hooks
          )
        } catch (fallbackError) {
          if (this.isInsightTimeoutError(fallbackError) || this.isInsightParseError(fallbackError)) {
            hooks.onStatus('completed', '上游模型仍不稳定，已切换到本地保底总结结果', 'local-heuristic-fallback')
            return {
              insight: this.buildDeterministicProjectInsight(project, analyzedResults),
              model: 'local-heuristic-fallback',
            }
          }

          throw fallbackError
        }
      }

      if (this.isInsightTimeoutError(error) || this.isInsightParseError(error)) {
        hooks.onStatus('completed', '上游模型未稳定完成，已切换到本地保底总结结果', 'local-heuristic-fallback')
        return {
          insight: this.buildDeterministicProjectInsight(project, analyzedResults),
          model: 'local-heuristic-fallback',
        }
      }

      throw error
    }
  }

  private async generateRuleCardInsight(
    category: string,
    summaries: GeoSerpAiSummary[],
    config: GeoProviderConfig,
    payload: GenerateGeoRuleCardDto
  ) {
    const retrySummaries = summaries
      .slice(0, RETRY_RULE_CARD_SUMMARIES)
      .map((item) => this.toInsightSummaryRecord(item))

    try {
      return await this.generateStructuredInsight(
        buildRuleCardSystemPrompt(),
        buildRuleCardUserMessage({
          category,
          summaryCount: summaries.length,
          fromDate: payload.fromDate,
          toDate: payload.toDate,
          summaries: summaries.map((item) => this.toInsightSummaryRecord(item)),
        }),
        config,
        {
          userMessage: buildRuleCardRetryUserMessage({
            category,
            summaryCount: summaries.length,
            fromDate: payload.fromDate,
            toDate: payload.toDate,
            summaries: retrySummaries,
          }),
          maxTokens: RETRY_INSIGHT_MAX_TOKENS,
        }
      )
    } catch (error) {
      if (this.isInsightTimeoutError(error) || this.isInsightParseError(error)) {
        return {
          insight: this.buildDeterministicRuleCardInsight(category, summaries),
          model: 'local-heuristic-fallback',
        }
      }

      throw error
    }
  }

  private async generateStructuredInsight(
    systemPrompt: string,
    userMessage: string,
    config: GeoProviderConfig,
    retryOptions?: InsightRetryOptions
  ): Promise<InsightExecutionResult> {
    const client = this.createAnthropicClient(config)
    const model = config.model || DEFAULT_MODEL
    try {
      return await this.requestStructuredInsight(client, {
        model,
        systemPrompt,
        userMessage,
        maxTokens: DEFAULT_INSIGHT_MAX_TOKENS,
      }, config)
    } catch (error) {
      if (this.shouldUseInsightModelFallback(model)) {
        return this.generateInsightWithFallbackModel(
          systemPrompt,
          retryOptions?.userMessage ?? userMessage,
          config,
          retryOptions?.maxTokens ?? RETRY_INSIGHT_MAX_TOKENS
        )
      }

      this.rethrowInsightGenerationError(error)
    }
  }

  private async requestStructuredInsightStream(
    input: {
      model: string
      systemPrompt: string
      userMessage: string
      maxTokens: number
    },
    config: GeoProviderConfig,
    hooks: InsightStreamHooks,
    options?: {
      allowFormatterFallback?: boolean
    }
  ): Promise<InsightExecutionResult> {
    const client = this.createAnthropicClient(config)
    const outputText = await this.collectInsightStreamOutput(client, input, hooks.onText)

    try {
      hooks.onStatus('completed', `已收到 ${input.model} 的完整结构化结果`, input.model)
      return {
        insight: this.normalizeInsightPayload(this.parseInsightPayload(outputText)),
        model: input.model,
      }
    } catch (error) {
      if (
        options?.allowFormatterFallback !== false &&
        this.isInsightParseError(error) &&
        this.shouldUseInsightFormatterFallback(input.model)
      ) {
        hooks.onStatus('repairing', `${input.model} 已返回内容，正在修复结构化格式`, INSIGHT_FORMATTER_FALLBACK_MODEL)
        return {
          insight: await this.repairInsightWithFallbackModel(outputText, config),
          model: input.model,
        }
      }

      throw error
    }
  }

  private async requestStructuredInsight(
    client: Anthropic,
    input: {
      model: string
      systemPrompt: string
      userMessage: string
      maxTokens: number
    },
    config: GeoProviderConfig
  ): Promise<InsightExecutionResult> {
    const response = await this.runInsightRequest(
      client.messages.create({
        model: input.model,
        max_tokens: input.maxTokens,
        temperature: 0,
        system: input.systemPrompt,
        messages: [
          {
            role: 'user',
            content: input.userMessage,
          },
        ],
        output_config: {
          format: {
            type: 'json_schema',
            schema: this.buildInsightOutputSchema(),
          },
        },
      })
    )

    const outputText = response.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('\n')
      .trim()

    try {
      return {
        insight: this.normalizeInsightPayload(this.parseInsightPayload(outputText)),
        model: input.model,
      }
    } catch (error) {
      if (this.isInsightParseError(error) && this.shouldUseInsightFormatterFallback(input.model)) {
        return {
          insight: await this.repairInsightWithFallbackModel(outputText, config),
          model: input.model,
        }
      }

      throw error
    }
  }

  private rethrowInsightGenerationError(error: unknown): never {
    if (this.isInsightTimeoutError(error)) {
      throw new ServiceUnavailableException('AI 总结请求超时。我已经切到了保底链路，如果还失败，请稍后重试。')
    }

    if (this.isInsightParseError(error)) {
      throw new BadRequestException('AI 总结返回的结构化内容不完整，请重试一次。')
    }

    throw error
  }

  private toInsightStreamErrorMessage(
    error: unknown,
    allowFallback: boolean,
    mode: 'standard' | 'test'
  ) {
    if (this.isInsightTimeoutError(error)) {
      return allowFallback
        ? 'AI 总结请求超时，保底链路也没有稳定完成，请稍后重试。'
        : mode === 'test'
          ? '当前测试模型请求超时，未启用保底链路。'
          : 'AI 总结请求超时，请稍后重试。'
    }

    if (this.isInsightParseError(error)) {
      return allowFallback
        ? '模型已返回内容，但结构化结果不完整，保底链路也没有稳定完成。'
        : mode === 'test'
          ? '模型已经返回内容，但结构化 JSON 不完整，当前测试未启用保底链路。'
          : '模型返回的结构化内容不完整，请重试一次。'
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message
    }

    return 'AI 总结生成失败'
  }

  private shouldRetryInsightWithCompactPayload(model: string) {
    const normalizedModel = model.trim().toLowerCase()
    return normalizedModel.includes('opus')
  }

  private shouldUseInsightModelFallback(model: string) {
    const normalizedModel = model.trim().toLowerCase()
    return normalizedModel.includes('opus')
  }

  private async runInsightRequest<T>(request: Promise<T>) {
    let timer: NodeJS.Timeout | null = null

    try {
      return await Promise.race([
        request,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            const error = new Error('Insight request timed out')
            error.name = INSIGHT_TIMEOUT_ERROR_NAME
            reject(error)
          }, DEFAULT_INSIGHT_TIMEOUT_MS)
        }),
      ])
    } finally {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }

  private async collectInsightStreamOutput(
    client: Anthropic,
    input: {
      model: string
      systemPrompt: string
      userMessage: string
      maxTokens: number
    },
    onText: (text: string) => void
  ) {
    const stream = client.messages.stream({
      model: input.model,
      max_tokens: input.maxTokens,
      temperature: 0,
      system: input.systemPrompt,
      messages: [
        {
          role: 'user',
          content: input.userMessage,
        },
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: this.buildInsightOutputSchema(),
        },
      },
    })

    const abortableStream = stream as { abort?: () => void }

    return await new Promise<string>((resolve, reject) => {
      let timer: NodeJS.Timeout | null = setTimeout(() => {
        abortableStream.abort?.()
        const error = new Error('Insight request timed out')
        error.name = INSIGHT_TIMEOUT_ERROR_NAME
        reject(error)
      }, DEFAULT_INSIGHT_TIMEOUT_MS)
      let outputText = ''

      const clear = () => {
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
      }

      stream.on('text', (text: string) => {
        outputText += text
        onText(text)
      })

      stream.on('end', () => {
        clear()
        resolve(outputText.trim())
      })

      stream.on('error', (error: Error) => {
        clear()
        reject(error)
      })
    })
  }

  private async prepareSerpProjectAiSummary(id: number) {
    const project = await this.findSerpProjectWithResults(id)
    const analyzedResults = project.results.filter((item) => item.fetchStatus === GeoSerpResultStatus.ANALYZED)
    if (analyzedResults.length === 0) {
      throw new BadRequestException('当前项目至少需要一篇解剖成功的文章，才能生成 AI 总结')
    }

    const providerConfig = await this.ensureProviderConfig()
    if (!providerConfig.apiKey.trim()) {
      throw new BadRequestException('请先完成 Anthropic 配置后再生成 AI 总结')
    }

    return {
      project,
      analyzedResults,
      providerConfig,
    }
  }

  private async findSerpProjectWithResults(id: number) {
    const project = await this.prisma.geoSerpResearchProject.findUnique({
      where: { id },
      include: {
        aiSummary: true,
        results: {
          orderBy: [{ rank: 'asc' }, { id: 'asc' }],
        },
      },
    })

    if (!project) {
      throw new NotFoundException('研究项目不存在')
    }

    return project
  }

  private async persistSerpProjectAiSummary(
    project: GeoSerpResearchProject & { results?: GeoSerpResearchResult[]; aiSummary?: GeoSerpAiSummary | null },
    insightResult: InsightExecutionResult
  ) {
    const insight = insightResult.insight
    const summary = await this.prisma.geoSerpAiSummary.upsert({
      where: { projectId: project.id },
      update: {
        category: project.category,
        model: insightResult.model,
        rawSummary: insight.rawSummary,
        titlePatterns: this.toJsonArray(insight.titlePatterns),
        leadPatterns: this.toJsonArray(insight.leadPatterns),
        sectionBlueprint: this.toJsonArray(insight.sectionBlueprint),
        keywordPlacement: this.toJsonArray(insight.keywordPlacement),
        sellingPointOrder: this.toJsonArray(insight.sellingPointOrder),
        trustSignals: this.toJsonArray(insight.trustSignals),
        endingPatterns: this.toJsonArray(insight.endingPatterns),
        antiPatterns: this.toJsonArray(insight.antiPatterns),
        rankingHypotheses: this.toJsonArray(insight.rankingHypotheses),
      },
      create: {
        projectId: project.id,
        category: project.category,
        model: insightResult.model,
        rawSummary: insight.rawSummary,
        titlePatterns: this.toJsonArray(insight.titlePatterns),
        leadPatterns: this.toJsonArray(insight.leadPatterns),
        sectionBlueprint: this.toJsonArray(insight.sectionBlueprint),
        keywordPlacement: this.toJsonArray(insight.keywordPlacement),
        sellingPointOrder: this.toJsonArray(insight.sellingPointOrder),
        trustSignals: this.toJsonArray(insight.trustSignals),
        endingPatterns: this.toJsonArray(insight.endingPatterns),
        antiPatterns: this.toJsonArray(insight.antiPatterns),
        rankingHypotheses: this.toJsonArray(insight.rankingHypotheses),
      },
      include: {
        project: {
          select: {
            id: true,
            keyword: true,
            category: true,
            engine: true,
            updatedAt: true,
          },
        },
      },
    })

    return this.toAiSummaryView(summary)
  }

  private toProviderConfigView(config: GeoProviderConfig) {
    const trimmedKey = config.apiKey.trim()
    const trimmedBaseUrl = config.baseUrl.trim()
    const apiKeyHint = trimmedKey ? `${trimmedKey.slice(0, 6)}••••${trimmedKey.slice(-4)}` : ''
    const baseUrlHint = trimmedBaseUrl ? this.maskBaseUrl(trimmedBaseUrl) : ''

    return {
      model: config.model,
      hasApiKey: Boolean(trimmedKey),
      hasBaseUrl: Boolean(trimmedBaseUrl),
      apiKeyHint,
      baseUrlHint,
    }
  }

  private toPromptEngineV2FixedRulesView(config: GeoPromptEngineV2FixedRules): PromptEngineV2FixedRulesView {
    return {
      ruleText: config.ruleText,
      updatedAt: config.updatedAt.toISOString(),
    }
  }

  private toLegacyPromptEngineRulesView(): LegacyPromptEngineRulesView {
    return {
      summary:
        '旧版固定引擎的核心规则骨架保存在系统提示词里，运行时还会根据标题关键词、SEO 关键词和已激活规则卡追加动态约束。',
      ruleText: buildLegacyPromptEngineSystemPromptPreview(),
      conditionalNotes: [...LEGACY_PROMPT_ENGINE_CONDITIONAL_RULE_NOTES],
    }
  }

  private toPromptEngineV2VersionView(version: GeoPromptEngineVersion): PromptEngineV2VersionView {
    return {
      id: version.id,
      name: version.name,
      description: version.description,
      articleUrl: version.articleUrl,
      articleText: version.articleText,
      ruleText: version.ruleText,
      isActive: version.isActive,
      sortOrder: version.sortOrder,
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
    }
  }

  private async findPromptEngineV2VersionDraftSessionRecord(id: number, includeArchived = false) {
    const session = await this.prisma.geoPromptEngineVersionDraftSession.findUnique({
      where: { id },
    })

    if (!session || (!includeArchived && session.status === 'ARCHIVED')) {
      throw new NotFoundException('AI 对话会话不存在')
    }

    return session
  }

  private toPromptEngineV2VersionDraftSessionView(
    session: GeoPromptEngineVersionDraftSession
  ): PromptEngineV2VersionDraftSessionView {
    const messages = this.readVersionDraftMessages(session.messages as Prisma.JsonValue)
    const lastMessage = [...messages].reverse().find((item) => item.content.trim())

    return {
      id: session.id,
      title: session.title,
      articleText: session.articleText,
      articleUrl: session.articleUrl,
      notes: session.notes,
      model: session.model,
      messages,
      status: this.toVersionDraftSessionStatus(session.status),
      ownerUserId: session.ownerUserId,
      ownerName: session.ownerName,
      suggestedName: session.suggestedName,
      suggestedDescription: session.suggestedDescription,
      suggestedRuleText: session.suggestedRuleText,
      lastMessagePreview: lastMessage ? this.toShortText(lastMessage.content, 90) : '',
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    }
  }

  private toVersionDraftSessionStatus(value: string): PromptEngineV2VersionDraftSessionStatus {
    if (value === 'APPLIED' || value === 'ARCHIVED') return value
    return 'ACTIVE'
  }

  private resolvePromptEngineV2VersionDraftModel(model?: string | null, fallbackModel?: string | null) {
    const requestedModel = model?.trim() || fallbackModel?.trim() || DEFAULT_VERSION_DRAFT_MODEL

    if ((PROMPT_ENGINE_VERSION_DRAFT_MODELS as readonly string[]).includes(requestedModel)) {
      return requestedModel
    }

    return DEFAULT_VERSION_DRAFT_MODEL
  }

  private normalizePromptEngineV2VersionDraftMessages(
    messages: Array<{ role: 'user' | 'assistant'; content: string; createdAt?: string }>
  ): PromptEngineV2VersionDraftMessage[] {
    const now = new Date().toISOString()

    return messages
      .map((message) => {
        const role: 'user' | 'assistant' = message.role === 'assistant' ? 'assistant' : 'user'
        const content = String(message.content ?? '').trim()
        const createdAt =
          message.createdAt && !Number.isNaN(new Date(message.createdAt).getTime())
            ? new Date(message.createdAt).toISOString()
            : now

        return {
          role,
          content,
          createdAt,
        }
      })
      .filter((message) => message.content)
  }

  private readVersionDraftMessages(value: Prisma.JsonValue): PromptEngineV2VersionDraftMessage[] {
    if (!Array.isArray(value)) return []

    return this.normalizePromptEngineV2VersionDraftMessages(
      value.map((item) => {
        const record = this.toJsonObject(item as Prisma.JsonValue)
        const role = record.role === 'assistant' ? 'assistant' : 'user'

        return {
          role,
          content: typeof record.content === 'string' ? record.content : '',
          createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
        }
      })
    )
  }

  private toVersionDraftMessageJson(messages: PromptEngineV2VersionDraftMessage[]): Prisma.InputJsonValue {
    return messages.map((message) => ({
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    }))
  }

  private toVersionDraftSessionTitle(
    title: string | undefined,
    messages: PromptEngineV2VersionDraftMessage[],
    articleUrl: string | undefined,
    notes: string | undefined
  ) {
    const trimmedTitle = title?.trim()
    if (trimmedTitle) return this.toShortText(trimmedTitle, 120)

    const firstUserMessage = messages.find((message) => message.role === 'user')?.content
    if (firstUserMessage) return this.toShortText(firstUserMessage, 36)

    const trimmedNotes = notes?.trim()
    if (trimmedNotes) return this.toShortText(trimmedNotes, 36)

    const trimmedUrl = articleUrl?.trim()
    if (trimmedUrl) return this.toShortText(trimmedUrl, 36)

    return `AI 建版会话 ${new Date().toLocaleString('zh-CN', { hour12: false })}`
  }

  private async resolveVersionDraftArticleText(articleText?: string, articleUrl?: string) {
    const trimmedArticleText = articleText?.trim()
    if (trimmedArticleText) {
      return trimmedArticleText
    }

    const trimmedArticleUrl = articleUrl?.trim()
    if (!trimmedArticleUrl) {
      return ''
    }

    return fetchArticle(trimmedArticleUrl)
  }

  private buildPromptEngineVersionDraftOutputSchema() {
    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        suggestedName: {
          type: 'string',
        },
        suggestedDescription: {
          type: 'string',
        },
        suggestedRuleText: {
          type: 'string',
        },
      },
      required: ['suggestedName', 'suggestedDescription', 'suggestedRuleText'],
    } as const
  }

  private parsePromptEngineVersionDraftSuggestion(outputText: string) {
    const normalized = outputText.trim()
    const fencedMatch = normalized.match(/```json\s*([\s\S]*?)```/i) || normalized.match(/```\s*([\s\S]*?)```/i)
    const candidate = fencedMatch?.[1]?.trim() || normalized
    const firstBrace = candidate.indexOf('{')
    const lastBrace = candidate.lastIndexOf('}')

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new BadRequestException('AI 返回内容无法解析为结构化 JSON，请稍后重试')
    }

    const jsonText = candidate.slice(firstBrace, lastBrace + 1)
    const parsed = this.tryParsePromptEngineVersionDraftJson(jsonText)

    if (
      typeof parsed.suggestedName !== 'string' ||
      typeof parsed.suggestedDescription !== 'string' ||
      typeof parsed.suggestedRuleText !== 'string'
    ) {
      throw new BadRequestException('AI 返回的版本草稿结构不完整，请重试一次。')
    }

    return parsed as PromptEngineV2VersionDraftSuggestion
  }

  private tryParsePromptEngineVersionDraftJson(jsonText: string) {
    try {
      return JSON.parse(jsonText) as Partial<PromptEngineV2VersionDraftSuggestion>
    } catch (error) {
      const repaired = this.repairPromptEngineVersionDraftJsonText(jsonText)
      if (repaired !== jsonText) {
        try {
          return JSON.parse(repaired) as Partial<PromptEngineV2VersionDraftSuggestion>
        } catch {
          // Ignore and fall through to the original parse error below.
        }
      }

      throw error
    }
  }

  private repairPromptEngineVersionDraftJsonText(jsonText: string) {
    return jsonText
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/，/g, ',')
      .replace(/：/g, ':')
      .replace(/,\s*([}\]])/g, '$1')
  }

  private normalizePromptEngineVersionDraftSuggestion(
    suggestion: PromptEngineV2VersionDraftSuggestion
  ): PromptEngineV2VersionDraftSuggestion {
    return {
      suggestedName: suggestion.suggestedName.trim() || '未命名版本',
      suggestedDescription: suggestion.suggestedDescription.trim(),
      suggestedRuleText: suggestion.suggestedRuleText.trim(),
    }
  }

  private buildPromptEngineVersionDraftFallbackSuggestion(
    messages: PromptEngineV2VersionDraftMessage[],
    notes?: string
  ): PromptEngineV2VersionDraftSuggestion | null {
    const assistantMessage = [...messages]
      .reverse()
      .find((message) => message.role === 'assistant' && message.content.trim())
    const suggestedRuleText = assistantMessage?.content.trim()

    if (!suggestedRuleText) return null

    const firstUserMessage = messages.find((message) => message.role === 'user')?.content.trim()
    const suggestedName = firstUserMessage ? this.toShortText(firstUserMessage, 28) : 'AI 建版规则'
    const suggestedDescription =
      notes?.trim() || '模型结构化解析不稳定时，系统已使用最近一次 AI 回复作为版本规则草稿。'

    return this.normalizePromptEngineVersionDraftSuggestion({
      suggestedName,
      suggestedDescription,
      suggestedRuleText,
    })
  }

  private async repairPromptEngineVersionDraftWithFallbackModel(
    rawContent: string,
    config: GeoProviderConfig
  ) {
    const client = this.createAnthropicClient(config)
    const response = await this.runInsightRequest(
      client.messages.create({
        model: INSIGHT_FORMATTER_FALLBACK_MODEL,
        max_tokens: DEFAULT_VERSION_DRAFT_REPAIR_MAX_TOKENS,
        temperature: 0,
        system: buildVersionDraftRepairSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: buildVersionDraftRepairUserMessage({
              rawContent: rawContent.slice(0, 6000),
            }),
          },
        ],
        output_config: {
          format: {
            type: 'json_schema',
            schema: this.buildPromptEngineVersionDraftOutputSchema(),
          },
        },
      })
    )

    const outputText = response.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('\n')
      .trim()

    return this.parsePromptEngineVersionDraftSuggestion(outputText)
  }

  private parsePromptEngineVersionDraftMarkdown(fileName: string, content: string) {
    const normalized = content
      .replace(/\r\n/g, '\n')
      .replace(/\u00a0/g, ' ')
      .trim()

    if (!normalized) {
      throw new BadRequestException('上传内容为空，无法解析版本草稿')
    }

    const lines = normalized.split('\n')
    const firstHeading = lines.find((line) => /^#\s+/.test(line.trim()))
    const suggestedName = firstHeading
      ? firstHeading.replace(/^#\s+/, '').trim()
      : this.toShortText(fileName.replace(/\.[^.]+$/, '').trim() || '未命名版本', 120)

    const descriptionHeadingIndex = lines.findIndex((line) =>
      /^#{1,3}\s*(说明|简介|描述|用途|版本说明)\s*$/i.test(line.trim())
    )

    let suggestedDescription = ''
    if (descriptionHeadingIndex !== -1) {
      const descriptionLines: string[] = []

      for (let index = descriptionHeadingIndex + 1; index < lines.length; index += 1) {
        const line = lines[index]
        if (/^#{1,3}\s+/.test(line.trim())) break
        descriptionLines.push(line)
      }

      suggestedDescription = descriptionLines.join('\n').trim()
    }

    const filteredLines = lines.filter((line, index) => {
      if (firstHeading && line === firstHeading) return false
      if (descriptionHeadingIndex === -1) return true
      if (index === descriptionHeadingIndex) return false

      if (index > descriptionHeadingIndex) {
        for (let cursor = descriptionHeadingIndex + 1; cursor < lines.length; cursor += 1) {
          if (/^#{1,3}\s+/.test(lines[cursor].trim())) {
            return index >= cursor
          }
        }

        return false
      }

      return true
    })

    const suggestedRuleText = filteredLines.join('\n').trim() || normalized

    return this.normalizePromptEngineVersionDraftSuggestion({
      suggestedName,
      suggestedDescription,
      suggestedRuleText,
    })
  }

  private maskBaseUrl(baseUrl: string) {
    try {
      const url = new URL(baseUrl)
      const protocol = url.protocol
      const host = url.host
      const maskedHost =
        host.length <= 8
          ? `${host.slice(0, 2)}••••`
          : `${host.slice(0, 4)}••••${host.slice(-4)}`
      const path = url.pathname && url.pathname !== '/' ? `${url.pathname.slice(0, 4)}••••` : ''

      return `${protocol}//${maskedHost}${path}`
    } catch {
      if (baseUrl.length <= 8) {
        return `${baseUrl.slice(0, 2)}••••`
      }

      return `${baseUrl.slice(0, 6)}••••${baseUrl.slice(-4)}`
    }
  }

  private async buildSerpResultInput(
    keyword: string,
    item: {
      rank: number
      title: string
      snippet: string
      searchUrl: string
      finalUrl: string
      domain: string
    }
  ): Promise<Prisma.GeoSerpResearchResultCreateWithoutProjectInput> {
    try {
      const detail = await fetchArticleDetail(item.finalUrl || item.searchUrl)
      const resolvedTitle = this.toShortText(item.title) || `百度结果 ${item.rank}`
      const resolvedSnippet = this.toShortText(item.snippet)
      const analysis = analyzeSerpArticle(keyword, resolvedTitle, resolvedSnippet, detail)

      return {
        rank: item.rank,
        title: resolvedTitle,
        snippet: resolvedSnippet,
        searchUrl: item.searchUrl,
        finalUrl: item.finalUrl,
        domain: this.toShortText(item.domain, 120) || 'baijiahao.baidu.com',
        fetchStatus: GeoSerpResultStatus.ANALYZED,
        fetchMessage: '',
        contentLength: analysis.contentLength,
        paragraphCount: analysis.paragraphCount,
        titleLength: analysis.titleLength,
        keywordHits: analysis.keywordHits as Prisma.InputJsonValue,
        patternTags: analysis.patternTags as Prisma.InputJsonValue,
        headingOutline: analysis.headingOutline as Prisma.InputJsonValue,
        analysisSummary: analysis.analysisSummary as Prisma.InputJsonValue,
        articleExcerpt: analysis.excerpt,
        publishAt: analysis.publishAt,
        author: analysis.author,
      }
    } catch (error) {
      const fallbackTitle = this.toShortText(item.title) || `百度结果 ${item.rank}`
      const fallbackSnippet = this.toShortText(item.snippet)

      return {
        rank: item.rank,
        title: fallbackTitle,
        snippet: fallbackSnippet,
        searchUrl: item.searchUrl,
        finalUrl: item.finalUrl,
        domain: this.toShortText(item.domain, 120) || 'baijiahao.baidu.com',
        fetchStatus: GeoSerpResultStatus.FETCH_FAILED,
        fetchMessage: this.toShortText(
          error instanceof Error ? error.message : '文章抓取失败',
          MAX_SHORT_TEXT_LENGTH
        ),
        contentLength: 0,
        paragraphCount: 0,
        titleLength: fallbackTitle.length,
        keywordHits: {
          keyword,
          titleMatches: fallbackTitle.includes(keyword) ? 1 : 0,
          snippetMatches: fallbackSnippet.includes(keyword) ? 1 : 0,
          articleMatches: 0,
        } as Prisma.InputJsonValue,
        patternTags: [] as Prisma.InputJsonValue,
        headingOutline: [] as Prisma.InputJsonValue,
        analysisSummary: {
          titlePattern: this.inferTitlePattern(fallbackTitle),
          leadPreview: fallbackSnippet,
          hasHeadings: false,
          hasListStyle: false,
        } as Prisma.InputJsonValue,
        articleExcerpt: '',
        publishAt: '',
        author: '',
      }
    }
  }

  private async buildManualSerpResultInput(
    keyword: string,
    articleUrl: string,
    rank: number
  ): Promise<Prisma.GeoSerpResearchResultCreateWithoutProjectInput> {
    const domain = this.toShortText(this.extractDomain(articleUrl), 120) || 'baijiahao.baidu.com'

    try {
      const detail = await fetchArticleDetail(articleUrl)
      const resolvedTitle = this.toShortText(detail.title) || `手动录入文章 ${rank}`
      const resolvedSnippet = this.toShortText(detail.excerpt)
      const analysis = analyzeSerpArticle(keyword, resolvedTitle, resolvedSnippet, detail)

      return {
        rank,
        title: resolvedTitle,
        snippet: resolvedSnippet,
        searchUrl: articleUrl,
        finalUrl: detail.url || articleUrl,
        domain,
        fetchStatus: GeoSerpResultStatus.ANALYZED,
        fetchMessage: '',
        contentLength: analysis.contentLength,
        paragraphCount: analysis.paragraphCount,
        titleLength: analysis.titleLength,
        keywordHits: analysis.keywordHits as Prisma.InputJsonValue,
        patternTags: analysis.patternTags as Prisma.InputJsonValue,
        headingOutline: analysis.headingOutline as Prisma.InputJsonValue,
        analysisSummary: analysis.analysisSummary as Prisma.InputJsonValue,
        articleExcerpt: analysis.excerpt,
        publishAt: analysis.publishAt,
        author: analysis.author,
      }
    } catch (error) {
      const fallbackTitle = `手动录入文章 ${rank}`

      return {
        rank,
        title: this.toShortText(fallbackTitle),
        snippet: '',
        searchUrl: articleUrl,
        finalUrl: articleUrl,
        domain,
        fetchStatus: GeoSerpResultStatus.FETCH_FAILED,
        fetchMessage: this.toShortText(
          error instanceof Error ? error.message : '文章抓取失败',
          MAX_SHORT_TEXT_LENGTH
        ),
        contentLength: 0,
        paragraphCount: 0,
        titleLength: fallbackTitle.length,
        keywordHits: {
          keyword,
          titleMatches: 0,
          snippetMatches: 0,
          articleMatches: 0,
        } as Prisma.InputJsonValue,
        patternTags: [] as Prisma.InputJsonValue,
        headingOutline: [] as Prisma.InputJsonValue,
        analysisSummary: {
          titlePattern: '手动录入待分析',
          leadPreview: '',
          hasHeadings: false,
          hasListStyle: false,
        } as Prisma.InputJsonValue,
        articleExcerpt: '',
        publishAt: '',
        author: '',
      }
    }
  }

  private toProfileView(profile: GeoProductProfile) {
    return {
      id: profile.id,
      profileName: profile.profileName,
      articleUrl: profile.articleUrl,
      product: {
        brand: profile.brand,
        name: profile.productName,
        type: profile.type,
        specs: profile.specs,
        sellingPoints: this.toStringArray(profile.sellingPoints),
        sellingPointsRange: profile.sellingPointsRange,
        targetAudience: profile.targetAudience,
        emphasis: this.toStringArray(profile.emphasis),
        emphasisRange: profile.emphasisRange,
        keyword: profile.keyword,
        keywordMode: profile.keywordMode,
        seoKeywords: this.toStringArray(profile.seoKeywords),
        brandPool: this.toStringArray(profile.brandPool),
        brandPoolCount: profile.brandPoolCount,
      },
      updatedAt: profile.updatedAt.toISOString(),
      createdAt: profile.createdAt.toISOString(),
    }
  }

  private toSerpProjectSummaryView(project: GeoSerpResearchProject) {
    const projectWithSummary = project as GeoSerpResearchProject & {
      aiSummary?: { id: number; updatedAt: Date } | null
    }

    return {
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
      hasAiSummary: Boolean(projectWithSummary.aiSummary),
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    }
  }

  private toSerpProjectDetailView(
    project: GeoSerpResearchProject & {
      aiSummary?: GeoSerpAiSummary | null
      results: GeoSerpResearchResult[]
    }
  ) {
    return {
      ...this.toSerpProjectSummaryView(project),
      hasAiSummary: Boolean(project.aiSummary),
      aiSummary: project.aiSummary ? this.toAiSummaryView({
        ...project.aiSummary,
        project: {
          id: project.id,
          keyword: project.keyword,
          category: project.category,
          engine: project.engine,
          updatedAt: project.updatedAt,
        },
      }) : null,
      results: project.results.map((result) => this.toSerpResultView(result)),
    }
  }

  private toAiSummaryView(
    summary: GeoSerpAiSummary & {
      project: {
        id: number
        keyword: string
        category: string
        engine: string
        updatedAt: Date
      }
    }
  ) {
    return {
      id: summary.id,
      projectId: summary.projectId,
      projectKeyword: summary.project.keyword,
      category: summary.category,
      engine: summary.project.engine,
      requestedModel: summary.model,
      model: summary.model,
      fallbackUsed: false,
      fallbackReason: '',
      rawSummary: summary.rawSummary,
      titlePatterns: this.toLimitedStringArray(summary.titlePatterns),
      leadPatterns: this.toLimitedStringArray(summary.leadPatterns),
      sectionBlueprint: this.toLimitedStringArray(summary.sectionBlueprint),
      keywordPlacement: this.toLimitedStringArray(summary.keywordPlacement),
      sellingPointOrder: this.toLimitedStringArray(summary.sellingPointOrder),
      trustSignals: this.toLimitedStringArray(summary.trustSignals),
      endingPatterns: this.toLimitedStringArray(summary.endingPatterns),
      antiPatterns: this.toLimitedStringArray(summary.antiPatterns),
      rankingHypotheses: this.toLimitedStringArray(summary.rankingHypotheses),
      createdAt: summary.createdAt.toISOString(),
      updatedAt: summary.updatedAt.toISOString(),
      projectUpdatedAt: summary.project.updatedAt.toISOString(),
    }
  }

  private toAiSummaryDraftView(
    project: {
      id: number
      keyword: string
      category: string
      engine: string
    },
    insightResult: InsightExecutionResult,
    meta: {
      requestedModel: string
      fallbackUsed: boolean
      fallbackReason: string
    }
  ): InsightDraftView {
    const insight = insightResult.insight

    return {
      projectId: project.id,
      projectKeyword: project.keyword,
      category: project.category,
      engine: project.engine,
      requestedModel: meta.requestedModel,
      model: insightResult.model,
      fallbackUsed: meta.fallbackUsed,
      fallbackReason: meta.fallbackReason,
      rawSummary: insight.rawSummary,
      titlePatterns: insight.titlePatterns,
      leadPatterns: insight.leadPatterns,
      sectionBlueprint: insight.sectionBlueprint,
      keywordPlacement: insight.keywordPlacement,
      sellingPointOrder: insight.sellingPointOrder,
      trustSignals: insight.trustSignals,
      endingPatterns: insight.endingPatterns,
      antiPatterns: insight.antiPatterns,
      rankingHypotheses: insight.rankingHypotheses,
    }
  }

  private toRuleCardView(card: GeoRuleCard) {
    return {
      id: card.id,
      category: card.category,
      model: card.model,
      rawSummary: card.rawSummary,
      titlePatterns: this.toLimitedStringArray(card.titlePatterns),
      leadPatterns: this.toLimitedStringArray(card.leadPatterns),
      sectionBlueprint: this.toLimitedStringArray(card.sectionBlueprint),
      keywordPlacement: this.toLimitedStringArray(card.keywordPlacement),
      sellingPointOrder: this.toLimitedStringArray(card.sellingPointOrder),
      trustSignals: this.toLimitedStringArray(card.trustSignals),
      endingPatterns: this.toLimitedStringArray(card.endingPatterns),
      antiPatterns: this.toLimitedStringArray(card.antiPatterns),
      rankingHypotheses: this.toLimitedStringArray(card.rankingHypotheses),
      sourceSummaryCount: card.sourceSummaryCount,
      sourceSummaryIds: this.toNumberArray(card.sourceSummaryIds),
      sourceTimeStart: card.sourceTimeStart?.toISOString() ?? null,
      sourceTimeEnd: card.sourceTimeEnd?.toISOString() ?? null,
      isActive: card.isActive,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
    }
  }

  private toSerpResultView(result: GeoSerpResearchResult) {
    return {
      id: result.id,
      rank: result.rank,
      title: result.title,
      snippet: result.snippet,
      searchUrl: result.searchUrl,
      finalUrl: result.finalUrl,
      domain: result.domain,
      fetchStatus: result.fetchStatus,
      fetchMessage: result.fetchMessage,
      contentLength: result.contentLength,
      paragraphCount: result.paragraphCount,
      titleLength: result.titleLength,
      keywordHits: this.toJsonObject(result.keywordHits),
      patternTags: this.toStringArray(result.patternTags),
      headingOutline: this.toStringArray(result.headingOutline),
      analysisSummary: this.toJsonObject(result.analysisSummary),
      articleExcerpt: result.articleExcerpt,
      publishAt: result.publishAt,
      author: result.author,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    }
  }

  private toProfileInput(payload: CreateGeoProfileDto): Prisma.GeoProductProfileCreateInput {
    return {
      profileName: payload.profileName.trim(),
      brand: payload.brand.trim(),
      productName: payload.name.trim(),
      type: payload.type.trim(),
      specs: payload.specs.trim(),
      targetAudience: payload.targetAudience.trim(),
      keyword: payload.keyword.trim(),
      keywordMode: payload.keywordMode,
      sellingPoints: this.toJsonArray(payload.sellingPoints),
      sellingPointsRange: payload.sellingPointsRange.trim(),
      emphasis: this.toJsonArray(payload.emphasis),
      emphasisRange: payload.emphasisRange.trim(),
      seoKeywords: this.toJsonArray(payload.seoKeywords),
      brandPool: this.toJsonArray(payload.brandPool),
      brandPoolCount: payload.brandPoolCount.trim(),
      articleUrl: payload.articleUrl?.trim() ?? '',
    }
  }

  private toProfileUpdateInput(payload: UpdateGeoProfileDto): Prisma.GeoProductProfileUpdateInput {
    const data: Prisma.GeoProductProfileUpdateInput = {}

    if (payload.profileName !== undefined) data.profileName = payload.profileName.trim()
    if (payload.brand !== undefined) data.brand = payload.brand.trim()
    if (payload.name !== undefined) data.productName = payload.name.trim()
    if (payload.type !== undefined) data.type = payload.type.trim()
    if (payload.specs !== undefined) data.specs = payload.specs.trim()
    if (payload.targetAudience !== undefined) data.targetAudience = payload.targetAudience.trim()
    if (payload.keyword !== undefined) data.keyword = payload.keyword.trim()
    if (payload.keywordMode !== undefined) data.keywordMode = payload.keywordMode
    if (payload.sellingPoints !== undefined) data.sellingPoints = this.toJsonArray(payload.sellingPoints)
    if (payload.sellingPointsRange !== undefined) data.sellingPointsRange = payload.sellingPointsRange.trim()
    if (payload.emphasis !== undefined) data.emphasis = this.toJsonArray(payload.emphasis)
    if (payload.emphasisRange !== undefined) data.emphasisRange = payload.emphasisRange.trim()
    if (payload.seoKeywords !== undefined) data.seoKeywords = this.toJsonArray(payload.seoKeywords)
    if (payload.brandPool !== undefined) data.brandPool = this.toJsonArray(payload.brandPool)
    if (payload.brandPoolCount !== undefined) data.brandPoolCount = payload.brandPoolCount.trim()
    if (payload.articleUrl !== undefined) data.articleUrl = payload.articleUrl.trim()

    return data
  }

  private toProductInfo(payload: GeoProductDto): ProductInfo {
    return {
      brand: payload.brand.trim(),
      name: payload.name.trim(),
      type: payload.type.trim(),
      specs: payload.specs.trim(),
      sellingPoints: this.cleanStringArray(payload.sellingPoints),
      sellingPointsRange: payload.sellingPointsRange.trim(),
      targetAudience: payload.targetAudience.trim(),
      emphasis: this.cleanStringArray(payload.emphasis),
      emphasisRange: payload.emphasisRange.trim(),
      keyword: payload.keyword.trim(),
      keywordMode: payload.keywordMode,
      seoKeywords: this.cleanStringArray(payload.seoKeywords),
      brandPool: this.cleanStringArray(payload.brandPool),
      brandPoolCount: payload.brandPoolCount.trim(),
    }
  }

  private cleanStringArray(values: string[]) {
    return values.map((item) => item.trim()).filter(Boolean)
  }

  private toJsonArray(values: string[]) {
    return this.cleanStringArray(values) as Prisma.InputJsonValue
  }

  private toNumberJsonArray(values: number[]) {
    return values.filter((item) => Number.isFinite(item)) as Prisma.InputJsonValue
  }

  private toStringArray(value: Prisma.JsonValue) {
    return Array.isArray(value) ? value.map((item) => String(item)) : []
  }

  private toLimitedStringArray(value: Prisma.JsonValue) {
    return this.toStringArray(value)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX_RULE_CARD_ARRAY_ITEMS)
  }

  private toNumberArray(value: Prisma.JsonValue) {
    if (!Array.isArray(value)) return []

    return value
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item))
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>
  ) {
    if (items.length === 0) return [] as R[]

    const results = new Array<R>(items.length)
    let currentIndex = 0

    const worker = async () => {
      while (currentIndex < items.length) {
        const index = currentIndex++
        results[index] = await mapper(items[index], index)
      }
    }

    const workerCount = Math.min(Math.max(concurrency, 1), items.length)
    await Promise.all(Array.from({ length: workerCount }, () => worker()))

    return results
  }

  private toJsonObject(value: Prisma.JsonValue) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {}
  }

  private inferTitlePattern(title: string) {
    if (title.includes('排行榜') || title.includes('排名') || title.includes('十大')) return '排行型标题'
    if (title.includes('推荐') || title.includes('值得买')) return '推荐型标题'
    if (title.includes('测评') || title.includes('评测')) return '测评型标题'
    if (title.includes('怎么选') || title.includes('选购')) return '选购型标题'
    return '通用分析型标题'
  }

  private toShortText(value: string, maxLength = MAX_SHORT_TEXT_LENGTH) {
    return value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
  }

  private toLongText(value: string, maxLength: number) {
    return String(value ?? '').trim().slice(0, maxLength)
  }

  private toBoundaryDate(value: string, endOfDay: boolean) {
    const normalized = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000'
      return new Date(`${normalized}${suffix}`)
    }

    return new Date(normalized)
  }

  private toInsightSummaryRecord(summary: GeoSerpAiSummary): GeoInsightSummaryPayload {
    return {
      rawSummary: summary.rawSummary,
      titlePatterns: this.toLimitedStringArray(summary.titlePatterns),
      leadPatterns: this.toLimitedStringArray(summary.leadPatterns),
      sectionBlueprint: this.toLimitedStringArray(summary.sectionBlueprint),
      keywordPlacement: this.toLimitedStringArray(summary.keywordPlacement),
      sellingPointOrder: this.toLimitedStringArray(summary.sellingPointOrder),
      trustSignals: this.toLimitedStringArray(summary.trustSignals),
      endingPatterns: this.toLimitedStringArray(summary.endingPatterns),
      antiPatterns: this.toLimitedStringArray(summary.antiPatterns),
      rankingHypotheses: this.toLimitedStringArray(summary.rankingHypotheses),
    }
  }

  private normalizeInsightPayload(payload: Partial<GeoInsightSummaryPayload>) {
    const toArray = (value: unknown) => {
      if (Array.isArray(value)) {
        return value
          .map((item) => this.toShortText(String(item)))
          .filter(Boolean)
          .slice(0, MAX_RULE_CARD_ARRAY_ITEMS)
      }

      if (typeof value === 'string') {
        return value
          .split(/\n+/)
          .map((item) => this.toShortText(item))
          .filter(Boolean)
          .slice(0, MAX_RULE_CARD_ARRAY_ITEMS)
      }

      return []
    }

    return {
      rawSummary: this.toShortText(
        typeof payload.rawSummary === 'string' ? payload.rawSummary : '当前样本已完成总结，但还需要继续积累更多研究项目。',
        360
      ),
      titlePatterns: toArray(payload.titlePatterns),
      leadPatterns: toArray(payload.leadPatterns),
      sectionBlueprint: toArray(payload.sectionBlueprint),
      keywordPlacement: toArray(payload.keywordPlacement),
      sellingPointOrder: toArray(payload.sellingPointOrder),
      trustSignals: toArray(payload.trustSignals),
      endingPatterns: toArray(payload.endingPatterns),
      antiPatterns: toArray(payload.antiPatterns),
      rankingHypotheses: toArray(payload.rankingHypotheses),
    }
  }

  private buildDeterministicProjectInsight(
    project: GeoSerpResearchProject,
    analyzedResults: GeoSerpResearchResult[]
  ): GeoInsightSummaryPayload {
    const sortedResults = [...analyzedResults].sort((a, b) => a.rank - b.rank)
    const avgContentLength = Math.round(
      sortedResults.reduce((sum, item) => sum + item.contentLength, 0) / Math.max(sortedResults.length, 1)
    )
    const titlePatterns = this.collectFallbackLines(
      sortedResults.map((item) => this.toJsonObject(item.analysisSummary)?.titlePattern),
      [
        `标题会反复命中「${project.keyword}」相关排行词，保证搜索相关性`,
        '标题常用年份词、热榜词或情绪钩子提升点击意图',
      ]
    )
    const leadPatterns = this.collectFallbackLines(
      sortedResults.map((item) => this.toJsonObject(item.analysisSummary)?.leadPreview),
      [
        '开头通常先抛用户痛点，再快速承诺会给出可执行答案',
        '首段会尽快出现核心品类词和场景词，降低跳出率',
      ]
    )
    const sectionBlueprint = this.collectFallbackLines(
      sortedResults.flatMap((item) => this.toStringArray(item.headingOutline)),
      [
        '结构通常是痛点切入 -> 品牌/方案展开 -> 参数对比 -> 总结收尾',
        '会穿插榜单式或分段式小标题，便于阅读和收录',
      ]
    )
    const patternTags = this.collectFallbackLines(
      sortedResults.flatMap((item) => this.toStringArray(item.patternTags)),
      ['排行榜式推荐', '参数/场景并行说明']
    )

    return this.normalizeInsightPayload({
      rawSummary: `${project.category || '该品类'}的样本内容里，排前文章普遍会精准命中主题词，开头直接回应选购痛点，正文用结构化分段推进，并通过参数、场景、实测感受建立可信度。当前共分析 ${sortedResults.length} 篇文章，平均篇幅约 ${avgContentLength} 字，这类长内容更容易形成稳定收录和停留。`,
      titlePatterns,
      leadPatterns,
      sectionBlueprint,
      keywordPlacement: [
        `核心词会出现在标题、首段和结尾，围绕「${project.keyword}」做首尾呼应`,
        '场景词、参数词、品牌词会穿插在中段推荐部分，形成自然密度',
      ],
      sellingPointOrder: [
        '通常先给主推对象最大篇幅，再补充次级方案，形成明显排序感',
        '卖点展开会优先讲核心能力，再补充适用场景和价格带',
      ],
      trustSignals: [
        '参数数字、材质信息和真人体验描述会被反复用来建立可信度',
        '篇幅更长、段落更清晰的内容更容易让用户停留并完成比较',
      ],
      endingPatterns: [
        '结尾会回扣主题词并给出简洁选购建议',
        '常用趋势判断或总结句收尾，避免突然结束',
      ],
      antiPatterns: [
        '主推对象篇幅明显失衡时，容易暴露营销倾向',
        '如果长文缺少清晰分段和小标题，阅读体验会明显下降',
      ],
      rankingHypotheses: [
        `标题与正文对「${project.keyword}」保持高相关性，是获得排名的基础信号`,
        `当前样本平均篇幅约 ${avgContentLength} 字，长内容和结构化分段更利于收录与停留`,
        ...patternTags,
      ],
    })
  }

  private buildDeterministicRuleCardInsight(category: string, summaries: GeoSerpAiSummary[]): GeoInsightSummaryPayload {
    const summaryRecords = summaries.map((item) => this.toInsightSummaryRecord(item))

    return this.normalizeInsightPayload({
      rawSummary: `${category}品类的历史总结里，稳定共性集中在标题命中、开头痛点、分段结构、参数信号和结尾收束这五个层面。当前规则卡为本地保底沉淀版本，会优先保留多份总结中重复出现的高频结论。`,
      titlePatterns: this.collectFallbackLines(summaryRecords.flatMap((item) => item.titlePatterns), ['核心关键词前置', '年份/趋势词增强点击']),
      leadPatterns: this.collectFallbackLines(summaryRecords.flatMap((item) => item.leadPatterns), ['开头先提痛点', '快速承诺解决问题']),
      sectionBlueprint: this.collectFallbackLines(summaryRecords.flatMap((item) => item.sectionBlueprint), ['痛点 -> 展开 -> 对比 -> 总结', '小标题分段清晰']),
      keywordPlacement: this.collectFallbackLines(summaryRecords.flatMap((item) => item.keywordPlacement), ['标题、首段、结尾形成首尾呼应', '中段自然穿插场景词与参数词']),
      sellingPointOrder: this.collectFallbackLines(summaryRecords.flatMap((item) => item.sellingPointOrder), ['主推对象先讲核心优势', '次级对象按场景或价格梯度补充']),
      trustSignals: this.collectFallbackLines(summaryRecords.flatMap((item) => item.trustSignals), ['参数数字是第一信任信号', '实测感受和场景适配增强说服力']),
      endingPatterns: this.collectFallbackLines(summaryRecords.flatMap((item) => item.endingPatterns), ['结尾回扣主题词', '用简洁建议或趋势判断收尾']),
      antiPatterns: this.collectFallbackLines(summaryRecords.flatMap((item) => item.antiPatterns), ['营销痕迹过重会削弱可信度', '结构松散和分段不足会拖累阅读体验']),
      rankingHypotheses: this.collectFallbackLines(summaryRecords.flatMap((item) => item.rankingHypotheses), ['高相关标题+结构化长内容更容易获得稳定排名', '重复出现的参数和场景词能增强搜索匹配度']),
    })
  }

  private collectFallbackLines(values: unknown[], fallback: string[]) {
    const normalized = values
      .flatMap((value) => {
        if (Array.isArray(value)) {
          return value.map((item) => this.toShortText(String(item)))
        }

        if (typeof value === 'string') {
          return [this.toShortText(value)]
        }

        return []
      })
      .filter(Boolean)

    return Array.from(new Set([...normalized, ...fallback])).slice(0, 4)
  }

  private parseInsightPayload(rawText: string): Partial<GeoInsightSummaryPayload> {
    const normalized = rawText.trim()
    const fencedMatch = normalized.match(/```json\s*([\s\S]*?)```/i) || normalized.match(/```\s*([\s\S]*?)```/i)
    const candidate = fencedMatch?.[1]?.trim() || normalized
    const firstBrace = candidate.indexOf('{')
    const lastBrace = candidate.lastIndexOf('}')

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new BadRequestException('AI 返回内容无法解析为结构化 JSON，请稍后重试')
    }

    const jsonText = candidate.slice(firstBrace, lastBrace + 1)
    return this.tryParseInsightJson(jsonText)
  }

  private tryParseInsightJson(jsonText: string): Partial<GeoInsightSummaryPayload> {
    try {
      return JSON.parse(jsonText) as Partial<GeoInsightSummaryPayload>
    } catch (error) {
      const repaired = this.repairInsightJsonText(jsonText)
      if (repaired !== jsonText) {
        try {
          return JSON.parse(repaired) as Partial<GeoInsightSummaryPayload>
        } catch {
          // Ignore and fall through to the original parse error below.
        }
      }

      throw error
    }
  }

  private repairInsightJsonText(jsonText: string) {
    return jsonText
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/，/g, ',')
      .replace(/：/g, ':')
      .replace(/,\s*([}\]])/g, '$1')
  }

  private isInsightTimeoutError(error: unknown) {
    return (
      error instanceof Error &&
      (error.name === 'APIConnectionTimeoutError' || error.name === INSIGHT_TIMEOUT_ERROR_NAME)
    )
  }

  private isInsightParseError(error: unknown) {
    return error instanceof SyntaxError || error instanceof BadRequestException
  }

  private buildInsightOutputSchema() {
    const stringArraySchema = {
      type: 'array',
      items: {
        type: 'string',
      },
      minItems: 2,
      maxItems: 4,
    }

    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        rawSummary: {
          type: 'string',
        },
        titlePatterns: stringArraySchema,
        leadPatterns: stringArraySchema,
        sectionBlueprint: stringArraySchema,
        keywordPlacement: stringArraySchema,
        sellingPointOrder: stringArraySchema,
        trustSignals: stringArraySchema,
        endingPatterns: stringArraySchema,
        antiPatterns: stringArraySchema,
        rankingHypotheses: stringArraySchema,
      },
      required: [
        'rawSummary',
        'titlePatterns',
        'leadPatterns',
        'sectionBlueprint',
        'keywordPlacement',
        'sellingPointOrder',
        'trustSignals',
        'endingPatterns',
        'antiPatterns',
        'rankingHypotheses',
      ],
    }
  }

  private shouldUseInsightFormatterFallback(model: string) {
    const normalizedModel = model.trim().toLowerCase()
    return normalizedModel.includes('opus')
  }

  private async generateInsightWithFallbackModel(
    systemPrompt: string,
    userMessage: string,
    config: GeoProviderConfig,
    maxTokens: number
  ): Promise<InsightExecutionResult> {
    const client = this.createAnthropicClient(config)
    const response = await this.runInsightRequest(
      client.messages.create({
        model: INSIGHT_FORMATTER_FALLBACK_MODEL,
        max_tokens: maxTokens,
        temperature: 0,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userMessage,
          },
        ],
        output_config: {
          format: {
            type: 'json_schema',
            schema: this.buildInsightOutputSchema(),
          },
        },
      })
    )

    const outputText = response.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('\n')
      .trim()

    return {
      insight: this.normalizeInsightPayload(this.parseInsightPayload(outputText)),
      model: INSIGHT_FORMATTER_FALLBACK_MODEL,
    }
  }

  private async repairInsightWithFallbackModel(rawContent: string, config: GeoProviderConfig) {
    const client = this.createAnthropicClient(config)
    const response = await this.runInsightRequest(
      client.messages.create({
        model: INSIGHT_FORMATTER_FALLBACK_MODEL,
        max_tokens: 1800,
        temperature: 0,
        system: buildInsightRepairSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: buildInsightRepairUserMessage({
              rawContent: rawContent.slice(0, 6000),
            }),
          },
        ],
        output_config: {
          format: {
            type: 'json_schema',
            schema: this.buildInsightOutputSchema(),
          },
        },
      })
    )

    const outputText = response.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('\n')
      .trim()

    return this.normalizeInsightPayload(this.parseInsightPayload(outputText))
  }

  private async findActiveRuleCardByCategory(category: string) {
    const normalizedCategory = category.trim()
    if (!normalizedCategory) return null

    return this.prisma.geoRuleCard.findFirst({
      where: {
        category: normalizedCategory,
        isActive: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    })
  }

  private toRuleCardPromptContext(ruleCard: GeoRuleCard | null) {
    if (!ruleCard) return null

    return {
      category: ruleCard.category,
      rawSummary: ruleCard.rawSummary,
      titlePatterns: this.toLimitedStringArray(ruleCard.titlePatterns),
      leadPatterns: this.toLimitedStringArray(ruleCard.leadPatterns),
      sectionBlueprint: this.toLimitedStringArray(ruleCard.sectionBlueprint),
      keywordPlacement: this.toLimitedStringArray(ruleCard.keywordPlacement),
      sellingPointOrder: this.toLimitedStringArray(ruleCard.sellingPointOrder),
      trustSignals: this.toLimitedStringArray(ruleCard.trustSignals),
      endingPatterns: this.toLimitedStringArray(ruleCard.endingPatterns),
      antiPatterns: this.toLimitedStringArray(ruleCard.antiPatterns),
      rankingHypotheses: this.toLimitedStringArray(ruleCard.rankingHypotheses),
    }
  }

  private isBaijiahaoArticleUrl(url: string) {
    try {
      return new URL(url).hostname === 'baijiahao.baidu.com'
    } catch {
      return false
    }
  }

  private extractDomain(url: string) {
    try {
      return new URL(url).hostname
    } catch {
      return ''
    }
  }

  private rethrowProfileConflict(error: unknown): never {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('档案名称已存在')
    }

    throw error
  }
}
