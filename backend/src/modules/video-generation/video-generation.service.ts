import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import {
  Prisma,
  VideoGenerationAssetKind,
  VideoGenerationAssetPriority,
  VideoGenerationAssetSourceType,
  VideoGenerationAssetStatus,
  VideoGenerationCampaignStatus,
  VideoGenerationSourceType,
  VideoGenerationTaskStatus,
  VideoGenerationTemplateType,
} from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PrismaService } from '../../common/prisma.service'
import { CreateVideoGenerationTaskDto } from './dto/create-video-generation-task.dto'
import {
  CreateVideoGenerationAssetDto,
  CreateVideoGenerationCampaignDto,
  CreateVideoGenerationCampaignTasksDto,
  CreateVideoGenerationTemplateDto,
  GenerateVideoAssetImageDto,
  GenerateVideoStoryboardDto,
  ImportVideoGenerationTaskDto,
  PlanVideoGenerationAssetsDto,
  UpdateVideoGenerationAssetDto,
  UpdateVideoGenerationTemplateDto,
} from './dto/video-generation-workbench.dto'

const DEFAULT_ARK_VIDEO_API_BASE_URL = 'https://ark.cn-beijing.volces.com/api/plan/v3'
const DEFAULT_SEEDANCE_MODEL = 'doubao-seedance-1.5-pro'
const SEEDANCE_RATIOS = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16', 'adaptive']
const SEEDANCE_RESOLUTIONS = ['480p', '720p', '1080p']
const SEEDANCE_MODEL_CONFIGS: Record<string, { minDuration: number; maxDuration: number; resolutions: string[] }> = {
  'doubao-seedance-1.5-pro': {
    minDuration: 4,
    maxDuration: 12,
    resolutions: SEEDANCE_RESOLUTIONS,
  },
}
const SEEDANCE_MAX_IMAGE_REFERENCES = 9
const SEEDANCE_MAX_VIDEO_REFERENCES = 3
const SEEDANCE_MAX_AUDIO_REFERENCES = 3
const VIDEO_STORAGE_ROOT = resolve(process.cwd(), 'storage', 'video-generation')
const VIDEO_FILE_CATEGORIES = ['assets', 'videos'] as const

type SeedanceReferenceType = 'image_url' | 'video_url' | 'audio_url'
type SeedanceContentItem =
  | {
      type: 'text'
      text: string
    }
  | {
      type: SeedanceReferenceType
      image_url?: { url: string }
      video_url?: { url: string }
      audio_url?: { url: string }
      role?: string
    }

type VideoTemplateRecord = Prisma.VideoGenerationTemplateGetPayload<Record<string, never>>
type VideoCampaignWithRelations = Prisma.VideoGenerationCampaignGetPayload<{
  include: {
    template: true
    tasks: true
  }
}>
type VideoAssetRecord = Prisma.VideoGenerationAssetGetPayload<Record<string, never>>
type VideoStoryboardRecord = Prisma.VideoGenerationStoryboardGetPayload<Record<string, never>>
type VideoTaskRecord = Prisma.VideoGenerationTaskGetPayload<Record<string, never>>
type UploadedVideoGenerationImageFile = {
  buffer: Buffer
  originalname: string
  mimetype: string
  size: number
}

type SourceContext = {
  productSnapshot?: Record<string, unknown>
  sourceSnapshot?: Record<string, unknown>
  defaultTopics: string[]
}

type PlannedAssetInput = {
  planKey: string
  title: string
  kind: VideoGenerationAssetKind
  role: string
  priority: VideoGenerationAssetPriority
  stage: string
  purpose: string
  brief: string
  prompt: string
  toolHint: string
  sourceFields: string[]
}

type StoryboardScene = {
  index: number
  timeRange: string
  title: string
  visual: string
  narration: string
  seedancePrompt: string
  assetRoles: string[]
}

const DEFAULT_VIDEO_TEMPLATES: Array<Omit<Prisma.VideoGenerationTemplateCreateInput, 'campaigns'>> = [
  {
    key: 'cat-talk',
    name: '角色口播',
    type: VideoGenerationTemplateType.CAT_TALK,
    description: '适合虚拟主持、拟人品牌角色、轻松讲解类产品短视频。',
    model: DEFAULT_SEEDANCE_MODEL,
    resolution: '720p',
    ratio: '9:16',
    duration: 5,
    generateAudio: true,
    watermark: false,
    sortOrder: 60,
    promptTemplate:
      '竖屏 {{duration}} 秒角色口播短视频，一位亲和的虚拟主持或品牌角色在干净真实的场景中面对镜头自然讲解。主题：{{topic}}。产品信息：品牌 {{brand}}，产品名 {{productName}}，品类 {{category}}，目标人群 {{targetAudience}}。必须体现：{{requiredContent}}。卖点：{{sellingPoints}}。强调点：{{emphasis}}。语气轻松可信，镜头稳定，字幕简洁，结尾给出一句自然的推荐。',
    isActive: true,
  },
  {
    key: 'human-talk',
    name: '真人口播',
    type: VideoGenerationTemplateType.HUMAN_TALK,
    description: '适合创始人、测评博主、品牌讲解类口播视频。',
    model: DEFAULT_SEEDANCE_MODEL,
    resolution: '720p',
    ratio: '9:16',
    duration: 6,
    generateAudio: true,
    watermark: false,
    sortOrder: 10,
    promptTemplate:
      '竖屏 {{duration}} 秒真人口播短视频，一位自然亲和的博主在真实生活场景中对镜头讲解。主题：{{topic}}。围绕 {{brand}} {{productName}} 展开，品类是 {{category}}，目标人群是 {{targetAudience}}。口播要覆盖必写内容：{{requiredContent}}，并突出卖点：{{sellingPoints}}。节奏清楚，画面干净，有轻微手势和表情变化，不要夸张营销腔。',
    isActive: true,
  },
  {
    key: 'product-showcase',
    name: '产品展示',
    type: VideoGenerationTemplateType.PRODUCT_SHOWCASE,
    description: '适合展示产品外观、使用场景、卖点特写。',
    model: DEFAULT_SEEDANCE_MODEL,
    resolution: '720p',
    ratio: '9:16',
    duration: 6,
    generateAudio: true,
    watermark: false,
    sortOrder: 20,
    promptTemplate:
      '竖屏 {{duration}} 秒产品展示短视频，镜头从真实使用场景切入，展示 {{brand}} {{productName}}。主题：{{topic}}。画面包括产品整体、关键细节、使用动作和结果反馈。品类：{{category}}。目标人群：{{targetAudience}}。必须出现：{{requiredContent}}。重点呈现：{{sellingPoints}}。镜头语言克制高级，字幕只保留关键短句。',
    isActive: true,
  },
  {
    key: 'knowledge-explainer',
    name: '知识讲解',
    type: VideoGenerationTemplateType.KNOWLEDGE_EXPLAINER,
    description: '适合把 V3 Prompt 或文章主题转成短知识点视频。',
    model: DEFAULT_SEEDANCE_MODEL,
    resolution: '720p',
    ratio: '9:16',
    duration: 6,
    generateAudio: true,
    watermark: false,
    sortOrder: 40,
    promptTemplate:
      '竖屏 {{duration}} 秒知识讲解短视频，用清楚的旁白和简洁画面解释一个观点。主题：{{topic}}。参考 V3 Prompt 摘要：{{v3PromptSummary}}。如果涉及产品，使用 {{brand}} {{productName}} 作为例子，突出 {{sellingPoints}}。画面节奏为问题提出、核心解释、结论提醒三段，字幕简短准确。',
    isActive: true,
  },
  {
    key: 'seeding-recommendation',
    name: '种草短视频',
    type: VideoGenerationTemplateType.SEEDING_RECOMMENDATION,
    description: '适合小红书、抖音风格的体验分享和种草。',
    model: DEFAULT_SEEDANCE_MODEL,
    resolution: '720p',
    ratio: '9:16',
    duration: 6,
    generateAudio: true,
    watermark: false,
    sortOrder: 30,
    promptTemplate:
      '竖屏 {{duration}} 秒种草短视频，第一视角或近景生活化拍摄。主题：{{topic}}。自然带出 {{brand}} {{productName}}，说明它适合 {{targetAudience}}，并把卖点 {{sellingPoints}} 融入真实体验。必须覆盖：{{requiredContent}}。语气像朋友分享，结尾给一个具体使用建议。',
    isActive: true,
  },
  {
    key: 'comparison-review',
    name: '对比评测',
    type: VideoGenerationTemplateType.COMPARISON_REVIEW,
    description: '适合做前后对比、方案对比、选择建议。',
    model: DEFAULT_SEEDANCE_MODEL,
    resolution: '720p',
    ratio: '9:16',
    duration: 6,
    generateAudio: true,
    watermark: false,
    sortOrder: 50,
    promptTemplate:
      '竖屏 {{duration}} 秒对比评测短视频，画面分成“常见选择”和“更适合的选择”两段。主题：{{topic}}。将 {{brand}} {{productName}} 放在第二段作为推荐方案，品类 {{category}}，目标人群 {{targetAudience}}。对比要围绕卖点：{{sellingPoints}}，强调：{{emphasis}}。结论明确但不过度夸张。',
    isActive: true,
  },
]

