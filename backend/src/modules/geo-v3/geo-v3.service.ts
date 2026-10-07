import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import JSZip = require('jszip')
import {
  GeoPromptV3FixedRulesMode,
  GeoPromptV3ItemStatus,
  GeoPromptV3RunMode,
  GeoPromptV3RunStatus,
  GeoPromptV3VariablePickMode,
  type GeoMainProductProfileV3,
  type GeoProviderConfig,
  type GeoPromptEngineV3Version,
  type GeoPromptV3BatchTxtJob,
  type GeoPromptV3BatchTxtJobItem,
  type GeoPromptV3VersionDraftSession,
  type GeoPromptVariableItem,
  type GeoPromptVariableSet,
  type Prisma,
} from '@prisma/client'
import type { Request, Response } from 'express'
import { PrismaService } from '../../common/prisma.service'
import { fetchArticle } from '../geo/core/fetch'
import { DEFAULT_PROMPT_ENGINE_V2_FIXED_RULES } from '../geo/core/prompt-v2'
import {
  buildDefaultPromptV3FixedRules,
  buildPromptV3GenerateSystemPrompt,
  buildPromptV3GenerateUserMessage,
  buildPromptV3VersionDraftApplySystemPrompt,
  buildPromptV3VersionDraftApplyUserMessage,
  buildPromptV3VersionDraftChatSystemPrompt,
  buildPromptV3VersionDraftChatUserMessage,
  buildPromptV3VersionDraftRepairSystemPrompt,
  buildPromptV3VersionDraftRepairUserMessage,
  buildPromptV3VersionDraftSystemPrompt,
  buildPromptV3VersionDraftUserMessage,
  buildPromptV3VariableSetDraftSystemPrompt,
  buildPromptV3VariableSetDraftUserMessage,
  normalizePromptV3GeneratedOutput,
  PROMPT_V3_TECHNICAL_GUARD_RULES,
  resolvePromptV3BrandPoolPickRange,
  selectPromptV3ProductContent,
  selectPromptV3Variables,
  type PromptV3FixedRulesMode,
  type PromptV3ProductInput,
  type PromptV3SelectedProductContent,
  type PromptV3SelectedVariable,
  type PromptV3VariableItemInput,
  type PromptV3VersionInput,
  type PromptV3VersionDraftVariableSet,
  type PromptV3VersionDraftMessage,
} from '../geo/core/prompt-v3'
import {
  GeoV3BatchTxtJobDto,
  GeoV3GenerateDto,
  GeoV3ProductDto,
  GeoV3VariableSetDraftDto,
  GeoV3VariableSetDto,
  GeoV3VersionBatchActionDto,
  GeoV3VersionDraftChatDto,
  GeoV3VersionDraftDto,
  GeoV3VersionDraftSessionApplyDto,
  GeoV3VersionDraftSessionDto,
  GeoV3VersionDraftSessionImportV2Dto,
  GeoV3VersionDto,
  UpdateGeoV3FixedRulesDto,
  UpdateGeoV3ProductDto,
  UpdateGeoV3VariableSetDto,
  UpdateGeoV3VersionDto,
} from './dto/geo-v3.dto'

const DEFAULT_MODEL = 'claude-opus-4-6-20250219'
const DEFAULT_VERSION_DRAFT_MODEL = 'claude-opus-4-8'
const VERSION_DRAFT_REPAIR_MODEL = 'claude-3-5-sonnet-20241022'
const DEFAULT_REQUEST_TIMEOUT_MS = 75_000
const BATCH_VERSION_DRAFT_REQUEST_TIMEOUT_MS = 300_000
const BATCH_VERSION_DRAFT_MAX_ATTEMPTS = 3
const BATCH_VERSION_DRAFT_RETRY_DELAYS_MS = [10_000, 30_000]
const BATCH_VERSION_DRAFT_UPSTREAM_COOLDOWN_MS = 60_000
const DEFAULT_VERSION_DRAFT_STREAM_MAX_TOKENS = 2800
const DEFAULT_VERSION_DRAFT_MAX_TOKENS = 4200
const DEFAULT_VERSION_DRAFT_REPAIR_MAX_TOKENS = 2400
const DEFAULT_GENERATE_V3_MAX_TOKENS = 8192
const GENERATE_V3_REQUEST_TIMEOUT_MS = 180_000
const GENERATE_V3_CONCURRENCY = 4
const GENERATE_V3_MAX_ATTEMPTS_PER_ITEM = 3
const MAX_SHORT_TEXT_LENGTH = 180
const BATCH_TXT_MAX_FILES = 20
const BATCH_TXT_MAX_ARTICLE_LENGTH = 120_000
const BATCH_DRAFT_FILE_EXTENSIONS = ['.txt', '.md']
const MIN_USABLE_RULE_TEXT_LENGTH = 2000

type VariableSetWithItems = GeoPromptVariableSet & {
  items: GeoPromptVariableItem[]
}

type VersionWithVariableSets = GeoPromptEngineV3Version & {
  variableSets?: VariableSetWithItems[]
}

type VersionDraftSuggestion = {
  name: string
  description: string
  sourceArticleTitle: string
  ruleText: string
  notes: string
  variableSetDraft: PromptV3VersionDraftVariableSet
}

type VersionDraftSessionStatus = 'ACTIVE' | 'APPLIED' | 'ARCHIVED'
type VersionDraftSessionSourceType = 'MANUAL_CHAT' | 'V2_IMPORT' | 'TXT_BATCH'
type BatchTxtJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'PARTIAL_FAILED' | 'FAILED'
type BatchTxtJobItemStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'SKIPPED' | 'FAILED'

type BatchTxtJobWithItems = GeoPromptV3BatchTxtJob & {
  items?: GeoPromptV3BatchTxtJobItem[]
}

class BatchVersionDraftRequestError extends Error {
  constructor(
    readonly providerError: unknown,
    readonly attempts: number,
    readonly elapsedMs: number
  ) {
    super(providerError instanceof Error ? providerError.message : String(providerError || '批量建版请求失败'))
    this.name = 'BatchVersionDraftRequestError'
  }
}

type PromptV3GenerationExecutionContext = {
  count: number
  dateCode: string
  providerConfig: GeoProviderConfig
  article: string
  fixedRules: string
  fixedRulesMode: PromptV3FixedRulesMode
  version: PromptV3VersionInput
  variableSetName: string
  variableItems: PromptV3VariableItemInput[]
  product: PromptV3ProductInput
  topic: string
  extraRequirements: string
  versionName: string
  productProfileName: string
}