@Injectable()
export class VideoGenerationService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.ensureDefaultTemplates()
    } catch (error) {
      console.warn('[VideoGeneration] Default templates skipped:', error)
    }
  }

  async findTemplates() {
    await this.ensureDefaultTemplates()

    const templates = await this.prisma.videoGenerationTemplate.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })

    return templates.map((template) => this.toTemplateView(template))
  }

  async createTemplate(payload: CreateVideoGenerationTemplateDto) {
    this.validateModelOptions(payload.model, payload.ratio, payload.resolution)
    this.validateDurationOption(payload.duration, payload.model)
    const name = this.requireText(payload.name, '请填写模板名称')
    const promptTemplate = this.requireLongText(payload.promptTemplate, '请填写提示词模板')

    const template = await this.prisma.videoGenerationTemplate.create({
      data: {
        key: payload.key?.trim() || this.createTemplateKey(name),
        name,
        type: payload.type,
        description: this.toLongText(payload.description),
        model: payload.model.trim(),
        resolution: payload.resolution.trim(),
        ratio: payload.ratio.trim(),
        duration: payload.duration,
        generateAudio: payload.generateAudio ?? true,
        watermark: payload.watermark ?? false,
        promptTemplate,
        isActive: payload.isActive ?? true,
        sortOrder: payload.sortOrder ?? 100,
      },
    })

    return this.toTemplateView(template)
  }

  async updateTemplate(id: number, payload: UpdateVideoGenerationTemplateDto) {
    const current = await this.prisma.videoGenerationTemplate.findUnique({ where: { id } })
    if (!current) throw new NotFoundException('视频模板不存在')

    const model = payload.model?.trim() ?? current.model
    const ratio = payload.ratio?.trim() ?? current.ratio
    const resolution = payload.resolution?.trim() ?? current.resolution
    const duration = payload.duration ?? current.duration
    this.validateModelOptions(model, ratio, resolution)
    this.validateDurationOption(duration, model)

    const template = await this.prisma.videoGenerationTemplate.update({
      where: { id },
      data: {
        ...(payload.name !== undefined ? { name: this.requireText(payload.name, '请填写模板名称') } : {}),
        ...(payload.type !== undefined ? { type: payload.type } : {}),
        ...(payload.description !== undefined ? { description: this.toLongText(payload.description) } : {}),
        ...(payload.model !== undefined ? { model } : {}),
        ...(payload.resolution !== undefined ? { resolution } : {}),
        ...(payload.ratio !== undefined ? { ratio } : {}),
        ...(payload.duration !== undefined ? { duration } : {}),
        ...(payload.generateAudio !== undefined ? { generateAudio: payload.generateAudio } : {}),
        ...(payload.watermark !== undefined ? { watermark: payload.watermark } : {}),
        ...(payload.promptTemplate !== undefined
          ? { promptTemplate: this.requireLongText(payload.promptTemplate, '请填写提示词模板') }
          : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}),
      },
    })

    return this.toTemplateView(template)
  }

  async findAssets(query: Record<string, unknown> = {}) {
    const where: Prisma.VideoGenerationAssetWhereInput = {}
    const productProfileId = this.toOptionalPositiveInt(query.productProfileId)
    const campaignId = this.toOptionalPositiveInt(query.campaignId)
    const taskId = this.toOptionalPositiveInt(query.taskId)
    const kind = this.toOptionalEnumValue(String(query.kind ?? ''), Object.values(VideoGenerationAssetKind))
    const status = this.toOptionalEnumValue(String(query.status ?? ''), Object.values(VideoGenerationAssetStatus))

    if (productProfileId) where.productProfileId = productProfileId
    if (campaignId) where.campaignId = campaignId
    if (taskId) where.taskId = taskId
    if (kind) where.kind = kind
    if (status) where.status = status

    const assets = await this.prisma.videoGenerationAsset.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { id: 'asc' }],
      take: 200,
    })

    return assets.map((asset) => this.toAssetView(asset))
  }

  async planAssetsForProduct(payload: PlanVideoGenerationAssetsDto) {
    const productId = this.requirePositiveInt(payload.productProfileId, '请选择 V3 产品')
    const product = await this.prisma.geoMainProductProfileV3.findUnique({ where: { id: productId } })
    if (!product) throw new NotFoundException('V3 产品不存在')

    const productSnapshot = this.toProductSnapshot(product)
    const plannedAssets = this.createPlannedAssets(product)
    const saved = []

    for (const planned of plannedAssets) {
      const existing = await this.prisma.videoGenerationAsset.findFirst({
        where: {
          productProfileId: product.id,
          planKey: planned.planKey,
        },
      })

      const data = {
        title: planned.title,
        kind: planned.kind,
        role: planned.role,
        priority: planned.priority,
        status: existing?.status === VideoGenerationAssetStatus.READY ? existing.status : VideoGenerationAssetStatus.PLANNED,
        sourceType: existing?.url ? existing.sourceType : VideoGenerationAssetSourceType.PLANNED,
        stage: planned.stage,
        purpose: planned.purpose,
        brief: planned.brief,
        prompt: planned.prompt,
        toolHint: planned.toolHint,
        sourceFields: planned.sourceFields as Prisma.InputJsonValue,
        productSnapshot: productSnapshot as Prisma.InputJsonValue,
        errorMessage: '',
      }

      const asset = existing
        ? await this.prisma.videoGenerationAsset.update({
            where: { id: existing.id },
            data,
          })
        : await this.prisma.videoGenerationAsset.create({
            data: {
              productProfileId: product.id,
              planKey: planned.planKey,
              ...data,
            },
          })
      saved.push(this.toAssetView(asset))
    }

    return saved
  }

  async createAsset(payload: CreateVideoGenerationAssetDto) {
    const product = payload.productProfileId
      ? await this.prisma.geoMainProductProfileV3.findUnique({ where: { id: payload.productProfileId } })
      : null
    if (payload.productProfileId && !product) throw new NotFoundException('V3 产品不存在')

    const asset = await this.prisma.videoGenerationAsset.create({
      data: {
        productProfileId: payload.productProfileId,
        campaignId: payload.campaignId,
        taskId: payload.taskId,
        planKey: this.toShortText(payload.planKey),
        title: this.requireText(payload.title, '请填写素材名称'),
        kind: payload.kind,
        role: this.toShortText(payload.role),
        priority: payload.priority ?? VideoGenerationAssetPriority.RECOMMENDED,
        status: payload.status ?? (payload.url ? VideoGenerationAssetStatus.READY : VideoGenerationAssetStatus.PLANNED),
        sourceType: payload.sourceType ?? (payload.url ? VideoGenerationAssetSourceType.REMOTE : VideoGenerationAssetSourceType.PLANNED),
        stage: this.toShortText(payload.stage),
        purpose: this.toLongText(payload.purpose),
        brief: this.toLongText(payload.brief),
        prompt: this.toLongText(payload.prompt || payload.brief),
        toolHint: this.toShortText(payload.toolHint),
        sourceFields: (payload.sourceFields ?? []) as Prisma.InputJsonValue,
        url: this.toOptionalPublicUrl(payload.url),
        productSnapshot: product ? this.toProductSnapshot(product) as Prisma.InputJsonValue : undefined,
        errorMessage: '',
      },
    })

    return this.toAssetView(asset)
  }

  async updateAsset(id: number, payload: UpdateVideoGenerationAssetDto) {
    const current = await this.prisma.videoGenerationAsset.findUnique({ where: { id } })
    if (!current) throw new NotFoundException('视频素材不存在')

    const asset = await this.prisma.videoGenerationAsset.update({
      where: { id },
      data: {
        ...(payload.title !== undefined ? { title: this.requireText(payload.title, '请填写素材名称') } : {}),
        ...(payload.kind !== undefined ? { kind: payload.kind } : {}),
        ...(payload.role !== undefined ? { role: this.toShortText(payload.role) } : {}),
        ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.sourceType !== undefined ? { sourceType: payload.sourceType } : {}),
        ...(payload.stage !== undefined ? { stage: this.toShortText(payload.stage) } : {}),
        ...(payload.purpose !== undefined ? { purpose: this.toLongText(payload.purpose) } : {}),
        ...(payload.brief !== undefined ? { brief: this.toLongText(payload.brief) } : {}),
        ...(payload.prompt !== undefined ? { prompt: this.toLongText(payload.prompt) } : {}),
        ...(payload.toolHint !== undefined ? { toolHint: this.toShortText(payload.toolHint) } : {}),
        ...(payload.sourceFields !== undefined ? { sourceFields: payload.sourceFields as Prisma.InputJsonValue } : {}),
        ...(payload.url !== undefined ? { url: this.toOptionalPublicUrl(payload.url) } : {}),
      },
    })

    return this.toAssetView(asset)
  }

  async generateImageAsset(id: number, payload: GenerateVideoAssetImageDto) {
    const asset = await this.prisma.videoGenerationAsset.findUnique({ where: { id } })
    if (!asset) throw new NotFoundException('视频素材不存在')
    if (asset.kind !== VideoGenerationAssetKind.IMAGE) throw new BadRequestException('只有图片素材可以调用 GPT image 生成')

    const prompt = this.requireLongText(payload.prompt || asset.prompt || asset.brief, '请填写图片生成说明')
    const model = process.env.GPT_IMAGE_MODEL?.trim() || 'gpt-image-2'
    const size = payload.size?.trim() || '1024x1024'

    await this.prisma.videoGenerationAsset.update({
      where: { id },
      data: {
        status: VideoGenerationAssetStatus.GENERATING,
        sourceType: VideoGenerationAssetSourceType.GENERATED,
        provider: 'fluxnode',
        model,
        prompt,
        errorMessage: '',
      },
    })

    try {
      const image = await this.requestGptImage({ prompt, model, size })
      const file = image.bytes
        ? await this.saveStoredBuffer('assets', image.bytes, image.extension)
        : await this.downloadAndStoreFile(image.url, 'assets', image.extension)

      const updated = await this.prisma.videoGenerationAsset.update({
        where: { id },
        data: {
          status: VideoGenerationAssetStatus.READY,
          sourceType: VideoGenerationAssetSourceType.GENERATED,
          url: file.url,
          localPath: file.relativePath,
          provider: 'fluxnode',
          model,
          metadata: {
            size,
            originalUrl: image.url || '',
          } as Prisma.InputJsonValue,
          errorMessage: '',
        },
      })
      return this.toAssetView(updated)
    } catch (error) {
      const updated = await this.prisma.videoGenerationAsset.update({
        where: { id },
        data: {
          status: VideoGenerationAssetStatus.FAILED,
          errorMessage: this.toErrorMessage(error),
        },
      })
      return this.toAssetView(updated)
    }
  }

  async storeUploadedImage(file?: UploadedVideoGenerationImageFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请上传图片文件')
    }

    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('仅支持 PNG、JPG、WebP 图片')
    }

    if (file.size > 8 * 1024 * 1024) {
      throw new BadRequestException('图片不能超过 8MB')
    }

    const extension = this.extensionFromContentType(file.mimetype) || this.extensionFromUrl(file.originalname, 'png')
    return this.saveStoredBuffer('assets', file.buffer, extension)
  }

  async findStoryboards(query: Record<string, unknown> = {}) {
    const where: Prisma.VideoGenerationStoryboardWhereInput = {}
    const productProfileId = this.toOptionalPositiveInt(query.productProfileId)
    const campaignId = this.toOptionalPositiveInt(query.campaignId)
    if (productProfileId) where.productProfileId = productProfileId
    if (campaignId) where.campaignId = campaignId

    const storyboards = await this.prisma.videoGenerationStoryboard.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    })

    return storyboards.map((storyboard) => this.toStoryboardView(storyboard))
  }

  async generateStoryboard(payload: GenerateVideoStoryboardDto) {
    const campaign = payload.campaignId
      ? await this.prisma.videoGenerationCampaign.findUnique({ where: { id: payload.campaignId } })
      : null
    if (payload.campaignId && !campaign) throw new NotFoundException('视频批次不存在')

    const productId = payload.productProfileId ?? campaign?.productProfileId
    const product = productId
      ? await this.prisma.geoMainProductProfileV3.findUnique({ where: { id: productId } })
      : null
    if (productId && !product) throw new NotFoundException('V3 产品不存在')

    const productSnapshot = product ? this.toProductSnapshot(product) : this.toRecord(campaign?.productSnapshot)
    const topics = this.resolveTopics(payload.topics, campaign ? this.splitTopics(campaign.topicText) : [])
    const title =
      this.toShortText(payload.title) ||
      `${this.textFromRecord(productSnapshot, 'productName', '产品')} 视频分镜 - ${new Date().toLocaleString('zh-CN', { hour12: false })}`
    const scenes = this.createStoryboardScenes(productSnapshot, topics)
    const scriptText = this.renderStoryboardScript(productSnapshot, scenes)

    const storyboard = await this.prisma.videoGenerationStoryboard.create({
      data: {
        productProfileId: product?.id,
        campaignId: campaign?.id,
        sourceType: payload.sourceType ?? campaign?.sourceType ?? (product ? VideoGenerationSourceType.GEO_V3_PRODUCT : VideoGenerationSourceType.MANUAL),
        title,
        topicText: topics.join('\n'),
        scriptText,
        scenes: scenes as unknown as Prisma.InputJsonValue,
        productSnapshot: Object.keys(productSnapshot).length ? productSnapshot as Prisma.InputJsonValue : undefined,
        sourceSnapshot: campaign?.sourceSnapshot as Prisma.InputJsonValue | undefined,
      },
    })

    return this.toStoryboardView(storyboard)
  }

  async findCampaigns(query: Record<string, unknown> = {}) {
    const where: Prisma.VideoGenerationCampaignWhereInput = {}
    const status = this.toOptionalEnumValue(String(query.status ?? ''), Object.values(VideoGenerationCampaignStatus))
    const sourceType = this.toOptionalEnumValue(String(query.sourceType ?? ''), Object.values(VideoGenerationSourceType))
    const templateId = this.toOptionalPositiveInt(query.templateId)
    const productProfileId = this.toOptionalPositiveInt(query.productProfileId)

    if (status) where.status = status
    if (sourceType) where.sourceType = sourceType
    if (templateId) where.templateId = templateId
    if (productProfileId) where.productProfileId = productProfileId

    const campaigns = await this.prisma.videoGenerationCampaign.findMany({
      where,
      include: {
        template: true,
        tasks: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 3,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    })

    return campaigns.map((campaign) => this.toCampaignView(campaign, false))
  }

  async findCampaign(id: number) {
    const campaign = await this.prisma.videoGenerationCampaign.findUnique({
      where: { id },
      include: {
        template: true,
        tasks: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        },
      },
    })

    if (!campaign) throw new NotFoundException('视频批次不存在')
    return this.toCampaignView(campaign, true)
  }

  async createCampaign(payload: CreateVideoGenerationCampaignDto) {
    await this.ensureDefaultTemplates()
    const template = await this.findTemplateRecord(payload.templateId)
    const sourceContext = await this.resolveSourceContext(payload)
    const topics = this.resolveTopics(payload.topics, sourceContext.defaultTopics)
    const campaignName =
      this.toShortText(payload.name) ||
      `${template.name} - ${this.sourceTypeLabel(payload.sourceType)} - ${new Date().toLocaleString('zh-CN', { hour12: false })}`

    const campaign = await this.prisma.videoGenerationCampaign.create({
      data: {
        name: campaignName,
        sourceType: payload.sourceType,
        status: VideoGenerationCampaignStatus.DRAFT,
        templateId: template.id,
        templateName: template.name,
        productProfileId: payload.productProfileId,
        geoRunId: payload.geoRunId,
        geoItemId: payload.geoItemId,
        topicText: topics.join('\n'),
        requestedCount: 0,
        lastError: '',
        ...(sourceContext.productSnapshot
          ? { productSnapshot: sourceContext.productSnapshot as Prisma.InputJsonValue }
          : {}),
        ...(sourceContext.sourceSnapshot
          ? { sourceSnapshot: sourceContext.sourceSnapshot as Prisma.InputJsonValue }
          : {}),
      },
    })

    await this.createCampaignTasks(campaign.id, {
      topics,
      referenceAssets: payload.referenceAssets,
    }, {
      model: payload.model,
      ratio: payload.ratio,
      resolution: payload.resolution,
      duration: payload.duration,
      seed: payload.seed,
      cameraFixed: payload.cameraFixed,
      returnLastFrame: payload.returnLastFrame,
      callbackUrl: payload.callbackUrl,
    })

    return this.findCampaign(campaign.id)
  }

  async createCampaignTasks(
    campaignId: number,
    payload: CreateVideoGenerationCampaignTasksDto = {},
    overrides: Partial<Pick<
      CreateVideoGenerationCampaignDto,
      'model' | 'ratio' | 'resolution' | 'duration' | 'seed' | 'cameraFixed' | 'returnLastFrame' | 'callbackUrl'
    >> = {}
  ) {
    const campaign = await this.prisma.videoGenerationCampaign.findUnique({
      where: { id: campaignId },
      include: {
        template: true,
        tasks: true,
      },
    })
    if (!campaign) throw new NotFoundException('视频批次不存在')
    if (!campaign.template) throw new BadRequestException('当前批次没有可用模板')

    const topics = this.resolveTopics(payload.topics ?? this.splitTopics(campaign.topicText), [])
    const referenceAssets = this.normalizeReferenceAssets(payload.referenceAssets ?? [])
    const template = campaign.template
    const model = overrides.model?.trim() || template.model
    const ratio = overrides.ratio?.trim() || template.ratio
    const resolution = overrides.resolution?.trim() || template.resolution
    const duration = overrides.duration ?? template.duration
    const seed = overrides.seed ?? payload.seed
    const cameraFixed = overrides.cameraFixed ?? payload.cameraFixed
    const returnLastFrame = overrides.returnLastFrame ?? payload.returnLastFrame ?? false
    const callbackUrl = this.toOptionalUrl(overrides.callbackUrl ?? payload.callbackUrl)
    this.validateModelOptions(model, ratio, resolution)
    this.validateDurationOption(duration, model)

    const created = []
    for (const topic of topics) {
      const promptText = this.renderPrompt(template, campaign, topic, duration)
      const content: SeedanceContentItem[] = [
        { type: 'text', text: promptText },
        ...referenceAssets,
      ]
      const body = this.normalizeCreatePayload({
        model,
        content,
        generate_audio: template.generateAudio,
        ratio,
        duration,
        watermark: template.watermark,
        resolution,
        seed,
        camera_fixed: cameraFixed,
        return_last_frame: returnLastFrame,
        callback_url: callbackUrl,
      })

      try {
        const arkResponse = await this.requestArk('/contents/generations/tasks', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        const providerTaskId = this.extractProviderTaskId(arkResponse)
        if (!providerTaskId) throw new BadRequestException('火山方舟未返回任务 ID')

        const task = await this.prisma.videoGenerationTask.create({
          data: {
            campaignId: campaign.id,
            providerTaskId,
            status: this.extractTaskStatus(arkResponse, VideoGenerationTaskStatus.CREATED),
            model: body.model,
            resolution: body.resolution,
            ratio: body.ratio,
            duration: body.duration,
            generateAudio: body.generate_audio,
            watermark: body.watermark,
            cameraFixed: body.camera_fixed ?? null,
            returnLastFrame: Boolean(body.return_last_frame),
            callbackUrl: body.callback_url ?? '',
            seed: body.seed ?? (this.extractNumber(arkResponse, ['seed']) || null),
            promptText,
            content: body.content as Prisma.InputJsonValue,
            referenceAssets: referenceAssets as Prisma.InputJsonValue,
            errorMessage: '',
            ...(campaign.productSnapshot ? { productSnapshot: campaign.productSnapshot as Prisma.InputJsonValue } : {}),
            ...(campaign.sourceSnapshot ? { sourceSnapshot: campaign.sourceSnapshot as Prisma.InputJsonValue } : {}),
            ...(this.extractVideoUrl(arkResponse) ? { videoUrl: this.extractVideoUrl(arkResponse) } : {}),
            ...(this.extractVideoUrl(arkResponse) ? { videoUrlExpiresAt: this.resolveVideoUrlExpiresAt(arkResponse) } : {}),
            ...(this.extractLastFrameUrl(arkResponse) ? { lastFrameUrl: this.extractLastFrameUrl(arkResponse) } : {}),
            ...(this.extractUsage(arkResponse) ? { usage: this.extractUsage(arkResponse) as Prisma.InputJsonValue } : {}),
            ...(this.extractExecutionExpiresAfter(arkResponse) ? { executionExpiresAfter: this.extractExecutionExpiresAfter(arkResponse) } : {}),
            ...(this.toInputJson(arkResponse) ? { arkResponse: arkResponse as Prisma.InputJsonValue } : {}),
          },
        })
        created.push(this.toTaskView(task))
      } catch (error) {
        const task = await this.createFailedLocalTask(campaign, body, promptText, this.toErrorMessage(error), referenceAssets)
        created.push(this.toTaskView(task))
      }
    }

    await this.updateCampaignStats(campaign.id)
    return {
      campaign: await this.findCampaign(campaign.id),
      tasks: created,
    }
  }

  async createTask(payload: CreateVideoGenerationTaskDto) {
    const body = this.normalizeCreatePayload(payload)
    const arkResponse = await this.requestArk('/contents/generations/tasks', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const providerTaskId = this.extractProviderTaskId(arkResponse)
    if (!providerTaskId) throw new BadRequestException('火山方舟未返回任务 ID')

    const task = await this.prisma.videoGenerationTask.upsert({
      where: { providerTaskId },
      create: {
        providerTaskId,
        status: this.extractTaskStatus(arkResponse, VideoGenerationTaskStatus.CREATED),
        model: body.model,
        resolution: body.resolution,
        ratio: body.ratio,
        duration: body.duration,
        generateAudio: body.generate_audio,
        watermark: body.watermark,
        cameraFixed: body.camera_fixed ?? null,
        returnLastFrame: Boolean(body.return_last_frame),
        callbackUrl: body.callback_url ?? '',
        seed: body.seed ?? (this.extractNumber(arkResponse, ['seed']) || null),
        promptText: this.extractPromptText(body.content),
        content: body.content as Prisma.InputJsonValue,
        referenceAssets: body.content.filter((item) => item.type !== 'text') as Prisma.InputJsonValue,
        videoUrl: this.extractVideoUrl(arkResponse),
        videoUrlExpiresAt: this.extractVideoUrl(arkResponse) ? this.resolveVideoUrlExpiresAt(arkResponse) : null,
        lastFrameUrl: this.extractLastFrameUrl(arkResponse),
        usage: this.extractUsage(arkResponse) as Prisma.InputJsonValue,
        executionExpiresAfter: this.extractExecutionExpiresAfter(arkResponse) || null,
        errorMessage: '',
        arkResponse: arkResponse as Prisma.InputJsonValue,
      },
      update: {
        status: this.extractTaskStatus(arkResponse, VideoGenerationTaskStatus.CREATED),
        videoUrl: this.extractVideoUrl(arkResponse),
        videoUrlExpiresAt: this.extractVideoUrl(arkResponse) ? this.resolveVideoUrlExpiresAt(arkResponse) : undefined,
        lastFrameUrl: this.extractLastFrameUrl(arkResponse),
        usage: this.extractUsage(arkResponse) as Prisma.InputJsonValue,
        executionExpiresAfter: this.extractExecutionExpiresAfter(arkResponse) || undefined,
        arkResponse: arkResponse as Prisma.InputJsonValue,
      },
    })

    return {
      ...(arkResponse && typeof arkResponse === 'object' ? (arkResponse as Record<string, unknown>) : {}),
      localTask: this.toTaskView(task),
    }
  }

  async findTask(id: string) {
    const task = await this.findLocalTaskByAnyId(id)
    if (task) {
      return this.toTaskView(task)
    }

    const taskId = this.requireText(id, '任务 ID 不能为空')
    return this.requestArk(`/contents/generations/tasks/${encodeURIComponent(taskId)}`)
  }

  async refreshTask(id: string) {
    const task = await this.findLocalTaskByAnyId(id)
    if (!task) {
      return this.importTask({ taskId: id })
    }
    if (task.providerTaskId.startsWith('local-failed-')) {
      return this.toTaskView(task)
    }

    const arkResponse = await this.requestArk(`/contents/generations/tasks/${encodeURIComponent(task.providerTaskId)}`)
    const updated = await this.updateTaskFromArkResponse(task.id, arkResponse)
    if (updated.campaignId) await this.updateCampaignStats(updated.campaignId)
    return this.toTaskView(updated)
  }

  async importTask(payload: ImportVideoGenerationTaskDto) {
    const taskId = this.requireText(payload.taskId, '任务 ID 不能为空')
    const arkResponse = await this.requestArk(`/contents/generations/tasks/${encodeURIComponent(taskId)}`)
    const providerTaskId = this.extractProviderTaskId(arkResponse) || taskId
    const campaign = payload.campaignId
      ? await this.prisma.videoGenerationCampaign.findUnique({
          where: { id: payload.campaignId },
          include: { template: true },
        })
      : null

    if (payload.campaignId && !campaign) throw new NotFoundException('视频批次不存在')

    const task = await this.prisma.videoGenerationTask.upsert({
      where: { providerTaskId },
      create: {
        campaignId: campaign?.id,
        providerTaskId,
        status: this.extractTaskStatus(arkResponse, VideoGenerationTaskStatus.RUNNING),
        model: this.extractString(arkResponse, ['model']) || campaign?.template?.model || DEFAULT_SEEDANCE_MODEL,
        resolution: this.extractString(arkResponse, ['resolution']) || campaign?.template?.resolution || '720p',
        ratio: this.extractString(arkResponse, ['ratio']) || campaign?.template?.ratio || '9:16',
        duration: this.extractNumber(arkResponse, ['duration']) || campaign?.template?.duration || 4,
        generateAudio: campaign?.template?.generateAudio ?? true,
        watermark: campaign?.template?.watermark ?? false,
        seed: this.extractNumber(arkResponse, ['seed']) || null,
        promptText: '',
        content: [] as unknown as Prisma.InputJsonValue,
        videoUrl: this.extractVideoUrl(arkResponse),
        videoUrlExpiresAt: this.extractVideoUrl(arkResponse) ? this.resolveVideoUrlExpiresAt(arkResponse) : null,
        lastFrameUrl: this.extractLastFrameUrl(arkResponse),
        usage: this.extractUsage(arkResponse) as Prisma.InputJsonValue,
        executionExpiresAfter: this.extractExecutionExpiresAfter(arkResponse) || null,
        errorCode: this.extractErrorCode(arkResponse),
        errorMessage: this.extractArkError(arkResponse, ''),
        arkResponse: arkResponse as Prisma.InputJsonValue,
        sourceSnapshot: { imported: true, importedAt: new Date().toISOString() } as Prisma.InputJsonValue,
        ...(this.extractTaskStatus(arkResponse, VideoGenerationTaskStatus.RUNNING) === VideoGenerationTaskStatus.SUCCEEDED
          ? { completedAt: new Date() }
          : {}),
      },
      update: {
        campaignId: campaign?.id,
        status: this.extractTaskStatus(arkResponse, VideoGenerationTaskStatus.RUNNING),
        videoUrl: this.extractVideoUrl(arkResponse),
        videoUrlExpiresAt: this.extractVideoUrl(arkResponse) ? this.resolveVideoUrlExpiresAt(arkResponse) : undefined,
        lastFrameUrl: this.extractLastFrameUrl(arkResponse),
        usage: this.extractUsage(arkResponse) as Prisma.InputJsonValue,
        seed: this.extractNumber(arkResponse, ['seed']) || undefined,
        executionExpiresAfter: this.extractExecutionExpiresAfter(arkResponse) || undefined,
        errorCode: this.extractErrorCode(arkResponse),
        errorMessage: this.extractArkError(arkResponse, ''),
        arkResponse: arkResponse as Prisma.InputJsonValue,
      },
    })

    if (task.campaignId) await this.updateCampaignStats(task.campaignId)
    return this.toTaskView(task)
  }

  async refreshRunningTasks() {
    const tasks = await this.prisma.videoGenerationTask.findMany({
      where: {
        status: {
          in: [VideoGenerationTaskStatus.CREATED, VideoGenerationTaskStatus.QUEUED, VideoGenerationTaskStatus.RUNNING],
        },
        providerTaskId: {
          not: {
            startsWith: 'local-failed-',
          },
        },
      },
      orderBy: [{ updatedAt: 'asc' }],
      take: 30,
    })

    const refreshed = []
    for (const task of tasks) {
      refreshed.push(await this.refreshTask(task.providerTaskId))
    }

    return refreshed
  }

  async findRecentTasks(query: Record<string, unknown> = {}) {
    const take = Math.min(Math.max(this.toOptionalPositiveInt(query.limit) || 10, 1), 30)
    const tasks = await this.prisma.videoGenerationTask.findMany({
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take,
    })

    return tasks.map((task) => this.toTaskView(task))
  }

  async handleTaskCallback(payload: unknown) {
    const providerTaskId = this.extractProviderTaskId(payload)
    if (!providerTaskId) throw new BadRequestException('回调缺少任务 ID')

    const existing = await this.prisma.videoGenerationTask.findUnique({ where: { providerTaskId } })
    if (existing) {
      const updated = await this.updateTaskFromArkResponse(existing.id, payload)
      if (updated.campaignId) await this.updateCampaignStats(updated.campaignId)
      return this.toTaskView(updated)
    }

    const status = this.extractTaskStatus(payload, VideoGenerationTaskStatus.RUNNING)
    const task = await this.prisma.videoGenerationTask.create({
      data: {
        providerTaskId,
        status,
        model: this.extractString(payload, ['model']) || DEFAULT_SEEDANCE_MODEL,
        resolution: this.extractString(payload, ['resolution']) || '720p',
        ratio: this.extractString(payload, ['ratio']) || 'adaptive',
        duration: this.extractNumber(payload, ['duration']) || 4,
        generateAudio: true,
        watermark: false,
        promptText: '',
        content: [] as unknown as Prisma.InputJsonValue,
        videoUrl: this.extractVideoUrl(payload),
        videoUrlExpiresAt: this.extractVideoUrl(payload) ? this.resolveVideoUrlExpiresAt(payload) : null,
        lastFrameUrl: this.extractLastFrameUrl(payload),
        usage: this.extractUsage(payload) as Prisma.InputJsonValue,
        seed: this.extractNumber(payload, ['seed']) || null,
        serviceTier: this.extractString(payload, ['service_tier']),
        executionExpiresAfter: this.extractExecutionExpiresAfter(payload) || null,
        errorCode: this.extractErrorCode(payload),
        errorMessage: this.extractArkError(payload, ''),
        arkResponse: payload as Prisma.InputJsonValue,
        sourceSnapshot: { callbackOnly: true, callbackAt: new Date().toISOString() } as Prisma.InputJsonValue,
        ...(this.isTerminalTaskStatus(status) ? { completedAt: new Date() } : {}),
      },
    })

    return this.toTaskView(task)
  }

  resolveStoredFile(category: string, fileName: string) {
    if (!VIDEO_FILE_CATEGORIES.includes(category as (typeof VIDEO_FILE_CATEGORIES)[number])) {
      throw new NotFoundException('文件分类不存在')
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
      throw new NotFoundException('文件不存在')
    }

    const filePath = resolve(VIDEO_STORAGE_ROOT, category, fileName)
    const categoryRoot = resolve(VIDEO_STORAGE_ROOT, category)
    if (!filePath.startsWith(categoryRoot) || !existsSync(filePath)) {
      throw new NotFoundException('文件不存在')
    }

    return {
      path: filePath,
      contentType: this.resolveContentType(fileName),
    }
  }

  private async ensureDefaultTemplates() {
    const keys = DEFAULT_VIDEO_TEMPLATES.map((template) => template.key)
    const existing = await this.prisma.videoGenerationTemplate.findMany({
      where: { key: { in: keys } },
      select: { key: true },
    })
    const existingKeys = new Set(existing.map((template) => template.key))
    const missing = DEFAULT_VIDEO_TEMPLATES.filter((template) => !existingKeys.has(template.key))

    if (missing.length > 0) {
      await this.prisma.videoGenerationTemplate.createMany({
        data: missing.map((template) => ({
          ...template,
        })),
      })
    }
  }

  private async findTemplateRecord(id: number) {
    const template = await this.prisma.videoGenerationTemplate.findUnique({ where: { id } })
    if (!template) throw new NotFoundException('视频模板不存在')
    if (!template.isActive) throw new BadRequestException('当前视频模板已停用')
    return template
  }

  private async resolveSourceContext(payload: CreateVideoGenerationCampaignDto): Promise<SourceContext> {
    if (payload.sourceType === VideoGenerationSourceType.MANUAL) {
      return {
        defaultTopics: [],
        sourceSnapshot: {
          type: VideoGenerationSourceType.MANUAL,
        },
      }
    }

    if (payload.sourceType === VideoGenerationSourceType.GEO_V3_PRODUCT) {
      const productId = this.requirePositiveInt(payload.productProfileId, '请选择 V3 产品')
      const product = await this.prisma.geoMainProductProfileV3.findUnique({ where: { id: productId } })
      if (!product) throw new NotFoundException('V3 产品不存在')
      const productSnapshot = this.toProductSnapshot(product)
      return {
        productSnapshot,
        sourceSnapshot: {
          type: VideoGenerationSourceType.GEO_V3_PRODUCT,
          productProfileId: product.id,
          productName: product.productName,
          brand: product.brand,
        },
        defaultTopics: [`${product.productName} 核心卖点口播`, `${product.productName} 使用场景展示`],
      }
    }

    if (payload.sourceType === VideoGenerationSourceType.GEO_V3_RUN) {
      const runId = this.requirePositiveInt(payload.geoRunId, '请选择 V3 生成记录')
      const run = await this.prisma.geoPromptV3GenerationRun.findUnique({
        where: { id: runId },
        include: {
          items: {
            orderBy: [{ itemIndex: 'asc' }],
            take: 5,
          },
          productProfile: true,
        },
      })
      if (!run) throw new NotFoundException('V3 生成记录不存在')

      const promptSummary = this.summarizeText(run.items.find((item) => item.promptText.trim())?.promptText || run.topic)
      const productSnapshot = this.resolveRunProductSnapshot(run.productSnapshot, run.productProfile)
      return {
        productSnapshot,
        sourceSnapshot: {
          type: VideoGenerationSourceType.GEO_V3_RUN,
          geoRunId: run.id,
          topic: run.topic,
          versionName: run.versionName,
          variableSetName: run.variableSetName,
          promptSummary,
        },
        defaultTopics: [run.topic || `${run.productProfileName || 'V3 生成记录'} 短视频改编`],
      }
    }

    if (payload.sourceType === VideoGenerationSourceType.GEO_V3_ITEM) {
      const itemId = this.requirePositiveInt(payload.geoItemId, '请选择 V3 Prompt 条目')
      const item = await this.prisma.geoPromptV3GenerationItem.findUnique({
        where: { id: itemId },
        include: {
          run: {
            include: {
              productProfile: true,
            },
          },
        },
      })
      if (!item) throw new NotFoundException('V3 Prompt 条目不存在')

      const promptSummary = this.summarizeText(item.promptText)
      const productSnapshot = this.resolveRunProductSnapshot(item.run.productSnapshot, item.run.productProfile)
      return {
        productSnapshot,
        sourceSnapshot: {
          type: VideoGenerationSourceType.GEO_V3_ITEM,
          geoRunId: item.runId,
          geoItemId: item.id,
          itemIndex: item.itemIndex,
          fileName: item.fileName,
          topic: item.run.topic,
          promptSummary,
        },
        defaultTopics: [item.run.topic || item.fileName || `V3 Prompt ${item.itemIndex} 短视频改编`],
      }
    }

    throw new BadRequestException('不支持的视频来源')
  }

  private renderPrompt(
    template: VideoTemplateRecord,
    campaign: Prisma.VideoGenerationCampaignGetPayload<Record<string, never>>,
    topic: string,
    duration: number
  ) {
    const product = this.toRecord(campaign.productSnapshot)
    const source = this.toRecord(campaign.sourceSnapshot)
    const variables: Record<string, string | number> = {
      topic,
      duration,
      brand: this.textFromRecord(product, 'brand', '品牌'),
      productName: this.textFromRecord(product, 'productName', '产品'),
      category: this.textFromRecord(product, 'category', '产品品类'),
      targetAudience: this.textFromRecord(product, 'targetAudience', '目标人群'),
      coreParameters: this.textFromRecord(product, 'coreParameters', '核心参数'),
      requiredContent: this.joinRecordArray(product, 'requiredContent', '产品必写内容'),
      randomContent: this.joinRecordArray(product, 'randomContentPool', '补充内容'),
      sellingPoints: this.joinRecordArray(product, 'sellingPointsPool', '主打卖点'),
      emphasis: this.joinRecordArray(product, 'emphasisPool', '强调点'),
      v3PromptSummary: this.textFromRecord(source, 'promptSummary', '暂无 V3 Prompt 摘要'),
    }

    return template.promptTemplate.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
      const value = variables[key]
      return value === undefined || value === null || value === '' ? '' : String(value)
    })
  }

  private normalizeCreatePayload(payload: CreateVideoGenerationTaskDto) {
    const model = payload.model.trim()
    const ratio = payload.ratio.trim()
    const resolution = payload.resolution?.trim() || '720p'
    this.validateModelOptions(model, ratio, resolution)
    this.validateDurationOption(payload.duration, model)

    const content = payload.content.map((item) => this.normalizeContentItem(item))
    if (!content.some((item) => item.type === 'text' && item.text.trim())) {
      throw new BadRequestException('视频提示词不能为空')
    }

    const imageCount = content.filter((item) => item.type === 'image_url').length
    const videoCount = content.filter((item) => item.type === 'video_url').length
    const audioCount = content.filter((item) => item.type === 'audio_url').length
    if (imageCount > SEEDANCE_MAX_IMAGE_REFERENCES) {
      throw new BadRequestException(`图片参考最多支持 ${SEEDANCE_MAX_IMAGE_REFERENCES} 张`)
    }
    if (videoCount > SEEDANCE_MAX_VIDEO_REFERENCES) {
      throw new BadRequestException(`视频参考最多支持 ${SEEDANCE_MAX_VIDEO_REFERENCES} 段`)
    }
    if (audioCount > SEEDANCE_MAX_AUDIO_REFERENCES) {
      throw new BadRequestException(`音频参考最多支持 ${SEEDANCE_MAX_AUDIO_REFERENCES} 段`)
    }

    return {
      model,
      content,
      generate_audio: payload.generate_audio,
      ratio,
      duration: payload.duration,
      watermark: payload.watermark,
      resolution,
      ...(payload.seed !== undefined ? { seed: payload.seed } : {}),
      ...(payload.camera_fixed !== undefined ? { camera_fixed: payload.camera_fixed } : {}),
      ...(payload.return_last_frame !== undefined ? { return_last_frame: payload.return_last_frame } : {}),
      ...(payload.callback_url ? { callback_url: this.toOptionalUrl(payload.callback_url) } : {}),
    }
  }

  private normalizeContentItem(value: unknown): SeedanceContentItem {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('content 参数格式不正确')
    }

    const record = value as Record<string, unknown>
    const type = String(record.type ?? '').trim()

    if (type === 'text') {
      return {
        type,
        text: String(record.text ?? '').trim(),
      }
    }

    if (type !== 'image_url' && type !== 'video_url' && type !== 'audio_url') {
      throw new BadRequestException('content 包含不支持的素材类型')
    }

    const media = record[type]
    if (!media || typeof media !== 'object') {
      throw new BadRequestException('素材 URL 参数格式不正确')
    }

    const url = String((media as Record<string, unknown>).url ?? '').trim()
    if (!url || !/^https?:\/\//i.test(url)) {
      throw new BadRequestException('素材 URL 必须是 http 或 https 地址')
    }

    const role = String(record.role ?? '').trim()

    return {
      type,
      [type]: { url },
      ...(role ? { role } : {}),
    } as SeedanceContentItem
  }

  private normalizeReferenceAssets(value: unknown[]): SeedanceContentItem[] {
    return value
      .map((item) => this.normalizeContentItem(item))
      .filter((item) => item.type !== 'text')
  }

  private async createFailedLocalTask(
    campaign: Prisma.VideoGenerationCampaignGetPayload<Record<string, never>>,
    body: ReturnType<VideoGenerationService['normalizeCreatePayload']>,
    promptText: string,
    errorMessage: string,
    referenceAssets: SeedanceContentItem[]
  ) {
    return this.prisma.videoGenerationTask.create({
      data: {
        campaignId: campaign.id,
        providerTaskId: `local-failed-${campaign.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        status: VideoGenerationTaskStatus.FAILED,
        model: body.model,
        resolution: body.resolution,
        ratio: body.ratio,
        duration: body.duration,
        generateAudio: body.generate_audio,
        watermark: body.watermark,
        cameraFixed: body.camera_fixed ?? null,
        returnLastFrame: Boolean(body.return_last_frame),
        callbackUrl: body.callback_url ?? '',
        seed: body.seed ?? null,
        promptText,
        content: body.content as Prisma.InputJsonValue,
        referenceAssets: referenceAssets as Prisma.InputJsonValue,
        errorMessage,
        ...(campaign.productSnapshot ? { productSnapshot: campaign.productSnapshot as Prisma.InputJsonValue } : {}),
        ...(campaign.sourceSnapshot ? { sourceSnapshot: campaign.sourceSnapshot as Prisma.InputJsonValue } : {}),
      },
    })
  }

  private async updateTaskFromArkResponse(taskId: number, arkResponse: unknown) {
    const status = this.extractTaskStatus(arkResponse, VideoGenerationTaskStatus.RUNNING)
    const task = await this.prisma.videoGenerationTask.update({
      where: { id: taskId },
      data: {
        status,
        videoUrl: this.extractVideoUrl(arkResponse),
        videoUrlExpiresAt: this.extractVideoUrl(arkResponse) ? this.resolveVideoUrlExpiresAt(arkResponse) : undefined,
        lastFrameUrl: this.extractLastFrameUrl(arkResponse),
        usage: this.extractUsage(arkResponse) as Prisma.InputJsonValue,
        seed: this.extractNumber(arkResponse, ['seed']) || undefined,
        framesPerSecond: this.extractNumber(arkResponse, ['framespersecond']) || this.extractNumber(arkResponse, ['frames_per_second']) || undefined,
        serviceTier: this.extractString(arkResponse, ['service_tier']),
        executionExpiresAfter: this.extractExecutionExpiresAfter(arkResponse) || undefined,
        errorCode: this.extractErrorCode(arkResponse),
        errorMessage: this.extractArkError(arkResponse, ''),
        arkResponse: arkResponse as Prisma.InputJsonValue,
        ...(this.isTerminalTaskStatus(status)
          ? { completedAt: new Date() }
          : {}),
      },
    })

    return task
  }

  private async updateCampaignStats(campaignId: number) {
    const tasks = await this.prisma.videoGenerationTask.findMany({
      where: { campaignId },
      select: {
        status: true,
        errorMessage: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: 'desc' }],
    })

    const requestedCount = tasks.length
    const successCount = tasks.filter((task) => task.status === VideoGenerationTaskStatus.SUCCEEDED).length
    const failedCount = tasks.filter((task) => this.isFailedTaskStatus(task.status)).length
    const runningCount = tasks.filter((task) => task.status === VideoGenerationTaskStatus.RUNNING).length
    const queuedCount = tasks.filter((task) => this.isQueuedTaskStatus(task.status)).length
    const isTerminal = requestedCount > 0 && tasks.every((task) => this.isTerminalTaskStatus(task.status))
    const lastError = tasks.find((task) => this.isFailedTaskStatus(task.status))?.errorMessage ?? ''
    const status =
      requestedCount === 0
        ? VideoGenerationCampaignStatus.DRAFT
        : !isTerminal
          ? VideoGenerationCampaignStatus.RUNNING
          : failedCount === 0
            ? VideoGenerationCampaignStatus.COMPLETED
            : successCount > 0
              ? VideoGenerationCampaignStatus.PARTIAL_FAILED
              : VideoGenerationCampaignStatus.FAILED

    await this.prisma.videoGenerationCampaign.update({
      where: { id: campaignId },
      data: {
        requestedCount,
        successCount,
        failedCount,
        runningCount,
        queuedCount,
        status,
        lastError,
        completedAt: isTerminal ? new Date() : null,
      },
    })
  }

  private async findLocalTaskByAnyId(id: string) {
    const taskId = this.requireText(id, '任务 ID 不能为空')
    const numericId = Number(taskId)
    if (Number.isInteger(numericId) && numericId > 0) {
      const task = await this.prisma.videoGenerationTask.findUnique({ where: { id: numericId } })
      if (task) return task
    }

    return this.prisma.videoGenerationTask.findUnique({ where: { providerTaskId: taskId } })
  }

  private isQueuedTaskStatus(status: VideoGenerationTaskStatus) {
    return status === VideoGenerationTaskStatus.CREATED || status === VideoGenerationTaskStatus.QUEUED
  }

  private isFailedTaskStatus(status: VideoGenerationTaskStatus) {
    return (
      status === VideoGenerationTaskStatus.FAILED ||
      status === VideoGenerationTaskStatus.CANCELLED ||
      status === VideoGenerationTaskStatus.EXPIRED
    )
  }

  private isTerminalTaskStatus(status: VideoGenerationTaskStatus) {
    return status === VideoGenerationTaskStatus.SUCCEEDED || this.isFailedTaskStatus(status)
  }

  private getArkApiKey() {
    const apiKey =
      process.env.ARK_VIDEO_API_KEY?.trim() ||
      process.env.ARK_AGENT_PLAN_API_KEY?.trim()
    if (!apiKey) {
      throw new BadRequestException('后端未配置 ARK_VIDEO_API_KEY 或 ARK_AGENT_PLAN_API_KEY')
    }

    return apiKey
  }

  private getArkVideoApiBaseUrl() {
    return DEFAULT_ARK_VIDEO_API_BASE_URL
  }

  private async requestArk(path: string, init: RequestInit = {}) {
    const response = await fetch(`${this.getArkVideoApiBaseUrl()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getArkApiKey()}`,
        ...init.headers,
      },
    })

    const responseText = await response.text()
    const payload = responseText ? this.parseJson(responseText) : null

    if (!response.ok) {
      throw new BadRequestException(this.extractArkError(payload, 'Seedance 请求失败'))
    }

    return payload
  }

  private getGptImageApiKey() {
    const apiKey = process.env.GPT_IMAGE_API_KEY?.trim()
    if (!apiKey) {
      throw new BadRequestException('后端未配置 GPT_IMAGE_API_KEY')
    }
    return apiKey
  }

  private getGptImageBaseUrl() {
    return (process.env.GPT_IMAGE_API_BASE_URL?.trim() || 'https://api.openai.com').replace(/\/+$/, '')
  }

  private async requestGptImage(payload: { prompt: string; model: string; size: string }) {
    const response = await fetch(`${this.getGptImageBaseUrl()}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getGptImageApiKey()}`,
      },
      body: JSON.stringify({
        model: payload.model,
        prompt: payload.prompt,
        size: payload.size,
        n: 1,
      }),
    })

    const responseText = await response.text()
    const result = responseText ? this.parseJson(responseText) : null
    if (!response.ok) {
      throw new BadRequestException(this.extractArkError(result, 'GPT image 生成失败'))
    }

    const first = Array.isArray(this.extractValue(result, ['data']))
      ? (this.extractValue(result, ['data']) as unknown[])[0]
      : null
    const imageUrl = first && typeof first === 'object' ? this.extractString(first, ['url']) : ''
    const b64Json = first && typeof first === 'object' ? this.extractString(first, ['b64_json']) : ''

    if (b64Json) {
      return {
        bytes: Buffer.from(b64Json, 'base64'),
        extension: 'png',
        url: '',
      }
    }
    if (imageUrl) {
      return {
        bytes: null,
        extension: this.extensionFromUrl(imageUrl, 'png'),
        url: imageUrl,
      }
    }

    throw new BadRequestException('GPT image 未返回图片内容')
  }

  private async downloadAndStoreFile(
    url: string,
    category: (typeof VIDEO_FILE_CATEGORIES)[number],
    fallbackExtension: string
  ) {
    const safeUrl = this.toOptionalPublicUrl(url)
    if (!safeUrl) throw new BadRequestException('文件 URL 为空')

    const response = await fetch(safeUrl)
    if (!response.ok) {
      throw new BadRequestException(`文件下载失败（HTTP ${response.status}）`)
    }

    const contentType = response.headers.get('content-type') || ''
    const extension = this.extensionFromContentType(contentType) || this.extensionFromUrl(safeUrl, fallbackExtension)
    const bytes = Buffer.from(await response.arrayBuffer())
    return this.saveStoredBuffer(category, bytes, extension)
  }

  private async saveStoredBuffer(
    category: (typeof VIDEO_FILE_CATEGORIES)[number],
    bytes: Buffer,
    extension: string
  ) {
    const cleanExtension = extension.replace(/^\./, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin'
    const dir = resolve(VIDEO_STORAGE_ROOT, category)
    await mkdir(dir, { recursive: true })

    const fileName = `${Date.now()}-${randomUUID()}.${cleanExtension}`
    const absolutePath = join(dir, fileName)
    await writeFile(absolutePath, bytes)

    return {
      fileName,
      relativePath: `${category}/${fileName}`,
      url: `${this.getPublicApiBaseUrl()}/video-generation/files/${category}/${fileName}`,
    }
  }

  private getPublicApiBaseUrl() {
    const configured = process.env.PUBLIC_API_BASE_URL?.trim()
    if (configured) return configured.replace(/\/+$/, '')
    const port = Number(process.env.PORT ?? 19988)
    return `http://localhost:${port}/api`
  }

  private resolveContentType(fileName: string) {
    const extension = fileName.split('.').pop()?.toLowerCase()
    const map: Record<string, string> = {
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      webm: 'video/webm',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
    }
    return map[extension || ''] || 'application/octet-stream'
  }

  private extensionFromContentType(contentType: string) {
    if (contentType.includes('video/mp4')) return 'mp4'
    if (contentType.includes('video/quicktime')) return 'mov'
    if (contentType.includes('video/webm')) return 'webm'
    if (contentType.includes('image/png')) return 'png'
    if (contentType.includes('image/jpeg')) return 'jpg'
    if (contentType.includes('image/webp')) return 'webp'
    if (contentType.includes('audio/mpeg')) return 'mp3'
    if (contentType.includes('audio/wav')) return 'wav'
    return ''
  }

  private extensionFromUrl(url: string, fallback: string) {
    try {
      const pathname = new URL(url).pathname
      const extension = pathname.split('.').pop()?.toLowerCase() || ''
      if (/^[a-z0-9]{2,5}$/.test(extension)) return extension
    } catch {
      return fallback
    }
    return fallback
  }

  private parseJson(value: string) {
    try {
      return JSON.parse(value) as unknown
    } catch {
      throw new InternalServerErrorException('火山方舟返回了无法解析的 JSON')
    }
  }

  private extractArkError(payload: unknown, fallback = 'Seedance 请求失败') {
    if (!payload || typeof payload !== 'object') return fallback

    const message = Reflect.get(payload, 'message')
    if (typeof message === 'string') return this.normalizeArkErrorMessage(message)

    const error = Reflect.get(payload, 'error')
    if (typeof error === 'string') return this.normalizeArkErrorMessage(error)

    if (error && typeof error === 'object') {
      const errorMessage = Reflect.get(error, 'message')
      if (typeof errorMessage === 'string') return this.normalizeArkErrorMessage(errorMessage)

      const errorCode = Reflect.get(error, 'code')
      if (typeof errorCode === 'string') return this.normalizeArkErrorMessage(errorCode)
    }

    return fallback
  }

  private normalizeArkErrorMessage(message: string) {
    const cleanMessage = message.trim()
    const requestId = cleanMessage.match(/Request id:\s*([a-zA-Z0-9_-]+)/i)?.[1]
    if (/input image may contain real person/i.test(cleanMessage)) {
      return [
        '视频模型拒绝了当前图片：图片可能包含真实人物。',
        '请改用产品图、场景图、虚拟人物图，或换成不包含真人脸/真实人物的首帧图。',
        requestId ? `Request id: ${requestId}` : '',
      ].filter(Boolean).join(' ')
    }

    return cleanMessage
  }

  private extractProviderTaskId(payload: unknown) {
    return (
      this.extractString(payload, ['id']) ||
      this.extractString(payload, ['task_id']) ||
      this.extractString(payload, ['taskId']) ||
      this.extractString(payload, ['data', 'id']) ||
      this.extractString(payload, ['data', 'task_id']) ||
      this.extractString(payload, ['data', 'taskId'])
    )
  }

  private extractTaskStatus(payload: unknown, fallback: VideoGenerationTaskStatus) {
    const rawStatus =
      this.extractString(payload, ['status']) ||
      this.extractString(payload, ['data', 'status']) ||
      this.extractString(payload, ['task_status']) ||
      ''
    const status = rawStatus.toLowerCase()

    if (['succeeded', 'success', 'completed', 'complete'].includes(status)) return VideoGenerationTaskStatus.SUCCEEDED
    if (['failed', 'fail', 'error'].includes(status)) return VideoGenerationTaskStatus.FAILED
    if (['cancelled', 'canceled'].includes(status)) return VideoGenerationTaskStatus.CANCELLED
    if (['expired', 'expire'].includes(status)) return VideoGenerationTaskStatus.EXPIRED
    if (['queued', 'pending', 'waiting'].includes(status)) return VideoGenerationTaskStatus.QUEUED
    if (['created'].includes(status)) return VideoGenerationTaskStatus.CREATED
    if (['running', 'processing', 'in_progress'].includes(status)) return VideoGenerationTaskStatus.RUNNING

    return fallback
  }

  private extractVideoUrl(payload: unknown): string {
    const direct =
      this.extractString(payload, ['video_url']) ||
      this.extractString(payload, ['videoUrl']) ||
      this.extractString(payload, ['url']) ||
      this.extractString(payload, ['data', 'video_url']) ||
      this.extractString(payload, ['data', 'videoUrl']) ||
      this.extractString(payload, ['content', 'video_url', 'url']) ||
      this.extractString(payload, ['data', 'content', 'video_url', 'url'])
    if (direct) return direct

    return this.deepFindVideoUrl(payload)
  }

  private extractLastFrameUrl(payload: unknown): string {
    return (
      this.extractString(payload, ['last_frame_url']) ||
      this.extractString(payload, ['lastFrameUrl']) ||
      this.extractString(payload, ['data', 'last_frame_url']) ||
      this.extractString(payload, ['data', 'lastFrameUrl']) ||
      this.extractString(payload, ['content', 'last_frame_url']) ||
      this.extractString(payload, ['content', 'lastFrameUrl']) ||
      this.extractString(payload, ['data', 'content', 'last_frame_url']) ||
      this.extractString(payload, ['data', 'content', 'lastFrameUrl'])
    )
  }

  private extractUsage(payload: unknown) {
    return this.extractValue(payload, ['usage']) || this.extractValue(payload, ['data', 'usage']) || null
  }

  private extractExecutionExpiresAfter(payload: unknown) {
    return (
      this.extractNumber(payload, ['execution_expires_after']) ||
      this.extractNumber(payload, ['executionExpiresAfter']) ||
      this.extractNumber(payload, ['data', 'execution_expires_after']) ||
      this.extractNumber(payload, ['data', 'executionExpiresAfter'])
    )
  }

  private resolveVideoUrlExpiresAt(payload: unknown) {
    const updatedAt = this.extractNumber(payload, ['updated_at']) || this.extractNumber(payload, ['data', 'updated_at'])
    const baseMs = updatedAt > 0 ? updatedAt * 1000 : Date.now()
    return new Date(baseMs + 24 * 60 * 60 * 1000)
  }

  private extractErrorCode(payload: unknown) {
    return this.extractString(payload, ['error', 'code']) || this.extractString(payload, ['code']) || ''
  }

  private extractPromptText(content: SeedanceContentItem[]) {
    return content.find((item) => item.type === 'text')?.text ?? ''
  }

  private extractString(payload: unknown, path: string[]) {
    const value = this.extractValue(payload, path)
    return typeof value === 'string' ? value : ''
  }

  private extractNumber(payload: unknown, path: string[]) {
    const value = this.extractValue(payload, path)
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
  }

  private extractValue(payload: unknown, path: string[]) {
    let current = payload
    for (const key of path) {
      if (!current || typeof current !== 'object') return undefined
      current = Reflect.get(current, key)
    }
    return current
  }

  private deepFindVideoUrl(value: unknown): string {
    if (!value) return ''
    if (typeof value === 'string') return /\.mp4(\?|$)/i.test(value) || /tos.*video/i.test(value) ? value : ''
    if (Array.isArray(value)) {
      for (const item of value) {
        const result = this.deepFindVideoUrl(item)
        if (result) return result
      }
      return ''
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>
      for (const [key, child] of Object.entries(record)) {
        if (['video_url', 'videoUrl'].includes(key) && typeof child === 'string') return child
        if (['video_url', 'videoUrl'].includes(key) && child && typeof child === 'object') {
          const nestedUrl = this.extractString(child, ['url'])
          if (nestedUrl) return nestedUrl
        }
        const result = this.deepFindVideoUrl(child)
        if (result) return result
      }
    }
    return ''
  }

  private validateModelOptions(model: string, ratio: string, resolution: string) {
    const modelConfig = SEEDANCE_MODEL_CONFIGS[model]
    if (!modelConfig) {
      throw new BadRequestException('不支持的视频生成模型')
    }

    if (!SEEDANCE_RATIOS.includes(ratio)) {
      throw new BadRequestException('不支持的视频比例')
    }

    if (!modelConfig.resolutions.includes(resolution)) {
      throw new BadRequestException('不支持的视频分辨率')
    }
  }

  private validateDurationOption(duration: number, model: string) {
    const modelConfig = SEEDANCE_MODEL_CONFIGS[model]
    if (!modelConfig) {
      throw new BadRequestException('不支持的视频生成模型')
    }

    if (duration === -1) return
    if (duration < modelConfig.minDuration || duration > modelConfig.maxDuration) {
      throw new BadRequestException(
        `当前视频模型支持 ${modelConfig.minDuration}-${modelConfig.maxDuration} 秒，或设置为 -1 让模型自动选择时长`
      )
    }
  }

  private resolveTopics(topics: string[] | undefined, fallback: string[]) {
    const clean = (topics ?? [])
      .map((topic) => topic.trim())
      .filter(Boolean)
    const resolved = clean.length > 0 ? clean : fallback
    if (resolved.length === 0) throw new BadRequestException('请至少填写 1 个视频主题')
    return resolved.slice(0, 50)
  }

  private splitTopics(value: string) {
    return value
      .split(/\r?\n/)
      .map((topic) => topic.trim())
      .filter(Boolean)
  }

  private createPlannedAssets(product: Prisma.GeoMainProductProfileV3GetPayload<Record<string, never>>): PlannedAssetInput[] {
    const productSnapshot = this.toProductSnapshot(product)
    const productTitle = `${product.brand} ${product.productName}`
    const sellingPoints = this.joinRecordArray(productSnapshot, 'sellingPointsPool', product.coreParameters)
    const requiredContent = this.toStringArray(product.requiredContent).slice(0, 3).join('、') || product.coreParameters
    const emphasis = this.joinRecordArray(productSnapshot, 'emphasisPool', product.category)
    const scene = this.inferProductVisualScene(productSnapshot)
    const targetAudience = this.resolveProductAudience(productSnapshot)

    return [
      {
        planKey: 'product-standard-image',
        title: '产品标准参考图',
        kind: VideoGenerationAssetKind.IMAGE,
        role: 'reference_image',
        priority: VideoGenerationAssetPriority.REQUIRED,
        stage: 'Seedance 参考图',
        purpose: '稳定产品外观和画面识别，后续所有视频都优先引用。',
        brief: `生成或整理一张清晰的 ${productTitle} 标准图。画面主体完整、包装和标识可读，背景干净，体现品类「${product.category}」。需要覆盖：${requiredContent}。`,
        prompt: `清晰产品标准图，主体为 ${productTitle}，品类「${product.category}」，背景干净，包装和标识可读，体现：${requiredContent}。真实产品摄影风格。`,
        toolHint: '适合 GPT Image 或真实产品图整理',
        sourceFields: ['品牌', '产品名', '品类', '必写内容'],
      },
      {
        planKey: 'first-frame-cover',
        title: '首帧封面图',
        kind: VideoGenerationAssetKind.IMAGE,
        role: 'first_frame',
        priority: VideoGenerationAssetPriority.REQUIRED,
        stage: 'Seedance 首帧',
        purpose: '控制视频第一眼的产品信号和平台封面观感。',
        brief: `为 ${productTitle} 做一张竖屏首帧封面。第一眼看到产品和核心利益点，场景为${scene}，目标人群是${targetAudience}。画面不要堆字，重点突出：${sellingPoints}。`,
        prompt: `竖屏短视频首帧封面，主体为 ${productTitle}，场景为${scene}，面向${targetAudience}，第一眼看到产品和核心利益点，重点突出 ${sellingPoints}，真实自然，不要堆满文字。`,
        toolHint: '适合 GPT Image 生成首帧',
        sourceFields: ['目标人群', '卖点池', '强调点'],
      },
      {
        planKey: 'usage-scene-image',
        title: '使用场景参考图',
        kind: VideoGenerationAssetKind.IMAGE,
        role: 'reference_image',
        priority: VideoGenerationAssetPriority.RECOMMENDED,
        stage: 'Seedance 参考图',
        purpose: '让产品展示、种草、口播视频更贴近真实使用情境。',
        brief: `生成面向「${targetAudience}」的 ${productTitle} 使用场景图。场景为${scene}，动作真实自然，画面里产品是明确主体，体现使用前后或使用过程中的具体变化。`,
        prompt: `真实生活化使用场景图，${targetAudience} 正在使用 ${productTitle}，场景为${scene}，动作自然，产品明确可见，体现使用过程和结果反馈。`,
        toolHint: '适合 GPT Image 生成场景参考',
        sourceFields: ['目标人群', '随机内容池', '卖点池'],
      },
      {
        planKey: 'detail-closeup-image',
        title: '卖点细节特写',
        kind: VideoGenerationAssetKind.IMAGE,
        role: 'reference_image',
        priority: VideoGenerationAssetPriority.RECOMMENDED,
        stage: 'Seedance 参考图',
        purpose: '给产品展示、对比评测提供细节镜头依据。',
        brief: `准备 ${productTitle} 的细节特写图，突出 ${emphasis}。镜头接近产品，质感清楚，避免过度虚化。可包含局部结构、包装信息、使用动作或关键成分/参数。`,
        prompt: `产品细节特写，主体为 ${productTitle}，突出 ${emphasis}，镜头接近产品，质感清楚，局部结构、包装信息或使用动作可见，真实摄影风格。`,
        toolHint: '适合真实拍摄或 GPT Image 补图',
        sourceFields: ['强调点', '核心参数', '卖点池'],
      },
      {
        planKey: 'spokesperson-reference',
        title: '口播人物参考图',
        kind: VideoGenerationAssetKind.IMAGE,
        role: 'reference_image',
        priority: VideoGenerationAssetPriority.RECOMMENDED,
        stage: '口播/讲解参考',
        purpose: '统一真人口播、知识讲解、种草视频中的人物气质。',
        brief: `为 ${productTitle} 设定一位适合 ${targetAudience} 信任的口播人物。形象自然专业，服装和场景匹配「${product.category}」，表达亲和但不过度营销。`,
        prompt: `真人口播人物参考图，一位适合 ${targetAudience} 信任的博主，形象自然专业，服装和场景匹配「${product.category}」，亲和、可信、不过度营销。`,
        toolHint: '适合 GPT Image 生成人设参考',
        sourceFields: ['品类', '目标人群', '品牌调性'],
      },
      {
        planKey: 'motion-reference-video',
        title: '参考运镜视频',
        kind: VideoGenerationAssetKind.VIDEO,
        role: 'reference_video',
        priority: VideoGenerationAssetPriority.OPTIONAL,
        stage: 'Seedance 参考视频',
        purpose: '当你想模仿某种节奏、镜头运动或构图时使用。',
        brief: `准备一段 3 到 8 秒参考视频，镜头节奏匹配 ${productTitle}：开场产品识别、中段使用动作、结尾结果或利益点。参考视频只负责构图和运镜，不要求同款产品。`,
        prompt: `参考视频需求：3 到 8 秒，开场产品识别，中段使用动作，结尾结果或利益点，节奏适合 ${productTitle}。`,
        toolHint: '适合用户提供链接或素材库沉淀',
        sourceFields: ['视频类型', '场景', '镜头节奏'],
      },
      {
        planKey: 'voiceover-audio',
        title: '口播旁白音频',
        kind: VideoGenerationAssetKind.AUDIO,
        role: 'reference_audio',
        priority: VideoGenerationAssetPriority.RECOMMENDED,
        stage: '配音参考',
        purpose: '控制声音气质，后续可接 VoxCPM 或 ComfyUI 生成。',
        brief: `为 ${productTitle} 准备 4 到 10 秒口播音频。语速清楚，音色匹配 ${targetAudience}，内容围绕：${sellingPoints}。适合先做短句，后续再扩展成完整旁白。`,
        prompt: `4 到 10 秒口播旁白，语速清楚，音色匹配 ${targetAudience}，内容围绕 ${sellingPoints}。`,
        toolHint: '适合 VoxCPM / ComfyUI',
        sourceFields: ['目标人群', '卖点池', '必写内容'],
      },
      {
        planKey: 'last-frame-image',
        title: '尾帧定格图',
        kind: VideoGenerationAssetKind.IMAGE,
        role: 'last_frame',
        priority: VideoGenerationAssetPriority.OPTIONAL,
        stage: 'Seedance 尾帧',
        purpose: '让视频结尾落在产品、卖点或行动建议上。',
        brief: `为 ${productTitle} 做一张尾帧图。产品完整出现，画面留下明确记忆点，信息聚焦 ${emphasis}。适合结尾定格，不要塞满营销文字。`,
        prompt: `短视频尾帧定格图，主体为 ${productTitle}，产品完整出现，信息聚焦 ${emphasis}，画面干净，有明确记忆点，不要塞满文字。`,
        toolHint: '适合 GPT Image 生成尾帧',
        sourceFields: ['强调点', '品牌', '产品名'],
      },
    ]
  }

  private createStoryboardScenes(product: Record<string, unknown>, topics: string[]): StoryboardScene[] {
    const productTitle = `${this.textFromRecord(product, 'brand', '')} ${this.textFromRecord(product, 'productName', '产品')}`.trim()
    const category = this.textFromRecord(product, 'category', '产品品类')
    const targetAudience = this.resolveProductAudience(product)
    const sellingPoints = this.joinRecordArray(product, 'sellingPointsPool', this.textFromRecord(product, 'coreParameters', '核心卖点'))
    const requiredContent = this.joinRecordArray(product, 'requiredContent', '必写内容')
    const scene = this.inferProductVisualScene(product)
    const topic = topics[0] || `${productTitle} 短视频`

    return [
      {
        index: 1,
        timeRange: '0-2s',
        title: '开场钩子',
        visual: `在${scene}中快速露出 ${productTitle}，第一眼建立品类「${category}」和使用场景。`,
        narration: `${targetAudience} 如果正在关注 ${topic}，先看这一点。`,
        seedancePrompt: `竖屏开场 0-2 秒，${scene}，快速露出 ${productTitle}，产品清晰可见，画面真实自然，第一眼建立 ${category} 场景。`,
        assetRoles: ['first_frame', 'reference_image'],
      },
      {
        index: 2,
        timeRange: '2-5s',
        title: '问题/需求',
        visual: `用一个真实动作或近景展示目标人群的需求，不夸张表演。`,
        narration: `很多人在意的不是概念，而是实际使用时能不能解决具体问题。`,
        seedancePrompt: `2-5 秒，真实使用动作，表现 ${targetAudience} 的具体需求，镜头稳定，生活化，不夸张。`,
        assetRoles: ['reference_image', 'reference_video'],
      },
      {
        index: 3,
        timeRange: '5-8s',
        title: '核心卖点',
        visual: `切到产品细节、使用过程或结果反馈，集中呈现 ${sellingPoints}。`,
        narration: `这款产品的关键点是：${sellingPoints}。`,
        seedancePrompt: `5-8 秒，产品细节特写和使用过程，突出 ${sellingPoints}，字幕短句，节奏清楚。`,
        assetRoles: ['reference_image'],
      },
      {
        index: 4,
        timeRange: '8-11s',
        title: '必写信息',
        visual: `补充可信信息，镜头停留在产品、包装、参数或真实场景上。`,
        narration: `需要特别说明的是：${requiredContent}。`,
        seedancePrompt: `8-11 秒，补充可信产品信息：${requiredContent}，镜头停留在产品、包装、参数或真实使用场景。`,
        assetRoles: ['reference_image', 'reference_audio'],
      },
      {
        index: 5,
        timeRange: '11-12s',
        title: '结尾记忆点',
        visual: `产品完整出现，给出自然建议，尾帧可定格。`,
        narration: `如果你属于 ${targetAudience}，可以优先把它作为一个备选。`,
        seedancePrompt: `11-12 秒，${productTitle} 完整出现，结尾自然推荐，画面干净，尾帧定格在产品和核心利益点上。`,
        assetRoles: ['last_frame'],
      },
    ]
  }

  private renderStoryboardScript(product: Record<string, unknown>, scenes: StoryboardScene[]) {
    const productTitle = `${this.textFromRecord(product, 'brand', '')} ${this.textFromRecord(product, 'productName', '产品')}`.trim()
    return [
      `视频对象：${productTitle}`,
      '',
      ...scenes.map((scene) => [
        `${scene.index}. ${scene.timeRange} ${scene.title}`,
        `画面：${scene.visual}`,
        `旁白：${scene.narration}`,
        `Seedance：${scene.seedancePrompt}`,
        `素材角色：${scene.assetRoles.join('、')}`,
      ].join('\n')),
    ].join('\n\n')
  }

  private toProductSnapshot(product: Prisma.GeoMainProductProfileV3GetPayload<Record<string, never>>) {
    return {
      id: product.id,
      name: product.name,
      brand: product.brand,
      productName: product.productName,
      category: product.category,
      targetAudience: product.targetAudience,
      coreParameters: product.coreParameters,
      keyword: product.keyword,
      seoKeywords: this.toStringArray(product.seoKeywords ?? []),
      brandPool: this.toStringArray(product.brandPool ?? []),
      requiredContent: this.toStringArray(product.requiredContent),
      randomContentPool: this.toStringArray(product.randomContentPool),
      sellingPointsPool: this.toStringArray(product.sellingPointsPool ?? []),
      emphasisPool: this.toStringArray(product.emphasisPool ?? []),
    }
  }

  private resolveRunProductSnapshot(
    snapshot: Prisma.JsonValue,
    product?: Prisma.GeoMainProductProfileV3GetPayload<Record<string, never>> | null
  ) {
    const snapshotRecord = this.toRecord(snapshot)
    if (Object.keys(snapshotRecord).length > 0) return snapshotRecord
    return product ? this.toProductSnapshot(product) : undefined
  }

  private toStringArray(value: unknown) {
    if (!Array.isArray(value)) return []
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim()
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>
          return String(record.label ?? record.name ?? record.value ?? '').trim()
        }
        return String(item ?? '').trim()
      })
      .filter(Boolean)
  }

  private resolveProductAudience(product: Record<string, unknown>) {
    const explicit = this.textFromRecord(product, 'targetAudience', '')
    if (explicit) return this.cleanAudienceText(explicit)

    const candidates = [
      ...this.toStringArray(product.emphasisPool),
      ...this.toStringArray(product.randomContentPool),
      ...this.toStringArray(product.requiredContent),
    ]
    const inferred = candidates.find((item) => /用户|人群|学生|儿童|家长|妈妈|女性|男性|通勤|户外|运动/.test(item))
    return this.cleanAudienceText(inferred) || '产品目标用户'
  }

  private cleanAudienceText(value: unknown) {
    const text = typeof value === 'string' ? value.trim() : ''
    if (!text) return ''

    const suitableMatch = text.match(/^适合(.+?)(?:的?用户|的人群)?$/)
    if (suitableMatch?.[1]) {
      const cleaned = suitableMatch[1].replace(/等$/, '').trim()
      return cleaned.endsWith('人群') ? cleaned : `${cleaned}人群`
    }

    return text
  }

  private inferProductVisualScene(product: Record<string, unknown>) {
    const text = [
      this.textFromRecord(product, 'category', ''),
      this.textFromRecord(product, 'productName', ''),
      this.textFromRecord(product, 'coreParameters', ''),
    ].join(' ')

    if (/茶|饮|咖啡|奶|果|食品|零食|餐/.test(text)) return '明亮餐桌、吧台或真实饮用场景'
    if (/护肤|美妆|面膜|洗护|香/.test(text)) return '干净浴室、梳妆台或日常护理场景'
    if (/防晒衣|冲锋衣|服装|衣|鞋|户外|运动|穿搭/.test(text)) return '城市通勤、户外活动或真实穿着场景'
    if (/家电|数码|电器|设备|工具|智能/.test(text)) return '整洁桌面、居家空间或实际操作场景'
    if (/课程|教育|学习|学生|儿童|孩子|教辅|软件|平台|服务|系统/.test(text)) return '家庭学习桌、亲子辅导或屏幕讲解场景'
    return '真实生活化使用场景'
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return value as Record<string, unknown>
  }

  private textFromRecord(record: Record<string, unknown>, key: string, fallback: string) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (Array.isArray(value)) {
      const text = this.toStringArray(value).join('、')
      if (text) return text
    }
    return fallback
  }

  private joinRecordArray(record: Record<string, unknown>, key: string, fallback: string) {
    const text = this.toStringArray(record[key]).join('、')
    return text || fallback
  }

  private summarizeText(value: string, maxLength = 240) {
    const text = this.toLongText(value).replace(/\s+/g, ' ')
    if (text.length <= maxLength) return text
    return `${text.slice(0, maxLength)}...`
  }

  private toInputJson(value: unknown) {
    if (value === undefined || value === null) return null
    return value as Prisma.InputJsonValue
  }

  private toOptionalUrl(value: unknown) {
    const url = typeof value === 'string' ? value.trim() : ''
    if (!url) return ''
    if (!/^https?:\/\//i.test(url)) {
      throw new BadRequestException('回调地址必须是 http 或 https URL')
    }
    return url
  }

  private toOptionalPublicUrl(value: unknown) {
    const url = typeof value === 'string' ? value.trim() : ''
    if (!url) return ''
    if (!/^https?:\/\//i.test(url)) {
      throw new BadRequestException('素材 URL 必须是 http 或 https URL')
    }
    return url
  }

  private toErrorMessage(error: unknown) {
    if (error instanceof BadRequestException) {
      const response = error.getResponse()
      if (typeof response === 'string') return response
      if (response && typeof response === 'object') {
        const message = Reflect.get(response, 'message')
        return Array.isArray(message) ? message.join('；') : String(message ?? '创建视频任务失败')
      }
    }
    if (error instanceof Error && error.message.trim()) return error.message.trim()
    if (typeof error === 'string' && error.trim()) return error.trim()
    return '创建视频任务失败'
  }

  private requireText(value: unknown, message: string) {
    const text = typeof value === 'string' ? value.trim() : ''
    if (!text) throw new BadRequestException(message)
    return text
  }

  private requireLongText(value: unknown, message: string) {
    const text = this.toLongText(value)
    if (!text) throw new BadRequestException(message)
    return text
  }

  private toShortText(value: unknown, maxLength = 191) {
    const text = typeof value === 'string' ? value.trim() : ''
    return text.slice(0, maxLength)
  }

  private toLongText(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
  }

  private requirePositiveInt(value: unknown, message: string) {
    const number = Number(value)
    if (!Number.isInteger(number) || number <= 0) throw new BadRequestException(message)
    return number
  }

  private toOptionalPositiveInt(value: unknown) {
    const number = Number(value)
    return Number.isInteger(number) && number > 0 ? number : undefined
  }

  private toOptionalEnumValue<T extends string>(value: string, allowed: T[]) {
    return allowed.includes(value as T) ? (value as T) : undefined
  }

  private sourceTypeLabel(sourceType: VideoGenerationSourceType) {
    const labels: Record<VideoGenerationSourceType, string> = {
      MANUAL: '手动主题',
      GEO_V3_PRODUCT: 'V3 产品',
      GEO_V3_RUN: 'V3 生成记录',
      GEO_V3_ITEM: 'V3 Prompt',
    }
    return labels[sourceType]
  }

  private createTemplateKey(name: string) {
    return `custom-${Date.now()}-${name.replace(/\s+/g, '-').slice(0, 24)}`
  }

  private toAssetView(asset: VideoAssetRecord) {
    return {
      id: asset.id,
      productProfileId: asset.productProfileId,
      campaignId: asset.campaignId,
      taskId: asset.taskId,
      planKey: asset.planKey,
      title: asset.title,
      kind: asset.kind,
      role: asset.role,
      priority: asset.priority,
      status: asset.status,
      sourceType: asset.sourceType,
      stage: asset.stage,
      purpose: asset.purpose,
      brief: asset.brief,
      prompt: asset.prompt,
      toolHint: asset.toolHint,
      sourceFields: this.toStringArray(asset.sourceFields),
      url: asset.url,
      localPath: asset.localPath,
      provider: asset.provider,
      providerTaskId: asset.providerTaskId,
      model: asset.model,
      errorMessage: asset.errorMessage,
      productSnapshot: asset.productSnapshot,
      metadata: asset.metadata,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    }
  }

  private toStoryboardView(storyboard: VideoStoryboardRecord) {
    return {
      id: storyboard.id,
      productProfileId: storyboard.productProfileId,
      campaignId: storyboard.campaignId,
      sourceType: storyboard.sourceType,
      title: storyboard.title,
      topicText: storyboard.topicText,
      scriptText: storyboard.scriptText,
      scenes: storyboard.scenes,
      productSnapshot: storyboard.productSnapshot,
      sourceSnapshot: storyboard.sourceSnapshot,
      createdAt: storyboard.createdAt.toISOString(),
      updatedAt: storyboard.updatedAt.toISOString(),
    }
  }

  private toTemplateView(template: VideoTemplateRecord) {
    return {
      id: template.id,
      key: template.key,
      name: template.name,
      type: template.type,
      description: template.description,
      model: template.model,
      resolution: template.resolution,
      ratio: template.ratio,
      duration: template.duration,
      generateAudio: template.generateAudio,
      watermark: template.watermark,
      promptTemplate: template.promptTemplate,
      isActive: template.isActive,
      sortOrder: template.sortOrder,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    }
  }

  private toCampaignView(campaign: VideoCampaignWithRelations, includeTasks: boolean) {
    return {
      id: campaign.id,
      name: campaign.name,
      sourceType: campaign.sourceType,
      status: campaign.status,
      templateId: campaign.templateId,
      templateName: campaign.templateName || campaign.template?.name || '',
      productProfileId: campaign.productProfileId,
      geoRunId: campaign.geoRunId,
      geoItemId: campaign.geoItemId,
      topicText: campaign.topicText,
      productSnapshot: campaign.productSnapshot,
      sourceSnapshot: campaign.sourceSnapshot,
      requestedCount: campaign.requestedCount,
      successCount: campaign.successCount,
      failedCount: campaign.failedCount,
      runningCount: campaign.runningCount,
      queuedCount: campaign.queuedCount,
      lastError: campaign.lastError,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      completedAt: campaign.completedAt?.toISOString() ?? null,
      tasks: includeTasks ? campaign.tasks.map((task) => this.toTaskView(task)) : campaign.tasks.map((task) => this.toTaskView(task)),
    }
  }

  private toTaskView(task: Prisma.VideoGenerationTaskGetPayload<Record<string, never>>) {
    return {
      id: task.id,
      campaignId: task.campaignId,
      providerTaskId: task.providerTaskId,
      status: task.status,
      model: task.model,
      resolution: task.resolution,
      ratio: task.ratio,
      duration: task.duration,
      generateAudio: task.generateAudio,
      watermark: task.watermark,
      cameraFixed: task.cameraFixed,
      returnLastFrame: task.returnLastFrame,
      callbackUrl: task.callbackUrl,
      promptText: task.promptText,
      content: task.content,
      referenceAssets: task.referenceAssets,
      productSnapshot: task.productSnapshot,
      sourceSnapshot: task.sourceSnapshot,
      videoUrl: task.videoUrl,
      videoUrlExpiresAt: task.videoUrlExpiresAt?.toISOString() ?? null,
      lastFrameUrl: task.lastFrameUrl,
      transferredVideoUrl: task.transferredVideoUrl,
      localVideoPath: task.localVideoPath,
      transferStatus: task.transferStatus,
      transferError: task.transferError,
      transferredAt: task.transferredAt?.toISOString() ?? null,
      usage: task.usage,
      seed: task.seed,
      framesPerSecond: task.framesPerSecond,
      serviceTier: task.serviceTier,
      executionExpiresAfter: task.executionExpiresAfter,
      errorCode: task.errorCode,
      errorMessage: task.errorMessage,
      arkResponse: task.arkResponse,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      completedAt: task.completedAt?.toISOString() ?? null,
    }
  }
}