@Injectable()
export class GeoV3Service implements OnModuleInit {
  private batchTxtQueuePromise: Promise<void> | null = null
  private batchTxtUpstreamCooldownUntil = 0

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.recoverPromptV3GenerationRuns()
    await this.recoverBatchTxtJobs()
    this.scheduleBatchTxtQueue()
  }

  async findFixedRules() {
    const fixedRules = await this.ensurePromptV3FixedRules()
    return this.toFixedRulesView(fixedRules)
  }

  async updateFixedRules(payload: UpdateGeoV3FixedRulesDto) {
    const fallbackRules = await this.resolvePromptV3DefaultFixedRules()
    const fixedRules = await this.prisma.geoPromptEngineV3FixedRules.upsert({
      where: { id: 1 },
      update: {
        ruleText: payload.ruleText.trim() || fallbackRules,
      },
      create: {
        id: 1,
        ruleText: payload.ruleText.trim() || fallbackRules,
      },
    })

    return this.toFixedRulesView(fixedRules)
  }

  async findVersions() {
    const versions = await this.prisma.geoPromptEngineV3Version.findMany({
      where: {
        archivedAt: null,
      },
      include: {
        variableSets: {
          include: {
            items: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            },
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    })

    return versions.map((version) => this.toVersionView(version))
  }

  async createVersion(payload: GeoV3VersionDto) {
    const version = await this.prisma.geoPromptEngineV3Version.create({
      data: this.toVersionCreateInput(payload),
    })

    return this.toVersionView(version)
  }

  async updateVersion(id: number, payload: UpdateGeoV3VersionDto) {
    await this.findVersionRecord(id)

    const version = await this.prisma.geoPromptEngineV3Version.update({
      where: { id },
      data: this.toVersionUpdateInput(payload),
    })

    return this.toVersionView(version)
  }

  async batchUpdateVersions(payload: GeoV3VersionBatchActionDto) {
    const ids = [...new Set(payload.ids.filter((id) => Number.isInteger(id) && id > 0))]
    if (ids.length === 0) throw new BadRequestException('请至少选择一个 V3 版本')

    const data = payload.action === 'ARCHIVE'
      ? { isActive: false, archivedAt: new Date() }
      : { isActive: false }
    const result = await this.prisma.geoPromptEngineV3Version.updateMany({
      where: {
        id: { in: ids },
        archivedAt: null,
      },
      data,
    })

    return {
      action: payload.action,
      requestedCount: ids.length,
      affectedCount: result.count,
      ids,
    }
  }

  async removeVersion(id: number) {
    const version = await this.findVersionRecord(id)
    if (!version.archivedAt) {
      await this.prisma.geoPromptEngineV3Version.update({
        where: { id },
        data: {
          isActive: false,
          archivedAt: new Date(),
        },
      })
    }
    return { id, success: true, archived: true }
  }

  async createVersionDraft(payload: GeoV3VersionDraftDto) {
    const articleText = payload.articleText?.trim()
    const articleUrl = payload.articleUrl?.trim()

    if (!articleText && !articleUrl) {
      throw new BadRequestException('请提供竞对文章正文或 URL')
    }

    const article = articleText || await fetchArticle(articleUrl!)
    const providerConfig = await this.prisma.geoProviderConfig.findUnique({ where: { id: 1 } })

    if (!providerConfig?.apiKey?.trim()) {
      return this.buildLocalVersionDraft(article, articleUrl, payload.notes)
    }

    const client = this.createAnthropicClient(providerConfig)
    const response = await client.messages.create({
      model: providerConfig.model || DEFAULT_MODEL,
      max_tokens: DEFAULT_VERSION_DRAFT_MAX_TOKENS,
      temperature: 0,
      system: buildPromptV3VersionDraftSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: buildPromptV3VersionDraftUserMessage({
            article,
            sourceArticleUrl: articleUrl,
            notes: payload.notes,
          }),
        },
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: this.buildVersionDraftOutputSchema(),
        },
      },
    })
    const outputText = this.readAnthropicText(response)
    const suggestion = this.normalizeVersionDraftSuggestion(
      await this.parseVersionDraftSuggestionWithRepair(outputText, providerConfig)
    )

    return {
      ...suggestion,
      sourceArticleUrl: articleUrl ?? '',
    }
  }

  async streamVersionDraftChat(
    payload: GeoV3VersionDraftChatDto,
    request: Request,
    response: Response
  ) {
    const messages = this.normalizeVersionDraftMessages(payload.messages ?? [])
    if (messages.length === 0) {
      response.status(400).json({ error: '请先输入想和 AI 讨论的问题' })
      return
    }

    const providerConfig = await this.prisma.geoProviderConfig.findUnique({ where: { id: 1 } })
    if (!providerConfig?.apiKey?.trim()) {
      response.status(400).json({ error: '请先完成 Anthropic 配置后再使用 V3 AI 对话创建版本' })
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

    response.status(200)
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache')
    response.setHeader('Connection', 'keep-alive')
    response.setHeader('X-Accel-Buffering', 'no')
    response.flushHeaders()

    const client = this.createAnthropicClient(providerConfig)
    const stream = client.messages.stream({
      model: this.resolveVersionDraftModel(payload.model, providerConfig.model),
      max_tokens: DEFAULT_VERSION_DRAFT_STREAM_MAX_TOKENS,
      temperature: 0.2,
      system: buildPromptV3VersionDraftChatSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: buildPromptV3VersionDraftChatUserMessage({
            articleText,
            notes: payload.notes,
            messages,
          }),
        },
      ],
    })

    await this.pipeTextStreamToSse(stream, request, response)
  }

  async applyVersionDraftChat(
    payload: GeoV3VersionDraftChatDto,
    options: { timeout?: number; maxRetries?: number; preserveProviderError?: boolean } = {}
  ) {
    const messages = this.normalizeVersionDraftMessages(payload.messages ?? [])
    if (messages.length === 0 && !payload.articleText?.trim() && !payload.articleUrl?.trim()) {
      throw new BadRequestException('请先提供文章或完成一轮 AI 对话')
    }

    const providerConfig = await this.prisma.geoProviderConfig.findUnique({ where: { id: 1 } })
    if (!providerConfig?.apiKey?.trim()) {
      throw new BadRequestException('请先完成 Anthropic 配置后再应用 V3 AI 对话结果')
    }

    let articleText = ''
    try {
      articleText = await this.resolveVersionDraftArticleText(payload.articleText, payload.articleUrl)
    } catch (error) {
      const fallbackSuggestion = this.buildPromptV3VersionDraftFallbackSuggestion(messages, payload.notes)
      if (fallbackSuggestion) {
        return {
          ...fallbackSuggestion,
          ruleText: this.ensureUsablePromptV3RuleText(fallbackSuggestion.ruleText),
          sourceArticleUrl: payload.articleUrl?.trim() ?? '',
        }
      }

      throw new BadRequestException(
        error instanceof Error ? error.message : '参考文章抓取失败，请尝试手动粘贴文章内容'
      )
    }

    const client = this.createAnthropicClient(providerConfig, options)
    let apiResponse: Anthropic.Messages.Message

    try {
      apiResponse = await client.messages.create({
        model: this.resolveVersionDraftModel(payload.model, providerConfig.model),
        max_tokens: DEFAULT_VERSION_DRAFT_MAX_TOKENS,
        temperature: 0,
        system: buildPromptV3VersionDraftApplySystemPrompt(),
        messages: [
          {
            role: 'user',
            content: buildPromptV3VersionDraftApplyUserMessage({
              articleText,
              sourceArticleUrl: payload.articleUrl?.trim(),
              notes: payload.notes,
              messages,
            }),
          },
        ],
        output_config: {
          format: {
            type: 'json_schema',
            schema: this.buildVersionDraftOutputSchema(),
          },
        },
      })
    } catch (error) {
      const fallbackSuggestion = this.buildPromptV3VersionDraftFallbackSuggestion(messages, payload.notes)
      if (fallbackSuggestion) {
        return {
          ...fallbackSuggestion,
          ruleText: this.ensureUsablePromptV3RuleText(fallbackSuggestion.ruleText),
          sourceArticleUrl: payload.articleUrl?.trim() ?? '',
        }
      }

      if (options.preserveProviderError) throw error
      throw new BadRequestException(error instanceof Error ? error.message : '应用 V3 AI 对话结果失败，请稍后重试')
    }

    const outputText = this.readAnthropicText(apiResponse)
    let suggestion: VersionDraftSuggestion

    try {
      suggestion = this.normalizeVersionDraftSuggestion(
        await this.parseVersionDraftSuggestionWithRepair(outputText, providerConfig)
      )
    } catch (error) {
      const fallbackSuggestion = this.buildPromptV3VersionDraftFallbackSuggestion(messages, payload.notes)
      if (fallbackSuggestion) {
        return {
          ...fallbackSuggestion,
          ruleText: this.ensureUsablePromptV3RuleText(fallbackSuggestion.ruleText),
          sourceArticleUrl: payload.articleUrl?.trim() ?? '',
        }
      }

      throw error
    }

    return {
      ...suggestion,
      ruleText: this.ensureUsablePromptV3RuleText(suggestion.ruleText),
      sourceArticleUrl: payload.articleUrl?.trim() ?? '',
    }
  }

  async createVariableSetDraft(payload: GeoV3VariableSetDraftDto) {
    const rawContent = payload.rawContent?.trim() ?? ''
    const ruleText = payload.ruleText?.trim() ?? ''
    const notes = payload.notes?.trim() ?? ''
    const fallbackName = `${this.toShortText(payload.versionName?.trim() || 'V3 差异化', 30)}变量池`

    if (!rawContent && !ruleText && !notes) {
      throw new BadRequestException('请先提供版本规则或 AI 对话内容，再整理变量池')
    }

    const localDraft = this.parsePromptV3VersionDraftFallbackContent(
      [rawContent, ruleText].filter(Boolean).join('\n\n'),
      fallbackName
    ).variableSetDraft
    const providerConfig = await this.prisma.geoProviderConfig.findUnique({ where: { id: 1 } })

    if (!providerConfig?.apiKey?.trim()) {
      if (localDraft.items.length > 0) return localDraft
      throw new BadRequestException('请先完成 Anthropic 配置后再自动整理变量池')
    }

    const client = this.createAnthropicClient(providerConfig)

    try {
      const response = await client.messages.create({
        model: this.resolveVersionDraftModel(payload.model, providerConfig.model),
        max_tokens: DEFAULT_VERSION_DRAFT_REPAIR_MAX_TOKENS,
        temperature: 0,
        system: buildPromptV3VariableSetDraftSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: buildPromptV3VariableSetDraftUserMessage({
              versionName: payload.versionName,
              ruleText,
              rawContent,
              notes,
            }),
          },
        ],
        output_config: {
          format: {
            type: 'json_schema',
            schema: this.buildVariableSetDraftOutputSchema(),
          },
        },
      })
      const aiDraft = this.parseVariableSetDraftFromText(this.readAnthropicText(response), fallbackName)

      if (aiDraft.items.length > 0 || localDraft.items.length === 0) return aiDraft
      return localDraft
    } catch (error) {
      if (localDraft.items.length > 0) return localDraft
      throw new BadRequestException(error instanceof Error ? error.message : '变量池自动整理失败，请稍后重试')
    }
  }

  async findVersionDraftSessions() {
    const sessions = await this.prisma.geoPromptV3VersionDraftSession.findMany({
      where: {
        status: {
          not: 'ARCHIVED',
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    })

    return sessions.map((session) => this.toVersionDraftSessionView(session))
  }

  async findVersionDraftSession(id: number) {
    const session = await this.findVersionDraftSessionRecord(id, true)
    return this.toVersionDraftSessionView(session)
  }

  async createVersionDraftSession(payload: GeoV3VersionDraftSessionDto) {
    const providerConfig = await this.prisma.geoProviderConfig.findUnique({ where: { id: 1 } })
    const messages = this.normalizeVersionDraftMessages(payload.messages ?? [])
    const session = await this.prisma.geoPromptV3VersionDraftSession.create({
      data: {
        title: this.toVersionDraftSessionTitle(payload.title, messages, payload.articleUrl, payload.notes),
        articleText: payload.articleText?.trim() ?? '',
        articleUrl: payload.articleUrl?.trim() ?? '',
        notes: payload.notes?.trim() ?? '',
        model: this.resolveVersionDraftModel(payload.model, providerConfig?.model),
        messages: this.toVersionDraftMessageJson(messages),
        status: payload.status ?? 'ACTIVE',
        ownerUserId: payload.ownerUserId ?? null,
        ownerName: payload.ownerName?.trim() ?? '',
        suggestedName: payload.suggestedName?.trim() ?? '',
        suggestedDescription: payload.suggestedDescription?.trim() ?? '',
        suggestedRuleText: this.sanitizeVersionDraftRuleText(payload.suggestedRuleText ?? ''),
        suggestedVariableSetDraft: this.toVersionDraftVariableSetJson(
          this.normalizeVersionDraftVariableSet(payload.suggestedVariableSetDraft)
        ),
        sourceType: payload.sourceType ?? 'MANUAL_CHAT',
      },
    })

    return this.toVersionDraftSessionView(session)
  }

  async updateVersionDraftSession(id: number, payload: GeoV3VersionDraftSessionDto) {
    await this.findVersionDraftSessionRecord(id, true)

    const data: Prisma.GeoPromptV3VersionDraftSessionUpdateInput = {}

    if (payload.title !== undefined) data.title = this.toShortText(payload.title || '未命名会话', 120)
    if (payload.articleText !== undefined) data.articleText = payload.articleText.trim()
    if (payload.articleUrl !== undefined) data.articleUrl = payload.articleUrl.trim()
    if (payload.notes !== undefined) data.notes = payload.notes.trim()
    if (payload.model !== undefined) data.model = this.resolveVersionDraftModel(payload.model)
    if (payload.messages !== undefined) {
      data.messages = this.toVersionDraftMessageJson(this.normalizeVersionDraftMessages(payload.messages))
      if (
        payload.status === undefined &&
        payload.suggestedRuleText === undefined &&
        payload.suggestedVariableSetDraft === undefined
      ) {
        data.status = 'ACTIVE'
        data.suggestedName = ''
        data.suggestedDescription = ''
        data.suggestedRuleText = ''
        data.suggestedVariableSetDraft = this.toVersionDraftVariableSetJson(
          this.normalizeVersionDraftVariableSet(null)
        )
      }
    }
    if (payload.status !== undefined) data.status = payload.status
    if (payload.ownerUserId !== undefined) data.ownerUserId = payload.ownerUserId
    if (payload.ownerName !== undefined) data.ownerName = payload.ownerName.trim()
    if (payload.suggestedName !== undefined) data.suggestedName = payload.suggestedName.trim()
    if (payload.suggestedDescription !== undefined) data.suggestedDescription = payload.suggestedDescription.trim()
    if (payload.sourceType !== undefined) data.sourceType = payload.sourceType
    if (payload.suggestedRuleText !== undefined) {
      data.suggestedRuleText = this.sanitizeVersionDraftRuleText(payload.suggestedRuleText)
    }
    if (payload.suggestedVariableSetDraft !== undefined) {
      data.suggestedVariableSetDraft = this.toVersionDraftVariableSetJson(
        this.normalizeVersionDraftVariableSet(payload.suggestedVariableSetDraft)
      )
    }

    const session = await this.prisma.geoPromptV3VersionDraftSession.update({
      where: { id },
      data,
    })

    return this.toVersionDraftSessionView(session)
  }

  async removeVersionDraftSession(id: number) {
    await this.findVersionDraftSessionRecord(id, true)

    const session = await this.prisma.geoPromptV3VersionDraftSession.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
      },
    })

    return this.toVersionDraftSessionView(session)
  }

  async importVersionDraftSessionFromV2(payload: GeoV3VersionDraftSessionImportV2Dto) {
    const source = await this.prisma.geoPromptEngineVersionDraftSession.findUnique({
      where: { id: payload.sourceSessionId },
    })

    if (!source || source.status === 'ARCHIVED') {
      throw new NotFoundException('V2 AI 对话会话不存在')
    }

    const existing = await this.prisma.geoPromptV3VersionDraftSession.findFirst({
      where: {
        sourceV2SessionId: source.id,
        status: {
          not: 'ARCHIVED',
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    })

    if (existing) {
      return this.toVersionDraftSessionView(existing)
    }

    const messages = this.readVersionDraftMessages(source.messages as Prisma.JsonValue)
    const variableSetDraft = this.normalizeVersionDraftVariableSet(null, source.suggestedName || source.title)
    const session = await this.prisma.geoPromptV3VersionDraftSession.create({
      data: {
        title: this.toShortText(`V2 导入：${source.title}`, 120),
        articleText: source.articleText,
        articleUrl: source.articleUrl,
        notes: source.notes,
        model: source.model,
        messages: this.toVersionDraftMessageJson(messages),
        status: 'ACTIVE',
        ownerUserId: source.ownerUserId,
        ownerName: source.ownerName,
        suggestedName: source.suggestedName,
        suggestedDescription: source.suggestedDescription,
        suggestedRuleText: source.suggestedRuleText,
        suggestedVariableSetDraft: this.toVersionDraftVariableSetJson(variableSetDraft),
        sourceV2SessionId: source.id,
        sourceType: 'V2_IMPORT',
      },
    })

    return this.toVersionDraftSessionView(session)
  }

  async streamVersionDraftSessionChat(id: number, request: Request, response: Response) {
    const providerConfig = await this.prisma.geoProviderConfig.findUnique({ where: { id: 1 } })
    if (!providerConfig?.apiKey?.trim()) {
      response.status(400).json({ error: '请先完成 Anthropic 配置后再使用 V3 AI 对话创建版本' })
      return
    }

    const session = await this.findVersionDraftSessionRecord(id)
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

    response.status(200)
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache')
    response.setHeader('Connection', 'keep-alive')
    response.setHeader('X-Accel-Buffering', 'no')
    response.flushHeaders()

    const client = this.createAnthropicClient(providerConfig)
    const stream = client.messages.stream({
      model: this.resolveVersionDraftModel(session.model, providerConfig.model),
      max_tokens: DEFAULT_VERSION_DRAFT_STREAM_MAX_TOKENS,
      temperature: 0.2,
      system: buildPromptV3VersionDraftChatSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: buildPromptV3VersionDraftChatUserMessage({
            articleText,
            notes: session.notes,
            messages,
          }),
        },
      ],
    })

    await this.pipeTextStreamToSse(stream, request, response)
  }

  async applyVersionDraftSession(id: number, payload: GeoV3VersionDraftSessionApplyDto = {}) {
    const session = await this.findVersionDraftSessionRecord(id)
    const messages = this.readVersionDraftMessages(session.messages as Prisma.JsonValue)
    const cachedVariableSetDraft = this.normalizeVersionDraftVariableSet(session.suggestedVariableSetDraft)
    const feedback = this.toLongText(payload.feedback)
    const shouldUseCache = !payload.forceRefresh && !feedback

    const cachedRuleText = this.sanitizeVersionDraftRuleText(session.suggestedRuleText)

    if (shouldUseCache && cachedRuleText) {
      const cachedSuggestion = this.normalizeVersionDraftSuggestion({
        name: session.suggestedName || session.title,
        description: session.suggestedDescription,
        sourceArticleTitle: '',
        ruleText: cachedRuleText,
        notes: session.notes,
        variableSetDraft: cachedVariableSetDraft,
      })

      if (session.status !== 'APPLIED') {
        await this.prisma.geoPromptV3VersionDraftSession.update({
          where: { id },
          data: { status: 'APPLIED' },
        })
      }

      return {
        ...cachedSuggestion,
        sourceArticleUrl: session.articleUrl,
      }
    }

    const applyMessages = feedback
      ? [
        ...messages,
        {
          role: 'user' as const,
          content: [
            '请重新整理“应用到编辑区”的正式结果。',
            '这条反馈只用于本次整理，不要把这段反馈原文写进 ruleText：',
            feedback,
          ].join('\n'),
          createdAt: new Date().toISOString(),
        },
      ]
      : messages

    const fallbackSuggestion = feedback
      ? null
      : this.buildPromptV3VersionDraftFallbackSuggestion(applyMessages, session.notes)
    if (fallbackSuggestion) {
      const fallbackRuleText = this.ensureUsablePromptV3RuleText(fallbackSuggestion.ruleText)
      await this.prisma.geoPromptV3VersionDraftSession.update({
        where: { id },
        data: {
          status: 'APPLIED',
          suggestedName: fallbackSuggestion.name,
          suggestedDescription: fallbackSuggestion.description,
          suggestedRuleText: fallbackRuleText,
          suggestedVariableSetDraft: this.toVersionDraftVariableSetJson(fallbackSuggestion.variableSetDraft),
        },
      })

      return {
        ...fallbackSuggestion,
        ruleText: fallbackRuleText,
        sourceArticleUrl: session.articleUrl,
      }
    }

    if (messages.length === 0 && !session.articleText.trim() && !session.articleUrl.trim()) {
      throw new BadRequestException('先提供文章或和模型聊出一版可用规则，再应用到草稿')
    }

    const suggestion = await this.applyVersionDraftChat({
      messages: applyMessages.map((item) => ({
        role: item.role,
        content: item.content,
        createdAt: item.createdAt,
      })),
      articleText: session.articleText,
      articleUrl: session.articleUrl,
      notes: session.notes,
      model: session.model,
    })
    const ruleText = this.ensureUsablePromptV3RuleText(suggestion.ruleText)

    await this.prisma.geoPromptV3VersionDraftSession.update({
      where: { id },
      data: {
        status: 'APPLIED',
        suggestedName: suggestion.name,
        suggestedDescription: suggestion.description,
        suggestedRuleText: ruleText,
        suggestedVariableSetDraft: this.toVersionDraftVariableSetJson(suggestion.variableSetDraft),
      },
    })

    return {
      ...suggestion,
      ruleText,
    }
  }

  async createVersionDraftBatchTxtJob(payload: GeoV3BatchTxtJobDto) {
    const files = this.normalizeBatchTxtFiles(payload)
    const requirements = this.normalizeBatchTxtRequirements(payload.requirements)
    const providerConfig = await this.prisma.geoProviderConfig.findUnique({ where: { id: 1 } })
    const model = this.resolveVersionDraftModel(payload.model, providerConfig?.model)

    const job = await this.prisma.geoPromptV3BatchTxtJob.create({
      data: {
        productCategory: this.toShortText(payload.productCategory || '防晒衣', 80),
        requirements: requirements as unknown as Prisma.InputJsonValue,
        model,
        status: 'QUEUED',
        requestedCount: files.length,
        successCount: 0,
        skippedCount: 0,
        failedCount: 0,
        runningCount: 0,
        lastError: '',
        ownerUserId: null,
        ownerName: '',
        items: {
          create: files.map((file, index) => ({
            itemIndex: index + 1,
            fileName: file.fileName,
            versionName: file.versionName,
            articleText: file.content,
            status: 'QUEUED',
            errorMessage: '',
          })),
        },
      },
      include: {
        items: {
          orderBy: [{ itemIndex: 'asc' }],
        },
      },
    })

    this.scheduleBatchTxtQueue()

    return this.toBatchTxtJobView(job, true)
  }

  async findVersionDraftBatchTxtJob(id: number) {
    const job = await this.prisma.geoPromptV3BatchTxtJob.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: [{ itemIndex: 'asc' }],
        },
      },
    })

    if (!job) throw new NotFoundException('TXT/MD 批量建版任务不存在')
    return this.toBatchTxtJobView(job, true)
  }

  async retryFailedVersionDraftBatchTxtJob(id: number) {
    const job = await this.prisma.geoPromptV3BatchTxtJob.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: [{ itemIndex: 'asc' }],
        },
      },
    })

    if (!job) throw new NotFoundException('TXT/MD 批量建版任务不存在')
    if (!this.isBatchTxtJobTerminal(job.status)) {
      throw new BadRequestException('任务仍在等待或生成中，无需重复提交')
    }

    const failedItems = job.items.filter((item) => item.status === 'FAILED')
    if (failedItems.length === 0) {
      throw new BadRequestException('当前任务没有可重试的失败项')
    }

    await this.prisma.$transaction([
      this.prisma.geoPromptV3BatchTxtJobItem.updateMany({
        where: {
          jobId: id,
          status: 'FAILED',
        },
        data: {
          status: 'QUEUED',
          errorMessage: '',
          versionId: null,
          variableSetId: null,
          draftSessionId: null,
          startedAt: null,
          completedAt: null,
        },
      }),
      this.prisma.geoPromptV3BatchTxtJob.update({
        where: { id },
        data: {
          status: 'QUEUED',
          lastError: '',
          runningCount: 0,
          completedAt: null,
        },
      }),
    ])

    await this.refreshBatchTxtJobProgress(id)
    this.scheduleBatchTxtQueue()
    return this.findVersionDraftBatchTxtJob(id)
  }

  private scheduleBatchTxtQueue() {
    if (this.batchTxtQueuePromise) return

    this.batchTxtQueuePromise = this.drainBatchTxtQueue()
      .catch((error) => {
        console.error('[GeoV3] Batch TXT queue stopped unexpectedly', error)
      })
      .finally(() => {
        this.batchTxtQueuePromise = null
        void this.restartBatchTxtQueueIfNeeded()
      })
  }

  private async restartBatchTxtQueueIfNeeded() {
    try {
      const pendingJob = await this.prisma.geoPromptV3BatchTxtJob.findFirst({
        where: {
          status: {
            in: ['QUEUED', 'RUNNING'],
          },
        },
        select: { id: true },
      })
      if (pendingJob) this.scheduleBatchTxtQueue()
    } catch (error) {
      console.error('[GeoV3] Failed to check pending TXT batch jobs', error)
    }
  }

  private async drainBatchTxtQueue() {
    while (true) {
      const job = await this.prisma.geoPromptV3BatchTxtJob.findFirst({
        where: {
          status: {
            in: ['QUEUED', 'RUNNING'],
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
      })

      if (!job) return

      try {
        await this.processBatchTxtJob(job.id)
      } catch (error) {
        console.error(`[GeoV3] Batch TXT version job ${job.id} failed unexpectedly`, error)
        await this.failBatchTxtJob(job.id, error)
      }
    }
  }

  private async processBatchTxtJob(jobId: number) {
    const job = await this.prisma.geoPromptV3BatchTxtJob.findUnique({
      where: { id: jobId },
      include: {
        items: {
          orderBy: [{ itemIndex: 'asc' }],
        },
      },
    })

    if (!job || this.isBatchTxtJobTerminal(job.status)) return

    await this.prisma.geoPromptV3BatchTxtJob.update({
      where: { id: job.id },
      data: {
        status: 'RUNNING',
        lastError: '',
        completedAt: null,
      },
    })

    for (const item of job.items) {
      const latestJob = await this.prisma.geoPromptV3BatchTxtJob.findUnique({ where: { id: job.id } })
      if (!latestJob || this.isBatchTxtJobTerminal(latestJob.status)) break
      await this.processBatchTxtJobItem(job, item)
      await this.refreshBatchTxtJobProgress(job.id)
    }

    await this.finalizeBatchTxtJob(job.id)
  }

  private async processBatchTxtJobItem(
    job: GeoPromptV3BatchTxtJob,
    item: GeoPromptV3BatchTxtJobItem
  ) {
    if (item.status !== 'QUEUED') return

    await this.prisma.geoPromptV3BatchTxtJobItem.update({
      where: { id: item.id },
      data: {
        status: 'RUNNING',
        errorMessage: '',
        startedAt: new Date(),
        completedAt: null,
      },
    })
    await this.refreshBatchTxtJobProgress(job.id)

    try {
      const existingVersion = await this.prisma.geoPromptEngineV3Version.findFirst({
        where: {
          name: item.versionName,
          archivedAt: null,
        },
        select: { id: true },
      })

      if (existingVersion) {
        await this.prisma.geoPromptV3BatchTxtJobItem.update({
          where: { id: item.id },
          data: {
            status: 'SKIPPED',
            errorMessage: '同名 V3 版本已存在，已跳过。',
            completedAt: new Date(),
          },
        })
        return
      }

      const providerConfig = await this.prisma.geoProviderConfig.findUnique({ where: { id: 1 } })
      if (!providerConfig?.apiKey?.trim()) {
        throw new BadRequestException('请先完成 Anthropic 配置后再使用 TXT/MD 批量建版')
      }

      const requirements = this.readBatchTxtRequirements(job.requirements as Prisma.JsonValue)
      const notes = this.buildBatchTxtNotes(job.productCategory, requirements)
      const userMessage = this.buildBatchTxtUserMessage(item.versionName, job.productCategory, requirements)
      const messages = this.normalizeVersionDraftMessages([
        {
          role: 'user',
          content: userMessage,
          createdAt: new Date().toISOString(),
        },
      ])
      const suggestion = await this.requestBatchTxtVersionDraftSuggestion(item.id, {
        articleText: item.articleText,
        articleUrl: '',
        notes,
        model: job.model,
        messages,
      })
      const normalizedSuggestion = this.normalizeVersionDraftSuggestion({
        ...suggestion,
        name: item.versionName,
        notes: suggestion.notes || notes,
      })
      const ruleText = this.ensureUsablePromptV3RuleText(normalizedSuggestion.ruleText)
      const assistantMessage = {
        role: 'assistant' as const,
        content: this.buildBatchTxtAssistantMessage({
          versionName: item.versionName,
          suggestion: {
            ...normalizedSuggestion,
            ruleText,
          },
        }),
        createdAt: new Date().toISOString(),
      }
      const sessionMessages = this.toVersionDraftMessageJson([...messages, assistantMessage])

      await this.prisma.$transaction(async (tx) => {
        const version = await tx.geoPromptEngineV3Version.create({
          data: this.toVersionCreateInput({
            name: item.versionName,
            description: normalizedSuggestion.description,
            sourceArticleUrl: '',
            sourceArticleText: item.articleText,
            sourceArticleTitle: normalizedSuggestion.sourceArticleTitle,
            ruleText,
            structureRules: ruleText,
            titleRules: '',
            paragraphRules: '',
            seoGeoRules: '',
            forbiddenRules: '',
            notes: notes,
            isActive: true,
            sortOrder: 0,
          }),
        })

        const variableSetDraft = this.normalizeVersionDraftVariableSet(
          normalizedSuggestion.variableSetDraft,
          `${item.versionName}变量池`
        )
        const variableSet = await tx.geoPromptVariableSet.create({
          data: {
            version: { connect: { id: version.id } },
            name: variableSetDraft.name || `${item.versionName}变量池`,
            description: variableSetDraft.description,
            isActive: variableSetDraft.isActive !== false,
            sortOrder: variableSetDraft.sortOrder ?? 0,
            items: {
              create: this.toVariableItemCreateInputs(variableSetDraft.items),
            },
          },
        })

        const session = await tx.geoPromptV3VersionDraftSession.create({
          data: {
            title: this.toShortText(`TXT/MD 批量建版：${item.versionName}`, 120),
            articleText: item.articleText,
            articleUrl: '',
            notes,
            model: this.resolveVersionDraftModel(job.model, providerConfig.model),
            messages: sessionMessages,
            status: 'APPLIED',
            ownerUserId: null,
            ownerName: '',
            suggestedName: item.versionName,
            suggestedDescription: normalizedSuggestion.description,
            suggestedRuleText: ruleText,
            suggestedVariableSetDraft: this.toVersionDraftVariableSetJson(variableSetDraft),
            sourceType: 'TXT_BATCH',
            sourceBatchTxtJobId: job.id,
            sourceBatchTxtJobItemId: item.id,
          },
        })

        await tx.geoPromptV3BatchTxtJobItem.update({
          where: { id: item.id },
          data: {
            status: 'SUCCEEDED',
            errorMessage: '',
            versionId: version.id,
            variableSetId: variableSet.id,
            draftSessionId: session.id,
            completedAt: new Date(),
          },
        })
      })
    } catch (error) {
      await this.prisma.geoPromptV3BatchTxtJobItem.update({
        where: { id: item.id },
        data: {
          status: 'FAILED',
          errorMessage: this.toPromptV3ErrorMessage(error, {
            timeout: BATCH_VERSION_DRAFT_REQUEST_TIMEOUT_MS,
          }),
          completedAt: new Date(),
        },
      })
    }
  }

  private async requestBatchTxtVersionDraftSuggestion(
    itemId: number,
    payload: GeoV3VersionDraftChatDto
  ) {
    await this.waitForBatchTxtUpstreamCooldown(itemId)

    let lastError: unknown = new Error('批量建版请求失败')
    let lastElapsedMs = 0

    for (let attempt = 1; attempt <= BATCH_VERSION_DRAFT_MAX_ATTEMPTS; attempt += 1) {
      await this.prisma.geoPromptV3BatchTxtJobItem.update({
        where: { id: itemId },
        data: {
          errorMessage: attempt > 1
            ? `正在进行第 ${attempt}/${BATCH_VERSION_DRAFT_MAX_ATTEMPTS} 次生成尝试...`
            : '',
        },
      })

      const startedAt = Date.now()
      try {
        const suggestion = await this.applyVersionDraftChat(payload, {
          timeout: BATCH_VERSION_DRAFT_REQUEST_TIMEOUT_MS,
          maxRetries: 0,
          preserveProviderError: true,
        })
        this.batchTxtUpstreamCooldownUntil = 0
        return suggestion
      } catch (error) {
        lastError = error
        lastElapsedMs = Date.now() - startedAt
        const maxAttempts = this.isLocalProviderTimeout(error)
          ? Math.min(2, BATCH_VERSION_DRAFT_MAX_ATTEMPTS)
          : BATCH_VERSION_DRAFT_MAX_ATTEMPTS
        const canRetry = this.isTransientProviderError(error) && attempt < maxAttempts

        if (!canRetry) {
          if (this.isTransientProviderError(error)) {
            this.batchTxtUpstreamCooldownUntil = Date.now() + BATCH_VERSION_DRAFT_UPSTREAM_COOLDOWN_MS
          }
          throw new BatchVersionDraftRequestError(lastError, attempt, lastElapsedMs)
        }

        const delayMs = BATCH_VERSION_DRAFT_RETRY_DELAYS_MS[
          Math.min(attempt - 1, BATCH_VERSION_DRAFT_RETRY_DELAYS_MS.length - 1)
        ]
        await this.prisma.geoPromptV3BatchTxtJobItem.update({
          where: { id: itemId },
          data: {
            errorMessage: `上游 AI 暂时不可用，${Math.round(delayMs / 1000)} 秒后自动进行第 ${attempt + 1}/${maxAttempts} 次尝试。`,
          },
        })
        await this.sleep(delayMs)
      }
    }

    throw new BatchVersionDraftRequestError(lastError, BATCH_VERSION_DRAFT_MAX_ATTEMPTS, lastElapsedMs)
  }

  private async waitForBatchTxtUpstreamCooldown(itemId: number) {
    const waitMs = this.batchTxtUpstreamCooldownUntil - Date.now()
    if (waitMs <= 0) return

    await this.prisma.geoPromptV3BatchTxtJobItem.update({
      where: { id: itemId },
      data: {
        errorMessage: `上游 AI 刚才连续异常，队列冷却 ${Math.ceil(waitMs / 1000)} 秒后会自动继续。`,
      },
    })
    await this.sleep(waitMs)
  }

  private sleep(delayMs: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, delayMs))
  }

  private async refreshBatchTxtJobProgress(jobId: number) {
    const items = await this.prisma.geoPromptV3BatchTxtJobItem.findMany({ where: { jobId } })
    const successCount = items.filter((item) => item.status === 'SUCCEEDED').length
    const skippedCount = items.filter((item) => item.status === 'SKIPPED').length
    const failedCount = items.filter((item) => item.status === 'FAILED').length
    const runningCount = items.filter((item) => item.status === 'RUNNING').length

    await this.prisma.geoPromptV3BatchTxtJob.update({
      where: { id: jobId },
      data: {
        successCount,
        skippedCount,
        failedCount,
        runningCount,
      },
    })
  }

  private async finalizeBatchTxtJob(jobId: number) {
    await this.prisma.geoPromptV3BatchTxtJobItem.updateMany({
      where: {
        jobId,
        status: {
          in: ['QUEUED', 'RUNNING'],
        },
      },
      data: {
        status: 'FAILED',
        errorMessage: '任务结束时仍未完成，请重新创建任务。',
        completedAt: new Date(),
      },
    })

    const items = await this.prisma.geoPromptV3BatchTxtJobItem.findMany({
      where: { jobId },
      orderBy: [{ itemIndex: 'asc' }],
    })
    const successCount = items.filter((item) => item.status === 'SUCCEEDED').length
    const skippedCount = items.filter((item) => item.status === 'SKIPPED').length
    const failedCount = items.filter((item) => item.status === 'FAILED').length
    const lastError = failedCount > 0
      ? [...items].reverse().find((item) => item.status === 'FAILED')?.errorMessage || '部分 TXT 建版失败'
      : ''
    const status: BatchTxtJobStatus = failedCount === 0
      ? 'COMPLETED'
      : successCount + skippedCount > 0
        ? 'PARTIAL_FAILED'
        : 'FAILED'

    await this.prisma.geoPromptV3BatchTxtJob.update({
      where: { id: jobId },
      data: {
        status,
        successCount,
        skippedCount,
        failedCount,
        runningCount: 0,
        lastError,
        completedAt: new Date(),
      },
    })
  }

  private async failBatchTxtJob(jobId: number, error: unknown) {
    const message = this.toPromptV3ErrorMessage(error)

    await this.prisma.geoPromptV3BatchTxtJobItem.updateMany({
      where: {
        jobId,
        status: {
          in: ['QUEUED', 'RUNNING'],
        },
      },
      data: {
        status: 'FAILED',
        errorMessage: message,
        completedAt: new Date(),
      },
    })

    await this.refreshBatchTxtJobProgress(jobId)
    await this.finalizeBatchTxtJob(jobId)
  }

  async findVariableSets() {
    const sets = await this.prisma.geoPromptVariableSet.findMany({
      include: {
        items: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ versionId: 'asc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }, { id: 'desc' }],
    })

    return sets.map((set) => this.toVariableSetView(set))
  }

  async createVariableSet(payload: GeoV3VariableSetDto) {
    if (payload.versionId) {
      await this.findVersionRecord(payload.versionId)
    }

    const set = await this.prisma.geoPromptVariableSet.create({
      data: {
        ...(payload.versionId ? { version: { connect: { id: payload.versionId } } } : {}),
        name: this.requireText(payload.name, '请填写变量池名称'),
        description: this.toLongText(payload.description),
        isActive: payload.isActive ?? true,
        sortOrder: payload.sortOrder ?? 0,
        items: {
          create: this.toVariableItemCreateInputs(payload.items),
        },
      },
      include: {
        items: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
    })

    return this.toVariableSetView(set)
  }

  async updateVariableSet(id: number, payload: UpdateGeoV3VariableSetDto) {
    await this.findVariableSetRecord(id)
    if (payload.versionId) {
      await this.findVersionRecord(payload.versionId)
    }

    const set = await this.prisma.$transaction(async (tx) => {
      if (payload.items) {
        await tx.geoPromptVariableItem.deleteMany({ where: { setId: id } })
      }

      return tx.geoPromptVariableSet.update({
        where: { id },
        data: {
          ...(payload.name !== undefined ? { name: this.requireText(payload.name, '请填写变量池名称') } : {}),
          ...(payload.versionId !== undefined ? { version: { connect: { id: payload.versionId } } } : {}),
          ...(payload.description !== undefined ? { description: this.toLongText(payload.description) } : {}),
          ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
          ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}),
          ...(payload.items
            ? {
                items: {
                  create: this.toVariableItemCreateInputs(payload.items),
                },
              }
            : {}),
        },
        include: {
          items: {
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          },
        },
      })
    })

    return this.toVariableSetView(set)
  }

  async removeVariableSet(id: number) {
    await this.findVariableSetRecord(id)
    await this.prisma.geoPromptVariableSet.delete({ where: { id } })
    return { id, success: true }
  }

  async findProducts() {
    const products = await this.prisma.geoMainProductProfileV3.findMany({
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }, { id: 'desc' }],
    })

    return products.map((product) => this.toProductView(product))
  }

  async createProduct(payload: GeoV3ProductDto) {
    const product = await this.prisma.geoMainProductProfileV3.create({
      data: this.toProductCreateInput(payload),
    })

    return this.toProductView(product)
  }

  async updateProduct(id: number, payload: UpdateGeoV3ProductDto) {
    const currentProduct = await this.findProductRecord(id)

    const product = await this.prisma.geoMainProductProfileV3.update({
      where: { id },
      data: this.toProductUpdateInput(payload, currentProduct),
    })

    return this.toProductView(product)
  }

  async removeProduct(id: number) {
    await this.findProductRecord(id)
    await this.prisma.geoMainProductProfileV3.delete({ where: { id } })
    return { id, success: true }
  }

  async generate(payload: GeoV3GenerateDto) {
    const articleText = payload.articleText?.trim()
    const articleUrl = payload.articleUrl?.trim()
    if (!articleText && !articleUrl) {
      throw new BadRequestException('请提供竞对文章正文或 URL')
    }

    const [version, product] = await Promise.all([
      this.findVersionRecord(payload.versionId),
      this.findProductRecord(payload.productProfileId),
    ])
    const variableSet = await this.findVariableSetForVersion(version.id, payload.variableSetId)
    const providerConfig = await this.prisma.geoProviderConfig.findUnique({ where: { id: 1 } })

    if (!version.isActive) throw new BadRequestException('当前 V3 版本已停用')
    if (!variableSet.isActive) throw new BadRequestException('当前变量池已停用')
    if (!product.isActive) throw new BadRequestException('当前主推产品已停用')
    if (!providerConfig?.apiKey?.trim()) throw new BadRequestException('请先完成 Anthropic 配置后再使用 V3 增强生成')

    const article = articleText || await fetchArticle(articleUrl!)
    const fixedRulesMode = payload.fixedRulesMode === 'NONE'
      ? GeoPromptV3FixedRulesMode.NONE
      : GeoPromptV3FixedRulesMode.SYSTEM
    const fixedRules = fixedRulesMode === GeoPromptV3FixedRulesMode.NONE
      ? PROMPT_V3_TECHNICAL_GUARD_RULES
      : await this.getPromptV3FixedRules()

    const count = Math.max(1, Math.min(payload.count, 50))
    const mode = count > 1 ? GeoPromptV3RunMode.BATCH : GeoPromptV3RunMode.SINGLE
    const versionInput = this.toPromptVersionInput(version)
    const variableItems = variableSet.items.map((item) => this.toPromptVariableItemInput(item))
    const productInput = this.toPromptProductInput(product)
    const versionSnapshot = this.toVersionView(version) as unknown as Prisma.InputJsonValue
    const variableSetSnapshot = this.toVariableSetView(variableSet) as unknown as Prisma.InputJsonValue
    const productSnapshot = this.toProductView(product) as unknown as Prisma.InputJsonValue
    const dateCode = this.toShanghaiDateCode(new Date())
    const topic = this.toShortText(payload.topic)
    const extraRequirements = this.toLongText(payload.extraRequirements)

    const run = await this.prisma.geoPromptV3GenerationRun.create({
      data: {
        mode,
        fixedRulesMode,
        status: GeoPromptV3RunStatus.RUNNING,
        versionId: version.id,
        variableSetId: variableSet.id,
        productProfileId: product.id,
        versionName: version.name,
        variableSetName: variableSet.name,
        productProfileName: product.name,
        topic,
        extraRequirements,
        articleUrl: articleUrl ?? '',
        articleText: article,
        versionSnapshot,
        variableSetSnapshot,
        productSnapshot,
        requestedCount: count,
        successCount: 0,
        failedCount: 0,
        zipFileName: '',
        lastError: '',
        completedAt: null,
      },
    })

    const generationContext: PromptV3GenerationExecutionContext = {
      count,
      dateCode,
      providerConfig,
      article,
      fixedRules,
      fixedRulesMode,
      version: versionInput,
      variableSetName: variableSet.name,
      variableItems,
      product: productInput,
      topic,
      extraRequirements,
      versionName: run.versionName,
      productProfileName: run.productProfileName,
    }

    await this.createPromptV3PlaceholderItems(run.id, generationContext)

    const initialRun = await this.prisma.geoPromptV3GenerationRun.findUnique({
      where: { id: run.id },
      include: {
        items: {
          orderBy: [{ itemIndex: 'asc' }],
        },
      },
    })

    if (mode === GeoPromptV3RunMode.BATCH) {
      void this.completePromptV3GenerationRun(run.id, generationContext).catch((error) => {
        console.error('[GeoV3] Batch generation failed unexpectedly', error)
      })

      return this.toRunView(initialRun ?? { ...run, items: [] }, true)
    }

    return this.completePromptV3GenerationRun(run.id, generationContext)
  }

  private async createPromptV3PlaceholderItems(runId: number, context: PromptV3GenerationExecutionContext) {
    await this.prisma.geoPromptV3GenerationItem.createMany({
      data: Array.from({ length: context.count }, (_, index) => this.buildPromptV3PlaceholderItemInput(
        runId,
        context,
        index + 1
      )),
      skipDuplicates: true,
    })
  }

  private async recoverPromptV3GenerationRuns() {
    try {
      const runningRuns = await this.prisma.geoPromptV3GenerationRun.findMany({
        where: { status: GeoPromptV3RunStatus.RUNNING },
        include: {
          items: {
            orderBy: [{ itemIndex: 'asc' }],
          },
        },
      })

      for (const run of runningRuns) {
        const message = '服务重启或任务中断，未完成的 Prompt 已标记为失败，请重新生成。'
        const existingIndexes = new Set(run.items.map((item) => item.itemIndex))
        const missingItems = Array.from({ length: run.requestedCount }, (_, index) => index + 1)
          .filter((itemIndex) => !existingIndexes.has(itemIndex))
          .map((itemIndex) => ({
            runId: run.id,
            itemIndex,
            status: GeoPromptV3ItemStatus.FAILED,
            fileName: this.buildPromptV3FileName(run, itemIndex),
            promptText: '',
            selectedVariables: [] as unknown as Prisma.InputJsonValue,
            selectedProductContent: this.emptyPromptV3SelectedProductContent(),
            errorMessage: message,
          }))

        if (missingItems.length > 0) {
          await this.prisma.geoPromptV3GenerationItem.createMany({
            data: missingItems,
            skipDuplicates: true,
          })
        }

        await this.prisma.geoPromptV3GenerationItem.updateMany({
          where: {
            runId: run.id,
            status: {
              in: [GeoPromptV3ItemStatus.QUEUED, GeoPromptV3ItemStatus.RUNNING],
            },
          },
          data: {
            status: GeoPromptV3ItemStatus.FAILED,
            errorMessage: message,
          },
        })

        const items = await this.prisma.geoPromptV3GenerationItem.findMany({
          where: { runId: run.id },
          orderBy: [{ itemIndex: 'asc' }],
        })
        const successCount = items.filter((item) => item.status === GeoPromptV3ItemStatus.SUCCEEDED).length
        const failedCount = Math.max(run.requestedCount - successCount, 0)
        const zipFileName = successCount > 0
          ? this.buildPromptV3ZipFileName(run, 1, successCount)
          : ''

        await this.prisma.geoPromptV3GenerationRun.update({
          where: { id: run.id },
          data: {
            status: successCount > 0 ? GeoPromptV3RunStatus.PARTIAL_FAILED : GeoPromptV3RunStatus.FAILED,
            successCount,
            failedCount,
            zipFileName,
            lastError: message,
            completedAt: new Date(),
          },
        })
      }
    } catch (error) {
      console.error('[GeoV3] Failed to recover unfinished generation runs', error)
    }
  }

  private async recoverBatchTxtJobs() {
    try {
      const runningJobs = await this.prisma.geoPromptV3BatchTxtJob.findMany({
        where: {
          status: {
            in: ['QUEUED', 'RUNNING'],
          },
        },
      })

      for (const job of runningJobs) {
        await this.prisma.geoPromptV3BatchTxtJobItem.updateMany({
          where: {
            jobId: job.id,
            status: 'RUNNING',
          },
          data: {
            status: 'QUEUED',
            errorMessage: '服务已恢复，任务正在自动重新排队。',
            startedAt: null,
            completedAt: null,
          },
        })
        await this.prisma.geoPromptV3BatchTxtJob.update({
          where: { id: job.id },
          data: {
            status: 'QUEUED',
            lastError: '',
            runningCount: 0,
            completedAt: null,
          },
        })
        await this.refreshBatchTxtJobProgress(job.id)
      }
    } catch (error) {
      console.error('[GeoV3] Failed to recover unfinished TXT batch jobs', error)
    }
  }

  private normalizeBatchTxtFiles(payload: GeoV3BatchTxtJobDto) {
    if (!Array.isArray(payload.files) || payload.files.length === 0) {
      throw new BadRequestException('请至少上传 1 个 TXT/MD 文件')
    }

    if (payload.files.length > BATCH_TXT_MAX_FILES) {
      throw new BadRequestException(`一次最多上传 ${BATCH_TXT_MAX_FILES} 个 TXT/MD 文件`)
    }

    return payload.files.map((file, index) => {
      const fileName = this.toShortText(file.fileName, 180)
      const content = String(file.content ?? '').replace(/^\uFEFF/, '').trim()
      const versionName = this.toBatchTxtVersionName(fileName)

      if (!this.isBatchDraftFileName(fileName)) {
        throw new BadRequestException(`第 ${index + 1} 个文件不是 TXT/MD：${fileName || '未命名文件'}`)
      }

      if (!content) {
        throw new BadRequestException(`${fileName} 内容为空`)
      }

      if (content.length > BATCH_TXT_MAX_ARTICLE_LENGTH) {
        throw new BadRequestException(`${fileName} 超过 ${BATCH_TXT_MAX_ARTICLE_LENGTH} 字符，请拆分后再上传`)
      }

      return {
        fileName,
        versionName,
        content,
      }
    })
  }

  private isBatchDraftFileName(fileName: string) {
    const lowerName = fileName.toLowerCase()
    return BATCH_DRAFT_FILE_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
  }

  private normalizeBatchTxtRequirements(requirements?: string[]) {
    const cleanRequirements = (requirements ?? [])
      .map((item) => this.toLongText(item, 6000))
      .filter(Boolean)
      .slice(0, 20)

    return cleanRequirements.length > 0 ? cleanRequirements : this.buildDefaultBatchTxtRequirements()
  }

  private readBatchTxtRequirements(value: Prisma.JsonValue) {
    if (!Array.isArray(value)) return this.buildDefaultBatchTxtRequirements()
    return this.normalizeBatchTxtRequirements(value.map((item) => String(item)))
  }

  private buildDefaultBatchTxtRequirements() {
    return [
      '分析这篇文章的 SEO。',
      '分析这篇文章的 GEO。',
      [
        '分析这篇文章的结构：',
        '## 分析内容',
        '## 分析文章的结构',
        '## 分析文章的分段',
        '## 生成一份能生成同样内容、结构和分段的文章的提示词，要注意把 SEO 内容和 GEO 内容都一并写到提示词上。',
        '## GEO 的重点是让 AI 尽可能抓取重点推荐的品牌，重点推荐的品牌在 Prompt 里目前用占位符，由我填入。其他品牌也是。',
      ].join('\n'),
      '分析这篇文章的标题，拆解这个标题让提示词能生成不同的标题，标题字数控制在 30-45 字之间。把原标题打印出来给我确认。',
      '直接在文章流中嵌入描述性占位符：在每个品牌段落标题之后、正文之前插入“[品牌名+图片]”，如“[windhay+图片]”。',
      '这个版本只针对{{产品品类}}。',
      '提示词中文章的结构部分需要写明每部分的段落数。',
    ]
  }

  private renderBatchTxtRequirement(requirement: string, productCategory: string) {
    return requirement.replace(/\{\{\s*产品品类\s*\}\}/g, productCategory || '防晒衣')
  }

  private buildBatchTxtNotes(productCategory: string, requirements: string[]) {
    const category = this.toShortText(productCategory || '防晒衣', 80)
    const renderedRequirements = requirements.map((requirement, index) =>
      `#${index + 1}、${this.renderBatchTxtRequirement(requirement, category)}`
    )

    return [
      'TXT/MD 批量建版要求',
      `产品品类：${category}`,
      ...renderedRequirements,
    ].join('\n\n')
  }

  private buildBatchTxtUserMessage(
    versionName: string,
    productCategory: string,
    requirements: string[]
  ) {
    const category = this.toShortText(productCategory || '防晒衣', 80)

    return [
      `请基于当前 TXT/MD 文件《${versionName}》里的竞对文章，完成 GEO V3 批量建版。`,
      `正式版本名称必须使用：${versionName}`,
      `本次产品品类：${category}`,
      '请逐条执行以下建版要求，并最终整理成可保存的正式 V3 版本规则 ruleText 和变量池 variableSetDraft：',
      ...requirements.map((requirement, index) =>
        `#${index + 1}、${this.renderBatchTxtRequirement(requirement, category)}`
      ),
      '注意：最终 ruleText 必须是正式规则，不要输出聊天总结、下一步建议或内部分析过程；变量候选只放入 variableSetDraft。',
    ].join('\n\n')
  }

  private buildBatchTxtAssistantMessage(input: {
    versionName: string
    suggestion: VersionDraftSuggestion
  }) {
    const variableLines = input.suggestion.variableSetDraft.items
      .map((item, index) => `- ${index + 1}. ${item.label}：${item.candidates.slice(0, 8).join('、')}`)
      .join('\n')

    return [
      `TXT/MD 批量建版已完成：${input.versionName}`,
      `原标题：${input.suggestion.sourceArticleTitle || '未识别'}`,
      '## ruleText',
      input.suggestion.ruleText,
      '## variableSetDraft',
      variableLines || '未识别到变量候选，已创建空变量池，可后续手动补充。',
    ].join('\n\n')
  }

  private toBatchTxtVersionName(fileName: string) {
    const withoutExt = fileName.replace(/\.[^.]+$/, '')
    return this.toShortText(withoutExt.replace(/[\\/:*?"<>|\r\n]+/g, '_'), 120) || '未命名版本'
  }

  private isBatchTxtJobTerminal(status: string) {
    return status === 'COMPLETED' || status === 'PARTIAL_FAILED' || status === 'FAILED'
  }

  private toBatchTxtJobStatus(value: string): BatchTxtJobStatus {
    if (value === 'RUNNING' || value === 'COMPLETED' || value === 'PARTIAL_FAILED' || value === 'FAILED') {
      return value
    }
    return 'QUEUED'
  }

  private toBatchTxtItemStatus(value: string): BatchTxtJobItemStatus {
    if (value === 'RUNNING' || value === 'SUCCEEDED' || value === 'SKIPPED' || value === 'FAILED') {
      return value
    }
    return 'QUEUED'
  }

  private toBatchTxtJobView(job: BatchTxtJobWithItems, includeItems: boolean) {
    const items = Array.isArray(job.items) ? job.items : []
    const successCount = items.length > 0 ? items.filter((item) => item.status === 'SUCCEEDED').length : job.successCount
    const skippedCount = items.length > 0 ? items.filter((item) => item.status === 'SKIPPED').length : job.skippedCount
    const failedCount = items.length > 0 ? items.filter((item) => item.status === 'FAILED').length : job.failedCount
    const runningCount = items.length > 0 ? items.filter((item) => item.status === 'RUNNING').length : job.runningCount
    const queuedCount = items.length > 0 ? items.filter((item) => item.status === 'QUEUED').length : 0
    const requestedCount = job.requestedCount || items.length
    const finishedCount = successCount + skippedCount + failedCount

    return {
      id: job.id,
      productCategory: job.productCategory,
      requirements: this.readBatchTxtRequirements(job.requirements as Prisma.JsonValue),
      model: job.model,
      status: this.toBatchTxtJobStatus(job.status),
      requestedCount,
      successCount,
      skippedCount,
      failedCount,
      queuedCount,
      runningCount,
      progress: requestedCount > 0 ? Math.min(100, Math.round((finishedCount / requestedCount) * 100)) : 0,
      lastError: job.lastError,
      ownerUserId: job.ownerUserId,
      ownerName: job.ownerName,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
      items: includeItems
        ? items.map((item) => ({
            id: item.id,
            jobId: item.jobId,
            itemIndex: item.itemIndex,
            fileName: item.fileName,
            versionName: item.versionName,
            status: this.toBatchTxtItemStatus(item.status),
            errorMessage: item.errorMessage,
            versionId: item.versionId,
            variableSetId: item.variableSetId,
            draftSessionId: item.draftSessionId,
            startedAt: item.startedAt?.toISOString() ?? null,
            completedAt: item.completedAt?.toISOString() ?? null,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
          }))
        : undefined,
    }
  }

  private async completePromptV3GenerationRun(runId: number, context: PromptV3GenerationExecutionContext) {
    try {
      await this.mapWithConcurrency(
        Array.from({ length: context.count }, (_, index) => index + 1),
        GENERATE_V3_CONCURRENCY,
        async (itemIndex) => this.completePromptV3GenerationItem(runId, context, itemIndex)
      )

      return this.finalizePromptV3GenerationRun(runId, context)
    } catch (error) {
      return this.failPromptV3GenerationRun(runId, context, error)
    }
  }

  private async completePromptV3GenerationItem(
    runId: number,
    context: PromptV3GenerationExecutionContext,
    itemIndex: number
  ) {
    await this.prisma.geoPromptV3GenerationItem.update({
      where: { runId_itemIndex: { runId, itemIndex } },
      data: {
        status: GeoPromptV3ItemStatus.RUNNING,
        errorMessage: '',
      },
    })
    await this.refreshPromptV3RunProgress(runId)

    let lastError = ''

    for (let attempt = 1; attempt <= GENERATE_V3_MAX_ATTEMPTS_PER_ITEM; attempt += 1) {
      const selectedVariables = selectPromptV3Variables(context.variableItems)
      const selectedProductContent = selectPromptV3ProductContent(context.product)

      try {
        const promptText = await this.requestPromptV3GenerateOutput({
          providerConfig: context.providerConfig,
          article: context.article,
          fixedRules: context.fixedRules,
          fixedRulesMode: context.fixedRulesMode,
          version: context.version,
          variableSetName: context.variableSetName,
          selectedVariables,
          product: context.product,
          selectedProductContent,
          topic: context.topic,
          extraRequirements: context.extraRequirements,
          variationIndex: itemIndex,
        })

        await this.prisma.geoPromptV3GenerationItem.update({
          where: { runId_itemIndex: { runId, itemIndex } },
          data: {
            status: GeoPromptV3ItemStatus.SUCCEEDED,
            fileName: this.buildPromptV3FileName(context, itemIndex),
            promptText,
            selectedVariables: selectedVariables as unknown as Prisma.InputJsonValue,
            selectedProductContent: selectedProductContent as unknown as Prisma.InputJsonValue,
            errorMessage: '',
          },
        })
        await this.refreshPromptV3RunProgress(runId)
        return
      } catch (error) {
        lastError = this.toPromptV3ErrorMessage(error)
        await this.prisma.geoPromptV3GenerationItem.update({
          where: { runId_itemIndex: { runId, itemIndex } },
          data: {
            status: GeoPromptV3ItemStatus.RUNNING,
            errorMessage: `第 ${attempt}/${GENERATE_V3_MAX_ATTEMPTS_PER_ITEM} 次尝试失败：${lastError}`,
          },
        })
      }
    }

    await this.prisma.geoPromptV3GenerationItem.update({
      where: { runId_itemIndex: { runId, itemIndex } },
      data: {
        status: GeoPromptV3ItemStatus.FAILED,
        promptText: '',
        selectedVariables: [] as unknown as Prisma.InputJsonValue,
        selectedProductContent: this.emptyPromptV3SelectedProductContent(),
        errorMessage: `已尝试 ${GENERATE_V3_MAX_ATTEMPTS_PER_ITEM}/${GENERATE_V3_MAX_ATTEMPTS_PER_ITEM} 次仍失败：${lastError || '生成失败'}`,
      },
    })
    await this.refreshPromptV3RunProgress(runId)
  }

  private async finalizePromptV3GenerationRun(runId: number, context: PromptV3GenerationExecutionContext) {
    await this.prisma.geoPromptV3GenerationItem.updateMany({
      where: {
        runId,
        status: {
          in: [GeoPromptV3ItemStatus.QUEUED, GeoPromptV3ItemStatus.RUNNING],
        },
      },
      data: {
        status: GeoPromptV3ItemStatus.FAILED,
        errorMessage: '任务结束时仍未完成，请重新生成本条 Prompt',
      },
    })

    const items = await this.prisma.geoPromptV3GenerationItem.findMany({
      where: { runId },
      orderBy: [{ itemIndex: 'asc' }],
    })
    const successCount = items.filter((item) => item.status === GeoPromptV3ItemStatus.SUCCEEDED).length
    const failedItems = items.filter((item) => item.status === GeoPromptV3ItemStatus.FAILED)
    const failedCount = context.count - successCount
    const zipFileName = successCount > 0
      ? this.buildPromptV3ZipFileName(
        {
          dateCode: context.dateCode,
          versionName: context.versionName,
          productProfileName: context.productProfileName,
        },
        1,
        successCount
      )
      : ''
    const status = failedCount === 0
      ? GeoPromptV3RunStatus.COMPLETED
      : successCount > 0
        ? GeoPromptV3RunStatus.PARTIAL_FAILED
        : GeoPromptV3RunStatus.FAILED
    const lastError = failedCount > 0
      ? failedItems[failedItems.length - 1]?.errorMessage || '部分 Prompt 多次补生成后仍失败'
      : ''
    const updatedRun = await this.prisma.geoPromptV3GenerationRun.update({
      where: { id: runId },
      data: {
        status,
        successCount,
        failedCount,
        zipFileName,
        lastError,
        completedAt: new Date(),
      },
      include: {
        items: {
          orderBy: [{ itemIndex: 'asc' }],
        },
      },
    })

    return this.toRunView(updatedRun, true)
  }

  private async refreshPromptV3RunProgress(runId: number) {
    const [successCount, failedCount] = await Promise.all([
      this.prisma.geoPromptV3GenerationItem.count({
        where: { runId, status: GeoPromptV3ItemStatus.SUCCEEDED },
      }),
      this.prisma.geoPromptV3GenerationItem.count({
        where: { runId, status: GeoPromptV3ItemStatus.FAILED },
      }),
    ])

    await this.prisma.geoPromptV3GenerationRun.update({
      where: { id: runId },
      data: {
        successCount,
        failedCount,
      },
    })
  }

  private async failPromptV3GenerationRun(
    runId: number,
    context: PromptV3GenerationExecutionContext,
    error: unknown
  ) {
    const message = this.toPromptV3ErrorMessage(error)
    const existingItems = await this.prisma.geoPromptV3GenerationItem.count({ where: { runId } })

    if (existingItems === 0) {
      try {
        await this.prisma.geoPromptV3GenerationItem.createMany({
          data: Array.from({ length: context.count }, (_, index) => this.buildPromptV3FailedItemInput(
            runId,
            context,
            index + 1,
            message
          )),
          skipDuplicates: true,
        })
      } catch (createError) {
        console.error('[GeoV3] Failed to create failed generation items', createError)
      }
    } else {
      await this.prisma.geoPromptV3GenerationItem.updateMany({
        where: {
          runId,
          status: {
            not: GeoPromptV3ItemStatus.SUCCEEDED,
          },
        },
        data: {
          status: GeoPromptV3ItemStatus.FAILED,
          errorMessage: message,
        },
      })
    }

    const [successCount, failedCount] = await Promise.all([
      this.prisma.geoPromptV3GenerationItem.count({
        where: { runId, status: GeoPromptV3ItemStatus.SUCCEEDED },
      }),
      this.prisma.geoPromptV3GenerationItem.count({
        where: { runId, status: GeoPromptV3ItemStatus.FAILED },
      }),
    ])
    const status = successCount > 0 ? GeoPromptV3RunStatus.PARTIAL_FAILED : GeoPromptV3RunStatus.FAILED
    const zipFileName = successCount > 0
      ? this.buildPromptV3ZipFileName(context, 1, successCount)
      : ''

    const failedRun = await this.prisma.geoPromptV3GenerationRun.update({
      where: { id: runId },
      data: {
        status,
        successCount,
        failedCount,
        zipFileName,
        lastError: message,
        completedAt: new Date(),
      },
      include: {
        items: {
          orderBy: [{ itemIndex: 'asc' }],
        },
      },
    })

    return this.toRunView(failedRun, true)
  }

  private buildPromptV3PlaceholderItemInput(
    runId: number,
    context: PromptV3GenerationExecutionContext,
    itemIndex: number
  ): Prisma.GeoPromptV3GenerationItemCreateManyInput {
    return {
      runId,
      itemIndex,
      status: GeoPromptV3ItemStatus.QUEUED,
      fileName: this.buildPromptV3FileName(context, itemIndex),
      promptText: '',
      selectedVariables: [] as unknown as Prisma.InputJsonValue,
      selectedProductContent: this.emptyPromptV3SelectedProductContent(),
      errorMessage: '',
    }
  }

  private buildPromptV3FailedItemInput(
    runId: number,
    context: PromptV3GenerationExecutionContext,
    itemIndex: number,
    errorMessage: string
  ): Prisma.GeoPromptV3GenerationItemCreateManyInput {
    return {
      runId,
      itemIndex,
      status: GeoPromptV3ItemStatus.FAILED,
      fileName: this.buildPromptV3FileName(
        {
          dateCode: context.dateCode,
          versionName: context.versionName,
          productProfileName: context.productProfileName,
        },
        itemIndex
      ),
      promptText: '',
      selectedVariables: [] as unknown as Prisma.InputJsonValue,
      selectedProductContent: this.emptyPromptV3SelectedProductContent(),
      errorMessage,
    }
  }

  private emptyPromptV3SelectedProductContent() {
    return {
      requiredContent: [],
      randomContent: [],
      sellingPoints: [],
      emphasis: [],
      brandPool: [],
    } as unknown as Prisma.InputJsonValue
  }

  private isLocalProviderTimeout(error: unknown) {
    return error instanceof Anthropic.APIConnectionTimeoutError
      || (error instanceof Error && error.name === 'APIConnectionTimeoutError')
  }

  private getProviderErrorStatus(error: unknown) {
    if (error && typeof error === 'object') {
      const status = (error as { status?: unknown }).status
      if (typeof status === 'number') return status

      const getStatus = (error as { getStatus?: unknown }).getStatus
      if (typeof getStatus === 'function') {
        const resolvedStatus = getStatus.call(error)
        if (typeof resolvedStatus === 'number') return resolvedStatus
      }
    }

    const message = error instanceof Error ? error.message : String(error || '')
    const match = message.match(/^\s*(408|429|5\d\d)\b/)
    return match ? Number(match[1]) : null
  }

  private getProviderRequestId(error: unknown, message: string) {
    if (error && typeof error === 'object') {
      const requestId = (error as { requestID?: unknown }).requestID
      if (typeof requestId === 'string' && requestId.trim()) return requestId.trim()
    }

    return message.match(/request id[:：]\s*([a-z0-9_-]+)/i)?.[1] ?? ''
  }

  private isTransientProviderError(error: unknown) {
    const status = this.getProviderErrorStatus(error)
    if (status === 408 || status === 429 || (status !== null && status >= 500)) return true
    if (this.isLocalProviderTimeout(error)) return true

    const message = error instanceof Error ? error.message : String(error || '')
    return /request timed out|timeout|temporarily unavailable|overloaded|rate.?limit|econnreset|econnrefused|socket hang up|fetch failed|network error/i.test(message)
  }

  private toPromptV3ErrorMessage(
    error: unknown,
    options: { timeout?: number; maxRetries?: number; attempts?: number; elapsedMs?: number } = {}
  ) {
    const requestError = error instanceof BatchVersionDraftRequestError ? error : null
    const providerError = requestError?.providerError ?? error
    const message = providerError instanceof Error && providerError.message.trim()
      ? providerError.message.trim()
      : typeof providerError === 'string' && providerError.trim()
        ? providerError.trim()
        : ''
    const attempts = options.attempts ?? requestError?.attempts ?? 1
    const elapsedMs = options.elapsedMs ?? requestError?.elapsedMs
    const status = this.getProviderErrorStatus(providerError)
    const requestId = this.getProviderRequestId(providerError, message)
    const attemptText = attempts > 1 ? `，系统已尝试 ${attempts} 次` : ''
    const requestIdText = requestId ? ` 请求编号：${requestId}` : ''

    if (status === 429) {
      return `上游 AI 当前请求较多或触发限流${attemptText}，任务已暂停；请稍后使用“重试失败项”。${requestIdText}`
    }

    if (status !== null && status >= 500) {
      return `上游 AI 服务暂时不可用（HTTP ${status}）${attemptText}，不是本机服务器故障；请稍后使用“重试失败项”。${requestIdText}`
    }

    if (this.isLocalProviderTimeout(providerError)) {
      const timeoutSeconds = Math.round((options.timeout ?? BATCH_VERSION_DRAFT_REQUEST_TIMEOUT_MS) / 1000)
      return `本地等待上游 AI 单次响应达到 ${timeoutSeconds} 秒${attemptText}，仍未收到结果；请稍后使用“重试失败项”或精简建版要求。${requestIdText}`
    }

    if (/request timed out/i.test(message)) {
      const timeoutSeconds = Math.round((options.timeout ?? GENERATE_V3_REQUEST_TIMEOUT_MS) / 1000)
      const elapsedSeconds = elapsedMs === undefined ? null : Math.max(1, Math.round(elapsedMs / 1000))
      if (elapsedSeconds !== null && elapsedMs! < (options.timeout ?? timeoutSeconds * 1000) * 0.9) {
        return `上游 AI 网关在约 ${elapsedSeconds} 秒后提前返回超时${attemptText}，并非本地等待了 ${timeoutSeconds} 秒；请稍后使用“重试失败项”。${requestIdText}`
      }

      const retryCount = options.maxRetries ?? 0
      const retryText = retryCount > 0 ? `，SDK 已自动重试 ${retryCount} 次` : attemptText
      return `本地等待上游 AI 单次响应达到 ${timeoutSeconds} 秒${retryText}，系统未收到结果；请稍后使用“重试失败项”或精简版本规则。${requestIdText}`
    }

    if (message) return message

    return 'V3 Prompt 生成失败'
  }

  async findRuns() {
    const runs = await this.prisma.geoPromptV3GenerationRun.findMany({
      include: {
        items: {
          select: {
            id: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 80,
    })

    return runs.map((run) => this.toRunView(run, false))
  }

  async findRun(id: number) {
    const run = await this.prisma.geoPromptV3GenerationRun.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: [{ itemIndex: 'asc' }],
        },
      },
    })

    if (!run) throw new NotFoundException('V3 生成记录不存在')
    return this.toRunView(run, true)
  }

  async downloadRun(id: number, response: Response) {
    const run = await this.prisma.geoPromptV3GenerationRun.findUnique({
      where: { id },
      include: {
        items: {
          where: { status: GeoPromptV3ItemStatus.SUCCEEDED },
          orderBy: [{ itemIndex: 'asc' }],
        },
      },
    })

    if (!run) throw new NotFoundException('V3 生成记录不存在')
    if (run.items.length === 0) throw new BadRequestException('当前记录没有可下载的 Prompt')

    const zip = new JSZip()
    run.items.forEach((item) => {
      zip.file(item.fileName || this.buildPromptV3FileName(run, item.itemIndex), item.promptText)
    })

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    const fileName = run.zipFileName || this.buildPromptV3ZipFileName(run, 1, run.items.length)

    response.status(200)
    response.setHeader('Content-Type', 'application/zip')
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`)
    response.setHeader('Content-Length', String(buffer.length))
    response.end(buffer)
  }

  private async findVersionRecord(id: number) {
    const version = await this.prisma.geoPromptEngineV3Version.findUnique({ where: { id } })
    if (!version) throw new NotFoundException('V3 版本不存在')
    return version
  }

  private async findVariableSetRecord(id: number): Promise<VariableSetWithItems> {
    const set = await this.prisma.geoPromptVariableSet.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
    })
    if (!set) throw new NotFoundException('变量池不存在')
    return set
  }

  private async findVariableSetForVersion(versionId: number, variableSetId?: number): Promise<VariableSetWithItems> {
    if (variableSetId) {
      const set = await this.findVariableSetRecord(variableSetId)
      if (set.versionId !== null && set.versionId !== versionId) {
        throw new BadRequestException('所选变量池不属于当前 V3 版本')
      }
      return set
    }

    const set = await this.prisma.geoPromptVariableSet.findFirst({
      where: {
        versionId,
        isActive: true,
      },
      include: {
        items: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    })

    if (!set) {
      throw new BadRequestException('当前 V3 版本还没有绑定启用中的变量池，请先到版本管理里配置')
    }

    return set
  }

  private async findProductRecord(id: number) {
    const product = await this.prisma.geoMainProductProfileV3.findUnique({ where: { id } })
    if (!product) throw new NotFoundException('主推产品不存在')
    return product
  }

  private toVersionCreateInput(payload: GeoV3VersionDto): Prisma.GeoPromptEngineV3VersionCreateInput {
    const ruleText = this.resolveVersionRuleText(payload)
    const legacyFields = this.toLegacyVersionFields(payload, ruleText)

    return {
      name: this.requireText(payload.name, '请填写版本名称'),
      description: this.toLongText(payload.description),
      sourceArticleUrl: this.toLongText(payload.sourceArticleUrl, 2048),
      sourceArticleText: this.toLongText(payload.sourceArticleText),
      sourceArticleTitle: this.toShortText(payload.sourceArticleTitle),
      ruleText,
      structureRules: legacyFields.structureRules,
      titleRules: legacyFields.titleRules,
      paragraphRules: legacyFields.paragraphRules,
      seoGeoRules: legacyFields.seoGeoRules,
      forbiddenRules: legacyFields.forbiddenRules,
      notes: this.toLongText(payload.notes),
      isActive: payload.isActive ?? true,
      sortOrder: payload.sortOrder ?? 0,
    }
  }

  private toVersionUpdateInput(payload: UpdateGeoV3VersionDto): Prisma.GeoPromptEngineV3VersionUpdateInput {
    const hasLegacyRuleField =
      payload.structureRules !== undefined ||
      payload.titleRules !== undefined ||
      payload.paragraphRules !== undefined ||
      payload.seoGeoRules !== undefined ||
      payload.forbiddenRules !== undefined
    const ruleText = payload.ruleText !== undefined || hasLegacyRuleField
      ? this.resolveVersionRuleText(payload)
      : undefined
    const legacyFields = ruleText !== undefined ? this.toLegacyVersionFields(payload, ruleText) : null

    return {
      ...(payload.name !== undefined ? { name: this.requireText(payload.name, '请填写版本名称') } : {}),
      ...(payload.description !== undefined ? { description: this.toLongText(payload.description) } : {}),
      ...(payload.sourceArticleUrl !== undefined ? { sourceArticleUrl: this.toLongText(payload.sourceArticleUrl, 2048) } : {}),
      ...(payload.sourceArticleText !== undefined ? { sourceArticleText: this.toLongText(payload.sourceArticleText) } : {}),
      ...(payload.sourceArticleTitle !== undefined ? { sourceArticleTitle: this.toShortText(payload.sourceArticleTitle) } : {}),
      ...(ruleText !== undefined ? { ruleText } : {}),
      ...(legacyFields ? { structureRules: legacyFields.structureRules } : {}),
      ...(legacyFields ? { titleRules: legacyFields.titleRules } : {}),
      ...(legacyFields ? { paragraphRules: legacyFields.paragraphRules } : {}),
      ...(legacyFields ? { seoGeoRules: legacyFields.seoGeoRules } : {}),
      ...(legacyFields ? { forbiddenRules: legacyFields.forbiddenRules } : {}),
      ...(payload.notes !== undefined ? { notes: this.toLongText(payload.notes) } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
      ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}),
    }
  }

  private resolveVersionRuleText(
    payload: Pick<
      UpdateGeoV3VersionDto,
      'ruleText' | 'structureRules' | 'titleRules' | 'paragraphRules' | 'seoGeoRules' | 'forbiddenRules' | 'notes'
    >
  ) {
    const directRuleText = this.toLongText(payload.ruleText)
    const composedRuleText = this.composeVersionRuleText({
      structureRules: payload.structureRules,
      titleRules: payload.titleRules,
      paragraphRules: payload.paragraphRules,
      seoGeoRules: payload.seoGeoRules,
      forbiddenRules: payload.forbiddenRules,
      notes: payload.notes,
    })

    return this.requireLongText(directRuleText || composedRuleText, '请填写版本规则内容')
  }

  private toLegacyVersionFields(
    payload: Pick<UpdateGeoV3VersionDto, 'structureRules' | 'titleRules' | 'paragraphRules' | 'seoGeoRules' | 'forbiddenRules'>,
    ruleText: string
  ) {
    const hasLegacyRuleField =
      payload.structureRules !== undefined ||
      payload.titleRules !== undefined ||
      payload.paragraphRules !== undefined ||
      payload.seoGeoRules !== undefined ||
      payload.forbiddenRules !== undefined

    return {
      structureRules: this.toLongText(hasLegacyRuleField ? payload.structureRules : ruleText),
      titleRules: this.toLongText(payload.titleRules),
      paragraphRules: this.toLongText(payload.paragraphRules),
      seoGeoRules: this.toLongText(payload.seoGeoRules),
      forbiddenRules: this.toLongText(payload.forbiddenRules),
    }
  }

  private composeVersionRuleText(
    value: Pick<
      GeoPromptEngineV3Version,
      'structureRules' | 'titleRules' | 'paragraphRules' | 'seoGeoRules' | 'forbiddenRules' | 'notes'
    > | Pick<
      UpdateGeoV3VersionDto,
      'structureRules' | 'titleRules' | 'paragraphRules' | 'seoGeoRules' | 'forbiddenRules' | 'notes'
    >
  ) {
    const sections = [
      ['文章结构规则', value.structureRules],
      ['标题规则', value.titleRules],
      ['段落规则', value.paragraphRules],
      ['SEO / GEO 布局', value.seoGeoRules],
      ['禁用项', value.forbiddenRules],
      ['备注', value.notes],
    ]

    return sections
      .map(([title, content]) => {
        const text = this.toLongText(content)
        return text ? `## ${title}\n${text}` : ''
      })
      .filter(Boolean)
      .join('\n\n')
  }

  private toVariableItemCreateInputs(items: GeoV3VariableSetDto['items']): Prisma.GeoPromptVariableItemCreateWithoutSetInput[] {
    return items.map((item, index) => {
      const candidates = this.toCleanArray(item.candidates)
      if (candidates.length === 0) throw new BadRequestException(`变量“${item.label || item.name}”至少需要 1 个候选值`)
      const pickMin = item.pickMode === 'ONE' ? 1 : item.pickMin
      const pickMax = item.pickMode === 'ONE' ? 1 : item.pickMax
      if (pickMax < pickMin) throw new BadRequestException(`变量“${item.label || item.name}”的抽取上限不能小于下限`)
      if (pickMax > candidates.length) throw new BadRequestException(`变量“${item.label || item.name}”的抽取数量不能超过候选值数量`)

      return {
        name: this.requireText(item.name, '请填写变量字段名'),
        label: this.requireText(item.label, '请填写变量名称'),
        description: this.toLongText(item.description),
        pickMode: item.pickMode as GeoPromptV3VariablePickMode,
        pickMin,
        pickMax,
        candidates: candidates as unknown as Prisma.InputJsonValue,
        isActive: item.isActive ?? true,
        sortOrder: item.sortOrder ?? index,
      }
    })
  }

  private toProductCreateInput(payload: GeoV3ProductDto): Prisma.GeoMainProductProfileV3CreateInput {
    const randomContentPool = this.toCleanArray(payload.randomContentPool)
    const brandPool = this.toCleanArray(payload.brandPool ?? [])
    const sellingPointsPool = this.toCleanArray(payload.sellingPointsPool ?? [])
    const emphasisPool = this.toCleanArray(payload.emphasisPool ?? [])
    const randomPickMin = payload.randomPickMin
    const randomPickMax = payload.randomPickMax
    const brandPoolPickRange = resolvePromptV3BrandPoolPickRange(
      brandPool,
      payload.brandPoolPickMin ?? 0,
      payload.brandPoolPickMax ?? 0
    )
    const brandPoolPickMin = brandPoolPickRange.min
    const brandPoolPickMax = brandPoolPickRange.max
    const sellingPointPickMin = payload.sellingPointPickMin ?? 0
    const sellingPointPickMax = payload.sellingPointPickMax ?? 0
    const emphasisPickMin = payload.emphasisPickMin ?? 0
    const emphasisPickMax = payload.emphasisPickMax ?? 0

    this.validateProductPickRange(randomContentPool, randomPickMin, randomPickMax, '补充随机内容池')
    this.validateProductPickRange(brandPool, brandPoolPickMin, brandPoolPickMax, '品牌池')
    this.validateProductPickRange(sellingPointsPool, sellingPointPickMin, sellingPointPickMax, '主打卖点池')
    this.validateProductPickRange(emphasisPool, emphasisPickMin, emphasisPickMax, '强调点池')

    return {
      name: this.requireText(payload.name, '请填写产品档案名称'),
      brand: this.requireText(payload.brand, '请填写品牌'),
      productName: this.requireText(payload.productName, '请填写产品名'),
      category: this.requireText(payload.category, '请填写产品类型'),
      targetAudience: this.toShortText(payload.targetAudience),
      coreParameters: this.toLongText(payload.coreParameters),
      keyword: this.toShortText(payload.keyword),
      keywordMode: payload.keywordMode ?? 'exact',
      seoKeywords: this.toCleanArray(payload.seoKeywords ?? []) as unknown as Prisma.InputJsonValue,
      brandPool: brandPool as unknown as Prisma.InputJsonValue,
      brandPoolPickMin,
      brandPoolPickMax,
      requiredContent: this.toCleanArray(payload.requiredContent) as unknown as Prisma.InputJsonValue,
      randomContentPool: randomContentPool as unknown as Prisma.InputJsonValue,
      randomPickMin,
      randomPickMax,
      sellingPointsPool: sellingPointsPool as unknown as Prisma.InputJsonValue,
      sellingPointPickMin,
      sellingPointPickMax,
      emphasisPool: emphasisPool as unknown as Prisma.InputJsonValue,
      emphasisPickMin,
      emphasisPickMax,
      isActive: payload.isActive ?? true,
      sortOrder: payload.sortOrder ?? 0,
    }
  }

  private toProductUpdateInput(
    payload: UpdateGeoV3ProductDto,
    currentProduct: GeoMainProductProfileV3
  ): Prisma.GeoMainProductProfileV3UpdateInput {
    const randomContentPool = payload.randomContentPool !== undefined
      ? this.toCleanArray(payload.randomContentPool)
      : this.toStringArray(currentProduct.randomContentPool)
    const brandPool = payload.brandPool !== undefined
      ? this.toCleanArray(payload.brandPool)
      : this.toStringArray(currentProduct.brandPool ?? [])
    const sellingPointsPool = payload.sellingPointsPool !== undefined
      ? this.toCleanArray(payload.sellingPointsPool)
      : this.toStringArray(currentProduct.sellingPointsPool ?? [])
    const emphasisPool = payload.emphasisPool !== undefined
      ? this.toCleanArray(payload.emphasisPool)
      : this.toStringArray(currentProduct.emphasisPool ?? [])
    const randomPickMin = payload.randomPickMin ?? currentProduct.randomPickMin
    const randomPickMax = payload.randomPickMax ?? currentProduct.randomPickMax
    const brandPoolPickRange = resolvePromptV3BrandPoolPickRange(
      brandPool,
      payload.brandPoolPickMin ?? currentProduct.brandPoolPickMin,
      payload.brandPoolPickMax ?? currentProduct.brandPoolPickMax
    )
    const brandPoolPickMin = brandPoolPickRange.min
    const brandPoolPickMax = brandPoolPickRange.max
    const sellingPointPickMin = payload.sellingPointPickMin ?? currentProduct.sellingPointPickMin
    const sellingPointPickMax = payload.sellingPointPickMax ?? currentProduct.sellingPointPickMax
    const emphasisPickMin = payload.emphasisPickMin ?? currentProduct.emphasisPickMin
    const emphasisPickMax = payload.emphasisPickMax ?? currentProduct.emphasisPickMax

    this.validateProductPickRange(randomContentPool, randomPickMin, randomPickMax, '补充随机内容池')
    this.validateProductPickRange(brandPool, brandPoolPickMin, brandPoolPickMax, '品牌池')
    this.validateProductPickRange(sellingPointsPool, sellingPointPickMin, sellingPointPickMax, '主打卖点池')
    this.validateProductPickRange(emphasisPool, emphasisPickMin, emphasisPickMax, '强调点池')

    return {
      ...(payload.name !== undefined ? { name: this.requireText(payload.name, '请填写产品档案名称') } : {}),
      ...(payload.brand !== undefined ? { brand: this.requireText(payload.brand, '请填写品牌') } : {}),
      ...(payload.productName !== undefined ? { productName: this.requireText(payload.productName, '请填写产品名') } : {}),
      ...(payload.category !== undefined ? { category: this.requireText(payload.category, '请填写产品类型') } : {}),
      ...(payload.targetAudience !== undefined ? { targetAudience: this.toShortText(payload.targetAudience) } : {}),
      ...(payload.coreParameters !== undefined ? { coreParameters: this.toLongText(payload.coreParameters) } : {}),
      ...(payload.keyword !== undefined ? { keyword: this.toShortText(payload.keyword) } : {}),
      ...(payload.keywordMode !== undefined ? { keywordMode: payload.keywordMode } : {}),
      ...(payload.seoKeywords !== undefined ? { seoKeywords: this.toCleanArray(payload.seoKeywords) as unknown as Prisma.InputJsonValue } : {}),
      ...(payload.brandPool !== undefined ? { brandPool: brandPool as unknown as Prisma.InputJsonValue } : {}),
      ...(payload.brandPoolPickMin !== undefined || payload.brandPoolPickMax !== undefined || payload.brandPool !== undefined
        ? { brandPoolPickMin }
        : {}),
      ...(payload.brandPoolPickMin !== undefined || payload.brandPoolPickMax !== undefined || payload.brandPool !== undefined
        ? { brandPoolPickMax }
        : {}),
      ...(payload.requiredContent !== undefined ? { requiredContent: this.toCleanArray(payload.requiredContent) as unknown as Prisma.InputJsonValue } : {}),
      ...(payload.randomContentPool !== undefined ? { randomContentPool: randomContentPool as unknown as Prisma.InputJsonValue } : {}),
      ...(payload.randomPickMin !== undefined ? { randomPickMin: payload.randomPickMin } : {}),
      ...(payload.randomPickMax !== undefined ? { randomPickMax: payload.randomPickMax } : {}),
      ...(payload.sellingPointsPool !== undefined ? { sellingPointsPool: sellingPointsPool as unknown as Prisma.InputJsonValue } : {}),
      ...(payload.sellingPointPickMin !== undefined ? { sellingPointPickMin: payload.sellingPointPickMin } : {}),
      ...(payload.sellingPointPickMax !== undefined ? { sellingPointPickMax: payload.sellingPointPickMax } : {}),
      ...(payload.emphasisPool !== undefined ? { emphasisPool: emphasisPool as unknown as Prisma.InputJsonValue } : {}),
      ...(payload.emphasisPickMin !== undefined ? { emphasisPickMin: payload.emphasisPickMin } : {}),
      ...(payload.emphasisPickMax !== undefined ? { emphasisPickMax: payload.emphasisPickMax } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
      ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}),
    }
  }

  private validateProductPickRange(pool: string[], min: number, max: number, label = '随机内容池') {
    const cleanPool = this.toCleanArray(pool)
    if (max < min) throw new BadRequestException(`${label}抽取上限不能小于下限`)
    if (max > cleanPool.length) throw new BadRequestException(`${label}抽取数量不能超过内容池数量`)
  }

  private toVersionView(version: VersionWithVariableSets) {
    return {
      id: version.id,
      name: version.name,
      description: version.description,
      sourceArticleUrl: version.sourceArticleUrl,
      sourceArticleText: version.sourceArticleText,
      sourceArticleTitle: version.sourceArticleTitle,
      ruleText: version.ruleText || this.composeVersionRuleText(version),
      structureRules: version.structureRules,
      titleRules: version.titleRules,
      paragraphRules: version.paragraphRules,
      seoGeoRules: version.seoGeoRules,
      forbiddenRules: version.forbiddenRules,
      notes: version.notes,
      isActive: version.isActive,
      sortOrder: version.sortOrder,
      variableSets: version.variableSets?.map((set) => this.toVariableSetView(set)) ?? [],
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
    }
  }

  private toVariableSetView(set: VariableSetWithItems) {
    return {
      id: set.id,
      versionId: set.versionId,
      name: set.name,
      description: set.description,
      isActive: set.isActive,
      sortOrder: set.sortOrder,
      items: set.items.map((item) => ({
        id: item.id,
        setId: item.setId,
        name: item.name,
        label: item.label,
        description: item.description,
        pickMode: item.pickMode,
        pickMin: item.pickMin,
        pickMax: item.pickMax,
        candidates: this.toStringArray(item.candidates),
        isActive: item.isActive,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      createdAt: set.createdAt.toISOString(),
      updatedAt: set.updatedAt.toISOString(),
    }
  }

  private toProductView(product: GeoMainProductProfileV3) {
    const brandPool = this.toStringArray(product.brandPool ?? [])
    const brandPoolPickRange = resolvePromptV3BrandPoolPickRange(
      brandPool,
      product.brandPoolPickMin,
      product.brandPoolPickMax
    )

    return {
      id: product.id,
      name: product.name,
      brand: product.brand,
      productName: product.productName,
      category: product.category,
      targetAudience: product.targetAudience,
      coreParameters: product.coreParameters,
      keyword: product.keyword,
      keywordMode: product.keywordMode,
      seoKeywords: this.toStringArray(product.seoKeywords ?? []),
      brandPool,
      brandPoolPickMin: brandPoolPickRange.min,
      brandPoolPickMax: brandPoolPickRange.max,
      requiredContent: this.toStringArray(product.requiredContent),
      randomContentPool: this.toStringArray(product.randomContentPool),
      randomPickMin: product.randomPickMin,
      randomPickMax: product.randomPickMax,
      sellingPointsPool: this.toStringArray(product.sellingPointsPool ?? []),
      sellingPointPickMin: product.sellingPointPickMin,
      sellingPointPickMax: product.sellingPointPickMax,
      emphasisPool: this.toStringArray(product.emphasisPool ?? []),
      emphasisPickMin: product.emphasisPickMin,
      emphasisPickMax: product.emphasisPickMax,
      isActive: product.isActive,
      sortOrder: product.sortOrder,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    }
  }

  private toRunView(run: any, includeItems: boolean) {
    const items = Array.isArray(run.items) ? run.items : []

    return {
      id: run.id,
      mode: run.mode,
      fixedRulesMode: run.fixedRulesMode ?? GeoPromptV3FixedRulesMode.SYSTEM,
      status: run.status,
      versionId: run.versionId,
      variableSetId: run.variableSetId,
      productProfileId: run.productProfileId,
      versionName: run.versionName,
      variableSetName: run.variableSetName,
      productProfileName: run.productProfileName,
      topic: run.topic,
      extraRequirements: run.extraRequirements,
      articleUrl: run.articleUrl ?? '',
      articleText: includeItems ? run.articleText ?? '' : '',
      versionSnapshot: run.versionSnapshot,
      variableSetSnapshot: run.variableSetSnapshot,
      productSnapshot: run.productSnapshot,
      requestedCount: run.requestedCount,
      successCount: run.successCount,
      failedCount: run.failedCount,
      zipFileName: run.zipFileName,
      canDownload: run.successCount > 0 && Boolean(run.completedAt),
      lastError: run.lastError,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      items: includeItems
        ? items.map((item: any) => ({
            id: item.id,
            runId: item.runId,
            itemIndex: item.itemIndex,
            status: item.status,
            fileName: item.fileName,
            promptText: item.promptText,
            selectedVariables: item.selectedVariables,
            selectedProductContent: item.selectedProductContent,
            errorMessage: item.errorMessage,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
          }))
        : undefined,
      itemCount: items.length,
    }
  }

  private toPromptVersionInput(version: GeoPromptEngineV3Version): PromptV3VersionInput {
    return {
      name: version.name,
      description: version.description,
      sourceArticleUrl: version.sourceArticleUrl,
      sourceArticleTitle: version.sourceArticleTitle,
      ruleText: version.ruleText || this.composeVersionRuleText(version),
      notes: version.notes,
    }
  }

  private toPromptVariableItemInput(item: GeoPromptVariableItem): PromptV3VariableItemInput {
    return {
      name: item.name,
      label: item.label,
      description: item.description,
      pickMode: item.pickMode,
      pickMin: item.pickMin,
      pickMax: item.pickMax,
      candidates: this.toStringArray(item.candidates),
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    }
  }

  private toPromptProductInput(product: GeoMainProductProfileV3): PromptV3ProductInput {
    const brandPool = this.toStringArray(product.brandPool ?? [])
    const brandPoolPickRange = resolvePromptV3BrandPoolPickRange(
      brandPool,
      product.brandPoolPickMin,
      product.brandPoolPickMax
    )

    return {
      name: product.name,
      brand: product.brand,
      productName: product.productName,
      category: product.category,
      targetAudience: product.targetAudience,
      coreParameters: product.coreParameters,
      keyword: product.keyword,
      keywordMode: product.keywordMode === 'recompose' ? 'recompose' : 'exact',
      seoKeywords: this.toStringArray(product.seoKeywords ?? []),
      brandPool,
      brandPoolPickMin: brandPoolPickRange.min,
      brandPoolPickMax: brandPoolPickRange.max,
      requiredContent: this.toStringArray(product.requiredContent),
      randomContentPool: this.toStringArray(product.randomContentPool),
      randomPickMin: product.randomPickMin,
      randomPickMax: product.randomPickMax,
      sellingPointsPool: this.toStringArray(product.sellingPointsPool ?? []),
      sellingPointPickMin: product.sellingPointPickMin,
      sellingPointPickMax: product.sellingPointPickMax,
      emphasisPool: this.toStringArray(product.emphasisPool ?? []),
      emphasisPickMin: product.emphasisPickMin,
      emphasisPickMax: product.emphasisPickMax,
    }
  }

  private async requestPromptV3GenerateOutput(input: {
    providerConfig: GeoProviderConfig
    article: string
    fixedRules: string
    fixedRulesMode: PromptV3FixedRulesMode
    version: PromptV3VersionInput
    variableSetName: string
    selectedVariables: PromptV3SelectedVariable[]
    product: PromptV3ProductInput
    selectedProductContent: PromptV3SelectedProductContent
    topic?: string
    extraRequirements?: string
    variationIndex?: number
  }) {
    const client = this.createAnthropicClient(input.providerConfig, {
      timeout: GENERATE_V3_REQUEST_TIMEOUT_MS,
      maxRetries: 0,
    })
    const response = await client.messages.create({
      model: input.providerConfig.model || DEFAULT_MODEL,
      max_tokens: DEFAULT_GENERATE_V3_MAX_TOKENS,
      temperature: input.variationIndex && input.variationIndex > 1 ? 0.7 : 0.35,
      system: buildPromptV3GenerateSystemPrompt({ fixedRulesMode: input.fixedRulesMode }),
      messages: [
        {
          role: 'user',
          content: buildPromptV3GenerateUserMessage({
            article: input.article,
            fixedRules: input.fixedRules,
            fixedRulesMode: input.fixedRulesMode,
            version: input.version,
            variableSetName: input.variableSetName,
            selectedVariables: input.selectedVariables,
            product: input.product,
            selectedProductContent: input.selectedProductContent,
            topic: input.topic,
            extraRequirements: input.extraRequirements,
            variationIndex: input.variationIndex,
          }),
        },
      ],
    })
    const promptText = normalizePromptV3GeneratedOutput(
      this.readAnthropicText(response),
      response.stop_reason
    )

    if (!promptText) {
      throw new BadRequestException('AI 返回内容为空')
    }

    return promptText
  }

  private async getPromptV3FixedRules() {
    const fixedRules = await this.ensurePromptV3FixedRules()
    return fixedRules?.ruleText?.trim() || DEFAULT_PROMPT_ENGINE_V2_FIXED_RULES
  }

  private async ensurePromptV3FixedRules() {
    const fallbackRules = await this.resolvePromptV3DefaultFixedRules()

    return this.prisma.geoPromptEngineV3FixedRules.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        ruleText: fallbackRules,
      },
    })
  }

  private async resolvePromptV3DefaultFixedRules() {
    const v2FixedRules = await this.prisma.geoPromptEngineV2FixedRules.findUnique({ where: { id: 1 } })
    return buildDefaultPromptV3FixedRules(v2FixedRules?.ruleText?.trim() || DEFAULT_PROMPT_ENGINE_V2_FIXED_RULES)
  }

  private toFixedRulesView(fixedRules: { ruleText: string; updatedAt: Date }) {
    return {
      ruleText: fixedRules.ruleText,
      updatedAt: fixedRules.updatedAt.toISOString(),
    }
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>
  ) {
    const results: R[] = new Array(items.length)
    let nextIndex = 0
    const workerCount = Math.max(1, Math.min(concurrency, items.length))

    await Promise.all(Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex
        nextIndex += 1
        results[currentIndex] = await worker(items[currentIndex], currentIndex)
      }
    }))

    return results
  }

  private createAnthropicClient(
    config: GeoProviderConfig,
    options: { timeout?: number; maxRetries?: number } = {}
  ) {
    return new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined,
      timeout: options.timeout ?? DEFAULT_REQUEST_TIMEOUT_MS,
      maxRetries: options.maxRetries ?? 1,
    })
  }

  private resolveVersionDraftModel(model?: string | null, fallbackModel?: string | null) {
    return model?.trim() || DEFAULT_VERSION_DRAFT_MODEL || fallbackModel?.trim() || DEFAULT_MODEL
  }

  private async resolveVersionDraftArticleText(articleText?: string, articleUrl?: string) {
    const trimmedArticleText = articleText?.trim()
    if (trimmedArticleText) return trimmedArticleText

    const trimmedArticleUrl = articleUrl?.trim()
    if (!trimmedArticleUrl) return ''

    return fetchArticle(trimmedArticleUrl)
  }

  private normalizeVersionDraftMessages(
    messages: Array<{ role: 'user' | 'assistant'; content: string; createdAt?: string }>
  ): PromptV3VersionDraftMessage[] {
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
      .slice(-80)
  }

  private readVersionDraftMessages(value: Prisma.JsonValue): PromptV3VersionDraftMessage[] {
    if (!Array.isArray(value)) return []

    return this.normalizeVersionDraftMessages(
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

  private toVersionDraftMessageJson(messages: PromptV3VersionDraftMessage[]): Prisma.InputJsonValue {
    return messages.map((message) => ({
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    }))
  }

  private async findVersionDraftSessionRecord(id: number, includeArchived = false) {
    const session = await this.prisma.geoPromptV3VersionDraftSession.findUnique({
      where: { id },
    })

    if (!session || (!includeArchived && session.status === 'ARCHIVED')) {
      throw new NotFoundException('V3 AI 对话会话不存在')
    }

    return session
  }

  private toVersionDraftSessionView(session: GeoPromptV3VersionDraftSession) {
    const messages = this.readVersionDraftMessages(session.messages as Prisma.JsonValue)
    const lastMessage = [...messages].reverse().find((item) => item.content.trim())
    const suggestedRuleText = this.sanitizeVersionDraftRuleText(session.suggestedRuleText)

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
      suggestedRuleText,
      suggestedVariableSetDraft: this.normalizeVersionDraftVariableSet(session.suggestedVariableSetDraft),
      sourceV2SessionId: session.sourceV2SessionId,
      sourceType: this.toVersionDraftSessionSourceType(session.sourceType),
      sourceBatchTxtJobId: session.sourceBatchTxtJobId,
      sourceBatchTxtJobItemId: session.sourceBatchTxtJobItemId,
      lastMessagePreview: lastMessage ? this.toShortText(lastMessage.content, 90) : '',
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    }
  }

  private toVersionDraftSessionStatus(value: string): VersionDraftSessionStatus {
    if (value === 'APPLIED' || value === 'ARCHIVED') return value
    return 'ACTIVE'
  }

  private toVersionDraftSessionSourceType(value: string): VersionDraftSessionSourceType {
    if (value === 'TXT_BATCH' || value === 'V2_IMPORT') return value
    return 'MANUAL_CHAT'
  }

  private toVersionDraftSessionTitle(
    title: string | undefined,
    messages: PromptV3VersionDraftMessage[],
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

    return `V3 AI 建版会话 ${new Date().toLocaleString('zh-CN', { hour12: false })}`
  }

  private buildVersionDraftFallbackNotes(
    messages: PromptV3VersionDraftMessage[],
    notes?: string
  ) {
    const assistantSummary = [...messages]
      .reverse()
      .find((message) => message.role === 'assistant')
      ?.content

    return [notes?.trim(), assistantSummary ? `AI 对话摘要：${assistantSummary.slice(0, 1200)}` : '']
      .filter(Boolean)
      .join('\n\n')
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
      if (event) safeWrite(event)
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
        response.status(500).json({ error: error instanceof Error ? error.message : '生成失败' })
        return
      }

      finishStream({ type: 'error', content: error instanceof Error ? error.message : '生成失败' })
    }
  }

  private buildLocalVersionDraft(article: string, articleUrl = '', notes = ''): VersionDraftSuggestion {
    const title = article.split(/\n+/).find((line) => line.trim().length > 8)?.trim().slice(0, 80) ?? ''
    const ruleText = [
      '## 文章结构规则',
      '先用开头建立问题场景，再分层展开选购逻辑、核心对比、主推理由和结尾总结；保留竞对文章的信息展开节奏，但不要照抄原文。',
      '',
      '## 标题规则',
      '标题需要围绕用户搜索意图展开，包含核心品类词和明确利益点，避免夸张承诺。',
      '',
      '## 段落规则',
      '每段只承担一个信息任务，段落之间要有清晰递进关系；重点段落可以使用小标题或列表增强可读性。',
      '',
      '## SEO / GEO 布局',
      '核心关键词自然进入标题、开头、主体小标题和结尾；GEO 表达要给出清晰判断、理由和可引用的产品事实。',
      '',
      '## 禁用项',
      '禁止虚构来源、禁止堆砌关键词、禁止暴露后台配置或内部处理过程。',
    ].join('\n')

    return {
      name: title ? `${title.slice(0, 18)}结构版` : 'V3 文章结构版',
      description: '基于单篇竞对文章整理出的 V3 结构规则草稿。',
      sourceArticleTitle: title,
      ruleText,
      notes: notes || (articleUrl ? `来源 URL：${articleUrl}` : ''),
      variableSetDraft: this.normalizeVersionDraftVariableSet(null, title ? `${title.slice(0, 18)}变量池` : 'V3 差异化变量池'),
    }
  }

  private normalizeVersionDraftSuggestion(value: unknown): VersionDraftSuggestion {
    const source = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
    const fallback = this.buildLocalVersionDraft('')
    const read = (key: keyof VersionDraftSuggestion) => {
      const field = source[key]
      return typeof field === 'string' && field.trim() ? field.trim() : fallback[key]
    }
    const sanitizedRuleText = this.sanitizeVersionDraftRuleText(
      typeof source.ruleText === 'string' ? source.ruleText : ''
    )
    const ruleText = sanitizedRuleText
      ? sanitizedRuleText
      : this.composeVersionRuleText({
        structureRules: typeof source.structureRules === 'string' ? source.structureRules : '',
        titleRules: typeof source.titleRules === 'string' ? source.titleRules : '',
        paragraphRules: typeof source.paragraphRules === 'string' ? source.paragraphRules : '',
        seoGeoRules: typeof source.seoGeoRules === 'string' ? source.seoGeoRules : '',
        forbiddenRules: typeof source.forbiddenRules === 'string' ? source.forbiddenRules : '',
        notes: typeof source.notes === 'string' ? source.notes : '',
      }) || fallback.ruleText
    const variableSetDraft = this.normalizeVersionDraftVariableSet(
      source.variableSetDraft,
      `${typeof source.name === 'string' && source.name.trim() ? source.name.trim() : fallback.name}变量池`
    )

    return {
      name: read('name') as string,
      description: read('description') as string,
      sourceArticleTitle: read('sourceArticleTitle') as string,
      ruleText,
      notes: read('notes') as string,
      variableSetDraft,
    }
  }

  private normalizeVersionDraftVariableSet(
    value: unknown,
    fallbackName = 'V3 差异化变量池'
  ): PromptV3VersionDraftVariableSet {
    const source = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
    const rawItems = Array.isArray(source.items) ? source.items : []
    const items = rawItems
      .map((item, index) => {
        const record = typeof item === 'object' && item !== null ? item as Record<string, unknown> : {}
        const candidates = Array.isArray(record.candidates)
          ? Array.from(new Set(record.candidates.map((candidate) => String(candidate).trim()).filter(Boolean)))
          : []
        const label = typeof record.label === 'string' && record.label.trim()
          ? record.label.trim()
          : `变量 ${index + 1}`
        const name = typeof record.name === 'string' && record.name.trim()
          ? record.name.trim().replace(/\s+/g, '_').slice(0, 80)
          : `variable_${index + 1}`

        return {
          name,
          label,
          description: typeof record.description === 'string' ? record.description.trim() : '',
          candidates,
          pickMode: 'ONE' as const,
          pickMin: 1,
          pickMax: 1,
          isActive: record.isActive !== false,
          sortOrder: Number.isFinite(Number(record.sortOrder)) ? Math.max(0, Math.floor(Number(record.sortOrder))) : index,
        }
      })
      .filter((item) => item.candidates.length > 0)

    return {
      name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : fallbackName,
      description: typeof source.description === 'string' ? source.description.trim() : '',
      isActive: source.isActive !== false,
      sortOrder: Number.isFinite(Number(source.sortOrder)) ? Math.max(0, Math.floor(Number(source.sortOrder))) : 0,
      items,
    }
  }

  private toVersionDraftVariableSetJson(value: PromptV3VersionDraftVariableSet): Prisma.InputJsonValue {
    return {
      name: value.name,
      description: value.description,
      isActive: value.isActive,
      sortOrder: value.sortOrder,
      items: value.items.map((item) => ({
        name: item.name,
        label: item.label,
        description: item.description,
        candidates: item.candidates,
        pickMode: item.pickMode,
        pickMin: item.pickMin,
        pickMax: item.pickMax,
        isActive: item.isActive,
        sortOrder: item.sortOrder,
      })),
    }
  }

  private buildPromptV3VersionDraftFallbackSuggestion(
    messages: PromptV3VersionDraftMessage[],
    notes?: string
  ): VersionDraftSuggestion | null {
    const assistantMessage = [...messages]
      .reverse()
      .find((message) => message.role === 'assistant' && message.content.trim())

    if (!assistantMessage) return null

    const firstUserMessage = messages.find((message) => message.role === 'user')?.content.trim()
    const name = firstUserMessage ? this.toShortText(firstUserMessage, 28) : 'AI 建版规则'
    const parsed = this.parsePromptV3VersionDraftFallbackContent(assistantMessage.content, `${name}变量池`)
    const ruleText = this.sanitizeVersionDraftRuleText(parsed.ruleText)

    if (!ruleText) return null

    return this.normalizeVersionDraftSuggestion({
      name,
      description: notes?.trim() || '模型结构化归档不稳定时，系统已使用最近一次 AI 回复作为 V3 版本规则草稿。',
      sourceArticleTitle: '',
      ruleText,
      notes: notes?.trim() ?? '',
      variableSetDraft: parsed.variableSetDraft,
    })
  }

  private parsePromptV3VersionDraftFallbackContent(content: string, fallbackVariableSetName: string) {
    const normalized = content
      .replace(/\r\n/g, '\n')
      .replace(/\u00a0/g, ' ')
      .trim()
    const lines = normalized.split('\n')
    const variableHeadingIndex = this.findPromptV3VariableHeadingIndex(lines)
    const ruleLines = variableHeadingIndex === -1 ? lines : lines.slice(0, variableHeadingIndex)
    const variableLines = variableHeadingIndex === -1 ? [] : lines.slice(variableHeadingIndex + 1)
    const ruleText = this.cleanPromptV3FallbackRuleText(ruleLines)
    const variableSetDraft = this.parsePromptV3VersionDraftFallbackVariables(
      variableLines,
      fallbackVariableSetName
    )

    return {
      ruleText,
      variableSetDraft,
    }
  }

  private sanitizeVersionDraftRuleText(value: string) {
    const normalized = value
      .replace(/\r\n/g, '\n')
      .replace(/\u00a0/g, ' ')
      .trim()
    if (!normalized) return ''

    const lines = normalized.split('\n')
    const ruleTextHeadingIndex = this.findPromptV3RuleTextHeadingIndex(lines)
    const ruleStartIndex = ruleTextHeadingIndex >= 0
      ? ruleTextHeadingIndex + 1
      : this.findPromptV3RuleStartIndex(lines)
    const candidateLines = ruleStartIndex >= 0 ? lines.slice(ruleStartIndex) : lines
    const variableHeadingIndex = this.findPromptV3VariableHeadingIndex(candidateLines)
    const ruleLines = variableHeadingIndex === -1
      ? candidateLines
      : candidateLines.slice(0, variableHeadingIndex)
    const cleaned = this.cleanPromptV3FallbackRuleText(ruleLines)
    if (!cleaned) return ''

    const firstLine = cleaned.split('\n').find((line) => line.trim())?.trim() ?? ''
    if (this.isPromptV3VariableHeading(firstLine)) return ''
    if (/^variablesetdraft\b/i.test(firstLine)) return ''
    if (/^#?\s*变量(池|候选|组)\b/i.test(firstLine)) return ''
    if (!this.isUsablePromptV3RuleText(cleaned)) return ''

    return cleaned
  }

  private ensureUsablePromptV3RuleText(value: string) {
    const ruleText = this.sanitizeVersionDraftRuleText(value)
    if (!ruleText) {
      throw new BadRequestException(
        'AI 整理结果不像完整版本规则，可能混入了对话总结或变量池内容。请补充反馈后重新整理。'
      )
    }

    return ruleText
  }

  private findPromptV3RuleTextHeadingIndex(lines: string[]) {
    return lines.findIndex((line) => /^#{1,6}\s*ruleText\b/i.test(line.trim()))
  }

  private findPromptV3RuleStartIndex(lines: string[]) {
    return lines.findIndex((line) => {
      const trimmed = line.trim()
      if (/^\*\*版本名称[：:]/.test(trimmed)) return true
      if (/^#{1,6}\s*V3\b/i.test(trimmed)) return true
      if (/^#{1,6}\s*.*版本规则/.test(trimmed)) return true
      return /^#{1,6}\s*(文章定位|标题规则|标题|开头规则|主体结构|文章结构|品牌段落|段落规则|排序规则|SEO|GEO|禁用项)/i.test(trimmed)
    })
  }

  private findPromptV3VariableHeadingIndex(lines: string[]) {
    return lines.findIndex((line) => this.isPromptV3VariableHeading(line.trim()))
  }

  private isPromptV3VariableHeading(line: string) {
    return /^#{1,6}\s*(variablesetdraft\b|变量池|变量候选|差异化变量|变量组\b)/i.test(line)
      || /^\*\*\s*(variablesetdraft\b|变量池|变量候选|差异化变量|变量组\b)/i.test(line)
      || /^variablesetdraft\s*[：:（(候选]/i.test(line)
  }

  private isUsablePromptV3RuleText(ruleText: string) {
    const lines = ruleText.split('\n')
    const headingCount = lines.filter((line) => {
      const trimmed = line.trim()
      return /^#{1,6}\s+/.test(trimmed) || /^\*\*.*(规则|版本名称|适用品类).*[:：]/.test(trimmed)
    }).length
    const hasRuleKeywords = /(标题规则|开头规则|文章结构|主体结构|品牌段落|段落规则|SEO|GEO|禁用项|结尾规则)/.test(ruleText)
    const looksLikeConversationalSummary =
      /(下一步你可以|需要做哪一步|目前\s*V3\s*版本规则整理完毕|已完成的内容|好的，variableSetDraft)/.test(ruleText)

    if (ruleText.length >= MIN_USABLE_RULE_TEXT_LENGTH) return true
    if (looksLikeConversationalSummary && headingCount < 2) return false
    if (ruleText.length < 600 && headingCount < 2) return false
    return headingCount >= 2 || hasRuleKeywords
  }

  private cleanPromptV3FallbackRuleText(lines: string[]) {
    return lines
      .filter((line) => {
        const trimmed = line.trim()
        if (/^-{3,}$/.test(trimmed)) return false
        if (/^正式版整理完毕/.test(trimmed)) return false
        if (/^如需/.test(trimmed)) return false
        return true
      })
      .join('\n')
      .trim()
  }

  private parsePromptV3VersionDraftFallbackVariables(lines: string[], fallbackName: string) {
    const items = lines
      .map((line, index) => {
        const trimmed = line.trim()
        const match = trimmed.match(/^[-*]\s*(.+?)\s*[：:]\s*(.+)$/)
        if (!match) return null

        const label = match[1]
          .replace(/[`"'“”]/g, '')
          .replace(/[［\[\]］]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
        const description = match[2].trim()
        if (!label || !description) return null

        const splitCandidates = description
          .split(/[、；;]/)
          .map((candidate) => candidate.trim())
          .filter(Boolean)
        const candidates = splitCandidates.length > 1 ? splitCandidates : [description]

        return {
          name: this.toPromptV3FallbackVariableName(label, index),
          label,
          description,
          candidates,
          pickMode: 'ONE' as const,
          pickMin: 1,
          pickMax: 1,
          isActive: true,
          sortOrder: index,
        }
      })
      .filter(Boolean) as PromptV3VersionDraftVariableSet['items']

    return this.normalizeVersionDraftVariableSet({
      name: fallbackName,
      description: items.length > 0 ? '从 AI 对话中的 variableSetDraft 草稿提取，候选值和抽取数量可继续手动调整。' : '',
      isActive: true,
      sortOrder: 0,
      items,
    })
  }

  private toPromptV3FallbackVariableName(label: string, index: number) {
    const asciiName = label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')

    return asciiName || `variable_${index + 1}`
  }

  private async parseVersionDraftSuggestionWithRepair(outputText: string, providerConfig: GeoProviderConfig) {
    const parsed = this.parseVersionDraftSuggestionFromText(outputText)
    if (parsed) return parsed

    try {
      return await this.repairPromptV3VersionDraftWithFallbackModel(outputText, providerConfig)
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'AI 返回内容无法整理为 V3 版本草稿，请重试一次'
      )
    }
  }

  private parseVersionDraftSuggestionFromText(text: string) {
    const parsed = this.parseJsonFromText(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

    const source = parsed as Record<string, unknown>
    const hasRuleText = typeof source.ruleText === 'string' && this.sanitizeVersionDraftRuleText(source.ruleText).length > 0
    const hasLegacyRuleText =
      typeof source.structureRules === 'string' ||
      typeof source.titleRules === 'string' ||
      typeof source.paragraphRules === 'string' ||
      typeof source.seoGeoRules === 'string' ||
      typeof source.forbiddenRules === 'string'
    const variableSetDraft = source.variableSetDraft
    const hasVariableSetDraft =
      variableSetDraft !== null &&
      typeof variableSetDraft === 'object' &&
      !Array.isArray(variableSetDraft) &&
      Array.isArray((variableSetDraft as Record<string, unknown>).items)

    if ((!hasRuleText && !hasLegacyRuleText) || !hasVariableSetDraft) return null

    return parsed
  }

  private async repairPromptV3VersionDraftWithFallbackModel(rawContent: string, config: GeoProviderConfig) {
    const client = this.createAnthropicClient(config)
    const response = await client.messages.create({
      model: VERSION_DRAFT_REPAIR_MODEL,
      max_tokens: DEFAULT_VERSION_DRAFT_REPAIR_MAX_TOKENS,
      temperature: 0,
      system: buildPromptV3VersionDraftRepairSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: buildPromptV3VersionDraftRepairUserMessage({
            rawContent: rawContent.slice(0, 10000),
          }),
        },
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: this.buildVersionDraftOutputSchema(),
        },
      },
    })

    const parsed = this.parseVersionDraftSuggestionFromText(this.readAnthropicText(response))
    if (!parsed) {
      throw new BadRequestException('AI 返回内容无法整理为 V3 版本草稿，请重试一次')
    }

    return parsed
  }

  private parseVariableSetDraftFromText(text: string, fallbackName: string) {
    const parsed = this.parseJsonFromText(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return this.normalizeVersionDraftVariableSet(null, fallbackName)
    }

    const source = parsed as Record<string, unknown>
    const variableSetSource =
      typeof source.variableSetDraft === 'object' && source.variableSetDraft !== null
        ? source.variableSetDraft
        : source

    return this.normalizeVersionDraftVariableSet(variableSetSource, fallbackName)
  }

  private buildVariableSetDraftOutputSchema() {
    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        isActive: { type: 'boolean' },
        sortOrder: { type: 'number' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string' },
              label: { type: 'string' },
              description: { type: 'string' },
              candidates: {
                type: 'array',
                items: { type: 'string' },
              },
              pickMode: {
                type: 'string',
                enum: ['ONE', 'MANY'],
              },
              pickMin: { type: 'number' },
              pickMax: { type: 'number' },
              isActive: { type: 'boolean' },
              sortOrder: { type: 'number' },
            },
            required: [
              'name',
              'label',
              'description',
              'candidates',
              'pickMode',
              'pickMin',
              'pickMax',
              'isActive',
              'sortOrder',
            ],
          },
        },
      },
      required: ['name', 'description', 'isActive', 'sortOrder', 'items'],
    } as const
  }

  private buildVersionDraftOutputSchema() {
    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        sourceArticleTitle: { type: 'string' },
        ruleText: { type: 'string' },
        notes: { type: 'string' },
        variableSetDraft: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            isActive: { type: 'boolean' },
            sortOrder: { type: 'number' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                  label: { type: 'string' },
                  description: { type: 'string' },
                  candidates: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  pickMode: {
                    type: 'string',
                    enum: ['ONE', 'MANY'],
                  },
                  pickMin: { type: 'number' },
                  pickMax: { type: 'number' },
                  isActive: { type: 'boolean' },
                  sortOrder: { type: 'number' },
                },
                required: [
                  'name',
                  'label',
                  'description',
                  'candidates',
                  'pickMode',
                  'pickMin',
                  'pickMax',
                  'isActive',
                  'sortOrder',
                ],
              },
            },
          },
          required: ['name', 'description', 'isActive', 'sortOrder', 'items'],
        },
      },
      required: ['name', 'description', 'sourceArticleTitle', 'ruleText', 'notes', 'variableSetDraft'],
    } as const
  }

  private readAnthropicText(response: Anthropic.Messages.Message) {
    return response.content
      .map((block) => block.type === 'text' ? block.text : '')
      .join('')
      .trim()
  }

  private parseJsonFromText(text: string) {
    try {
      return JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) return null

      try {
        return JSON.parse(match[0])
      } catch {
        return null
      }
    }
  }

  private toStringArray(value: Prisma.JsonValue) {
    return Array.isArray(value)
      ? value.map((item) => String(item).trim()).filter(Boolean)
      : []
  }

  private toJsonObject(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return value as Record<string, Prisma.JsonValue>
  }

  private toCleanArray(value?: string[]) {
    return Array.from(new Set((value ?? []).map((item) => String(item).trim()).filter(Boolean)))
  }

  private requireText(value: string | undefined, message: string) {
    const text = this.toShortText(value)
    if (!text) throw new BadRequestException(message)
    return text
  }

  private requireLongText(value: string | undefined, message: string) {
    const text = this.toLongText(value)
    if (!text) throw new BadRequestException(message)
    return text
  }

  private toShortText(value?: string, maxLength = MAX_SHORT_TEXT_LENGTH) {
    return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength)
  }

  private toLongText(value?: string, maxLength = 100_000) {
    return String(value ?? '').trim().slice(0, maxLength)
  }

  private buildPromptV3FileName(
    run: number | {
      dateCode?: string
      createdAt?: Date
      versionName?: string
      productProfileName?: string
    },
    itemIndex: number
  ) {
    if (typeof run === 'number') {
      return `geo-v3-run-${run}-${String(itemIndex).padStart(3, '0')}.txt`
    }

    return `${this.toPromptV3DateCode(run)}_${this.toSafeFileSegment(run.versionName || 'V3')}_${this.toSafeFileSegment(run.productProfileName || '主推产品')}_${itemIndex}.txt`
  }

  private buildPromptV3ZipFileName(
    run: {
      dateCode?: string
      createdAt?: Date
      versionName?: string
      productProfileName?: string
    },
    sequenceStart: number,
    sequenceEnd: number
  ) {
    return `${this.toPromptV3DateCode(run)}_${this.toSafeFileSegment(run.versionName || 'V3')}_${this.toSafeFileSegment(run.productProfileName || '主推产品')}_${sequenceStart}-${sequenceEnd}.zip`
  }

  private toPromptV3DateCode(run: { dateCode?: string; createdAt?: Date }) {
    return run.dateCode || this.toShanghaiDateCode(run.createdAt || new Date())
  }

  private toSafeFileSegment(value: string) {
    return value
      .trim()
      .replace(/[\\/:*?"<>|\r\n]+/g, '_')
      .replace(/\s+/g, ' ')
      .slice(0, 80) || '未命名'
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
}
