import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import {
  Prisma,
  type VideoMaterial,
  type VideoMaterialClip,
  type VideoMaterialTranscriptSegment,
} from '@prisma/client'
import { spawn } from 'node:child_process'
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
} from 'node:fs'
import {
  copyFile,
  mkdtemp,
  rename,
  rm,
  unlink,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../common/prisma.service'
import {
  AnalyzeVideoMaterialDto,
  ConfirmVideoMaterialClipsDto,
  ReprocessVideoMaterialDto,
  UpdateVideoMaterialClipDto,
  UploadVideoMaterialDto,
  VIDEO_MATERIAL_PRODUCT_CATEGORIES,
} from './dto/video-material.dto'
import {
  VideoMaterialAiService,
  type VideoMaterialAiUsage,
  type VideoMaterialTranscriptSegmentResult,
} from './video-material-ai.service'
import { planVideoSegments } from './video-segmentation'
import sharp = require('sharp')

type UploadedVideoFile = {
  originalname: string
  mimetype: string
  path: string
  size: number
}

type MaterialWithClips = VideoMaterial & {
  clips?: VideoMaterialClip[]
  transcriptSegments?: VideoMaterialTranscriptSegment[]
  _count?: { clips: number; transcriptSegments?: number }
}

type VideoProbe = {
  durationMs: number
  width: number
  height: number
  fps: number
  videoCodec: string
  audioCodec: string
  hasAudio: boolean
  raw: Record<string, unknown>
}

type ClipSegment = {
  startMs: number
  endMs: number
}

type ReusableTranscriptSegment = ClipSegment & {
  transcript: string
}

type TimelineSegment = VideoMaterialTranscriptSegmentResult & {
  model: string
}

const OUTDOOR_BRAND_ALIASES = [
  { canonical: 'VBREX', aliases: ['BREX'] },
  { canonical: '蕉内', aliases: [] },
  { canonical: 'GaKior', aliases: ['Goxer'] },
  { canonical: '觅橘', aliases: ['蜜橘', '冕橘'] },
  { canonical: '伯希和', aliases: ['薄熙禾'] },
  { canonical: '北面', aliases: [] },
  { canonical: '始祖鸟', aliases: [] },
  { canonical: '哥伦比亚', aliases: ['哥伦比亞'] },
  { canonical: '优衣库', aliases: [] },
  { canonical: '巴塔哥尼亚', aliases: [] },
] as const

const SHOT_TAXONOMY = [
  ['UNCLASSIFIED', '待判断画面'],
  ['TITLE_CARD', '标题 / 章节卡'],
  ['TALKING_HEAD', '人物口播'],
  ['PRODUCT_DISPLAY', '产品展示'],
  ['DETAIL_CLOSEUP', '细节特写'],
  ['TRY_ON', '上身试穿'],
  ['OUTDOOR_USAGE', '户外使用场景'],
  ['TEST_DEMONSTRATION', '实测 / 动作演示'],
  ['DATA_GRAPHIC', '参数卡 / 图文'],
  ['SCREEN_CONTENT', '网页 / 评论画面'],
  ['MONTAGE', '拼接 / 分屏画面'],
  ['TRANSITION', '过渡镜头'],
  ['ENDING', '结尾镜头'],
  ['OTHER', '其他画面'],
] as const

const PRODUCT_TAXONOMY = [
  {
    value: 'SUN_PROTECTIVE_CLOTHING',
    label: '防晒衣',
    brandAliases: OUTDOOR_BRAND_ALIASES,
    contentTypes: [
      ['UNCLASSIFIED', '待分类'],
      ['PRODUCT_OVERVIEW', '产品整体介绍'],
      ['GENERAL_CONTEXT', '需求痛点 / 行业背景'],
      ['KNOWLEDGE_GUIDE', '知识科普 / 选购指标'],
      ['UV_PROTECTION', '防晒性能 / 紫外线'],
      ['BREATHABILITY_COOLING', '透气 / 凉感'],
      ['COVERAGE_DESIGN', '遮阳覆盖设计'],
      ['FABRIC_CRAFT', '面料 / 工艺'],
      ['WASH_DURABILITY', '洗涤 / 耐磨耐用'],
      ['WATER_REPELLENCY', '防泼水'],
      ['BRAND_REVIEW', '单品牌 / 单款评测'],
      ['BRAND_COMPARISON', '多品牌对比'],
      ['PRICE_BUYING_GUIDE', '价格与购买建议'],
      ['OTHER', '其他'],
    ],
  },
  {
    value: 'SHELL_JACKET',
    label: '冲锋衣',
    brandAliases: OUTDOOR_BRAND_ALIASES,
    contentTypes: [
      ['UNCLASSIFIED', '待分类'],
      ['PRODUCT_OVERVIEW', '产品整体介绍'],
      ['GENERAL_CONTEXT', '需求痛点 / 行业背景'],
      ['KNOWLEDGE_GUIDE', '知识科普 / 选购指标'],
      ['WATERPROOF', '防水性能'],
      ['WINDPROOF', '防风性能'],
      ['BREATHABILITY', '透气性能'],
      ['FABRIC_CRAFT', '面料 / 工艺'],
      ['SEAM_CONSTRUCTION', '压胶 / 接缝'],
      ['HOOD_CUFF_DESIGN', '帽檐 / 袖口设计'],
      ['ABRASION_DURABILITY', '耐磨 / 耐用'],
      ['BRAND_REVIEW', '单品牌 / 单款评测'],
      ['BRAND_COMPARISON', '多品牌对比'],
      ['PRICE_BUYING_GUIDE', '价格与购买建议'],
      ['OTHER', '其他'],
    ],
  },
] as const

const ALLOWED_VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.m4v',
  '.avi',
  '.mkv',
  '.webm',
])

export const getVideoMaterialProductTaxonomy = (productCategory: string) => {
  const product = PRODUCT_TAXONOMY.find((item) => item.value === productCategory)
  if (!product) return null
  return {
    value: product.value,
    label: product.label,
    contentTypes: product.contentTypes.map(([value, label]) => ({ value, label })),
  }
}

export const getVideoMaterialShotTaxonomy = () =>
  SHOT_TAXONOMY.map(([value, label]) => ({ value, label }))

@Injectable()
export class VideoMaterialsService implements OnModuleInit {
  private readonly storageRoot: string
  private readonly sourceDirectory: string
  private readonly clipDirectory: string
  private readonly keyframeDirectory: string
  private readonly ffmpegPath: string
  private readonly ffprobePath: string
  private queuePromise: Promise<void> | null = null
  private aiQueuePromise: Promise<void> | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly materialAi: VideoMaterialAiService
  ) {
    this.storageRoot = resolve(
      process.env.VIDEO_MATERIAL_STORAGE_ROOT?.trim()
        || join(process.cwd(), 'storage', 'video-materials')
    )
    this.sourceDirectory = join(this.storageRoot, 'sources')
    this.clipDirectory = join(this.storageRoot, 'clips')
    this.keyframeDirectory = join(this.storageRoot, 'keyframes')
    this.ffmpegPath = this.resolveBinary('FFMPEG_PATH', 'ffmpeg')
    this.ffprobePath = this.resolveBinary('FFPROBE_PATH', 'ffprobe')

    for (const directory of [this.sourceDirectory, this.clipDirectory, this.keyframeDirectory]) {
      mkdirSync(directory, { recursive: true })
    }
  }

  async onModuleInit() {
    try {
      await this.prisma.videoMaterial.updateMany({
        where: { status: 'PROCESSING' },
        data: {
          status: 'QUEUED',
          stage: '服务恢复，重新排队',
          progress: 0,
          processingStartedAt: null,
          completedAt: null,
        },
      })
      await this.prisma.videoMaterial.updateMany({
        where: { aiStatus: 'ANALYZING' },
        data: {
          aiStatus: 'QUEUED',
          aiStage: '服务恢复，重新排队',
          aiProgress: 0,
          aiStartedAt: null,
          aiCompletedAt: null,
        },
      })
      this.scheduleQueue()
      this.scheduleAiQueue()
    } catch (error) {
      console.error('[VideoMaterials] Failed to recover processing queue', error)
    }
  }

  findTaxonomy() {
    return PRODUCT_TAXONOMY.map((product) => ({
      value: product.value,
      label: product.label,
      shotTypes: SHOT_TAXONOMY.map(([value, label]) => ({ value, label })),
      contentTypes: product.contentTypes.map(([value, label]) => ({ value, label })),
    }))
  }

  findAiConfiguration() {
    return this.materialAi.configuration()
  }

  async findMaterials(productCategory?: string) {
    const category = productCategory?.trim()
    if (category && !VIDEO_MATERIAL_PRODUCT_CATEGORIES.includes(category as any)) {
      throw new BadRequestException('不支持的产品品类')
    }

    const materials = await this.prisma.videoMaterial.findMany({
      where: category ? { productCategory: category } : undefined,
      include: {
        _count: {
          select: { clips: true, transcriptSegments: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    })

    return materials.map((material) => this.toMaterialView(material, false))
  }

  async findMaterial(id: number) {
    const material = await this.prisma.videoMaterial.findUnique({
      where: { id },
      include: {
        clips: {
          orderBy: [{ clipIndex: 'asc' }],
        },
        transcriptSegments: {
          orderBy: [{ segmentIndex: 'asc' }],
        },
      },
    })

    if (!material) throw new NotFoundException('视频素材不存在')
    return this.toMaterialView(material, true)
  }

  async previewSegmentation(id: number, payload: ReprocessVideoMaterialDto) {
    const material = await this.prisma.videoMaterial.findUnique({
      where: { id },
      include: { clips: { orderBy: { clipIndex: 'asc' } } },
    })
    if (!material) throw new NotFoundException('视频素材不存在')
    if (material.status === 'QUEUED' || material.status === 'PROCESSING') {
      throw new BadRequestException('视频正在处理中，请完成后再预览拆片方案')
    }
    if (material.aiStatus === 'QUEUED' || material.aiStatus === 'ANALYZING') {
      throw new BadRequestException('AI 正在识别素材，请完成后再预览拆片方案')
    }

    this.ensureFfmpegAvailable()
    const minClipDurationMs = Math.round(payload.minClipDurationMs ?? material.minClipDurationMs)
    const maxClipDurationMs = Math.round(payload.maxClipDurationMs ?? material.maxClipDurationMs)
    if (maxClipDurationMs < minClipDurationMs) {
      throw new BadRequestException('最长片段不能短于最短片段')
    }
    const sceneThreshold = payload.sceneThreshold ?? material.sceneThreshold
    const probe = await this.probeVideo(material.sourcePath)
    const sceneTimes = await this.detectSceneChanges(material.sourcePath, sceneThreshold)
    const planned = planVideoSegments({
      durationMs: probe.durationMs,
      sceneTimes,
      minDurationMs: minClipDurationMs,
      maxDurationMs: maxClipDurationMs,
    })
    const currentDurations = material.clips.map((clip) => clip.durationMs)
    const linkedSceneCount = await this.prisma.videoAssemblyScene.count({
      where: { selectedClip: { materialId: id } },
    })

    return {
      materialId: id,
      configuration: {
        sceneThreshold,
        minClipDurationMs,
        maxClipDurationMs,
      },
      current: {
        clipCount: material.clips.length,
        shortestSegmentMs: currentDurations.length ? Math.min(...currentDurations) : 0,
        longestSegmentMs: currentDurations.length ? Math.max(...currentDurations) : 0,
        averageSegmentMs: currentDurations.length
          ? Math.round(currentDurations.reduce((sum, duration) => sum + duration, 0) / currentDurations.length)
          : 0,
        confirmedClipCount: material.clips.filter((clip) => clip.reviewStatus === 'CONFIRMED').length,
      },
      preview: {
        ...planned.diagnostics,
        segments: planned.segments.map((segment, index) => ({
          clipIndex: index + 1,
          startMs: segment.startMs,
          endMs: segment.endMs,
          durationMs: segment.endMs - segment.startMs,
        })),
      },
      linkedSceneCount,
    }
  }

  async storeUploadedVideo(file: UploadedVideoFile | undefined, payload: UploadVideoMaterialDto) {
    if (!file) throw new BadRequestException('请选择视频文件')

    const originalName = this.normalizeOriginalName(file.originalname)
    const extension = extname(originalName).toLowerCase()
    if (!ALLOWED_VIDEO_EXTENSIONS.has(extension)) {
      await this.safeUnlink(file.path)
      throw new BadRequestException('仅支持 MP4、MOV、M4V、AVI、MKV 和 WebM 视频')
    }

    if (!VIDEO_MATERIAL_PRODUCT_CATEGORIES.includes(payload.productCategory as any)) {
      await this.safeUnlink(file.path)
      throw new BadRequestException('请选择防晒衣或冲锋衣素材库')
    }

    this.ensureFfmpegAvailable()
    const minClipDurationMs = Math.round(payload.minClipDurationMs ?? 4000)
    const maxClipDurationMs = Math.round(payload.maxClipDurationMs ?? 15_000)
    if (maxClipDurationMs < minClipDurationMs) {
      await this.safeUnlink(file.path)
      throw new BadRequestException('最长片段不能短于最短片段')
    }
    const sourceFileName = `${randomUUID()}${extension}`
    const sourcePath = join(this.sourceDirectory, sourceFileName)

    try {
      await this.moveFile(file.path, sourcePath)
      const material = await this.prisma.videoMaterial.create({
        data: {
          productCategory: payload.productCategory,
          originalName,
          sourceFileName,
          sourcePath,
          mimeType: file.mimetype || 'application/octet-stream',
          fileSizeBytes: String(file.size || 0),
          status: 'QUEUED',
          progress: 0,
          stage: '等待处理',
          errorMessage: '',
          sceneThreshold: payload.sceneThreshold ?? 0.3,
          minClipDurationMs,
          maxClipDurationMs,
          metadata: {} as Prisma.InputJsonValue,
        },
      })
      this.scheduleQueue()
      return this.toMaterialView(material, false)
    } catch (error) {
      await this.safeUnlink(file.path)
      await this.safeUnlink(sourcePath)
      throw error
    }
  }

  async reprocessMaterial(id: number, payload: ReprocessVideoMaterialDto) {
    const material = await this.prisma.videoMaterial.findUnique({
      where: { id },
      include: { clips: { orderBy: { clipIndex: 'asc' } } },
    })
    if (!material) throw new NotFoundException('视频素材不存在')
    if (material.status === 'PROCESSING') {
      throw new BadRequestException('视频正在处理中，请完成后再重新拆片')
    }
    if (material.aiStatus === 'QUEUED' || material.aiStatus === 'ANALYZING') {
      throw new BadRequestException('AI 正在识别素材，请完成后再重新拆片')
    }

    const minClipDurationMs = Math.round(payload.minClipDurationMs ?? material.minClipDurationMs)
    const maxClipDurationMs = Math.round(payload.maxClipDurationMs ?? material.maxClipDurationMs)
    if (maxClipDurationMs < minClipDurationMs) {
      throw new BadRequestException('最长片段不能短于最短片段')
    }

    const reusableTranscripts = material.clips
      .filter((clip) => clip.transcript?.trim())
      .map((clip) => ({
        startMs: clip.startMs,
        endMs: clip.endMs,
        transcript: clip.transcript!.trim(),
      }))

    const existingMetadata = this.readJsonObject(material.metadata)
    const updated = await this.prisma.videoMaterial.update({
      where: { id },
      data: {
        status: 'QUEUED',
        progress: 0,
        stage: '等待安全重新拆片',
        errorMessage: '',
        sceneThreshold: payload.sceneThreshold ?? material.sceneThreshold,
        minClipDurationMs,
        maxClipDurationMs,
        metadata: {
          ...existingMetadata,
          reusableTranscripts,
          pendingReprocess: {
            requestedAt: new Date().toISOString(),
            previousClipCount: material.clips.length,
            sceneThreshold: payload.sceneThreshold ?? material.sceneThreshold,
            minClipDurationMs,
            maxClipDurationMs,
          },
        } as Prisma.InputJsonValue,
        processingStartedAt: null,
      },
    })
    this.scheduleQueue()
    return this.toMaterialView(updated, false)
  }

  async previewAiAnalysis(id: number, payload: AnalyzeVideoMaterialDto) {
    const material = await this.prisma.videoMaterial.findUnique({
      where: { id },
      include: {
        clips: { orderBy: { clipIndex: 'asc' } },
        _count: { select: { transcriptSegments: true } },
      },
    })
    if (!material) throw new NotFoundException('视频素材不存在')
    if (material.status !== 'READY') {
      throw new BadRequestException('请等待视频拆片完成后再预估 AI 智能分类')
    }
    const targetClips = this.resolveAiTargetClips(material.clips, payload)
    if (!targetClips.length) {
      throw new BadRequestException('没有需要进行 AI 智能分类的镜头')
    }
    const analyzedClipCount = material.clips.filter((clip) => clip.analyzedAt).length
    const estimateByPreviousRun = (usage: number) => analyzedClipCount && usage
      ? Math.round((usage / analyzedClipCount) * targetClips.length)
      : null
    const timelineWillBeCreated = material.hasAudio && material._count.transcriptSegments === 0

    return {
      materialId: id,
      clipIds: targetClips.map((clip) => clip.id),
      clipCount: targetClips.length,
      confirmedClipCount: targetClips.filter((clip) => clip.reviewStatus === 'CONFIRMED').length,
      existingTranscriptCount: targetClips.filter((clip) => clip.transcript?.trim()).length,
      audioSeconds: timelineWillBeCreated ? Math.round(material.durationMs / 100) / 10 : 0,
      timelineSegmentCount: material._count.transcriptSegments,
      timelineWillBeCreated,
      keyframeCount: targetClips.length * 3,
      estimatedInputTokens: estimateByPreviousRun(material.aiInputTokens),
      estimatedOutputTokens: estimateByPreviousRun(material.aiOutputTokens),
      visionModel: this.materialAi.configuration().visionModel,
      asrModel: this.materialAi.configuration().asrModel,
      timelineAsrModel: this.materialAi.configuration().timelineAsrModel,
    }
  }

  async analyzeMaterial(id: number, payload: AnalyzeVideoMaterialDto) {
    const material = await this.prisma.videoMaterial.findUnique({
      where: { id },
      include: { clips: true },
    })
    if (!material) throw new NotFoundException('视频素材不存在')
    if (material.status !== 'READY') {
      throw new BadRequestException('请等待视频拆片完成后再进行 AI 智能分类')
    }
    if (material.aiStatus === 'QUEUED' || material.aiStatus === 'ANALYZING') {
      throw new BadRequestException('该视频正在进行 AI 智能分类')
    }
    if (!this.materialAi.configuration().configured) {
      throw new BadRequestException('后端尚未配置百炼 API Key')
    }

    const targetClips = this.resolveAiTargetClips(material.clips, payload)
    if (!targetClips.length) {
      throw new BadRequestException('所有镜头都已人工确认，无需重新智能分类')
    }

    const selectedConfirmedIds = targetClips
      .filter((clip) => clip.reviewStatus === 'CONFIRMED')
      .map((clip) => clip.id)
    if (selectedConfirmedIds.length) {
      await this.prisma.videoMaterialClip.updateMany({
        where: { materialId: id, id: { in: selectedConfirmedIds } },
        data: { reviewStatus: 'PENDING' },
      })
    }

    const existingMetadata = this.readJsonObject(material.metadata)
    const updated = await this.prisma.videoMaterial.update({
      where: { id },
      data: {
        aiStatus: 'QUEUED',
        aiProgress: 0,
        aiStage: `等待 AI 智能分类（${targetClips.length} 个镜头）`,
        aiErrorMessage: '',
        aiInputTokens: 0,
        aiOutputTokens: 0,
        aiAudioSeconds: 0,
        aiStartedAt: null,
        aiCompletedAt: null,
        metadata: {
          ...existingMetadata,
          aiSelection: {
            clipIds: targetClips.map((clip) => clip.id),
            targetCount: targetClips.length,
            queuedAt: new Date().toISOString(),
          },
        } as Prisma.InputJsonValue,
      },
    })
    this.scheduleAiQueue()
    return this.toMaterialView(updated, false)
  }

  async removeMaterial(id: number) {
    const material = await this.prisma.videoMaterial.findUnique({
      where: { id },
      include: {
        clips: true,
        assemblyProjectSources: { select: { projectId: true } },
      },
    })
    if (!material) throw new NotFoundException('视频素材不存在')
    if (material.status === 'PROCESSING') {
      throw new BadRequestException('视频正在处理中，暂时不能删除')
    }
    if (material.aiStatus === 'QUEUED' || material.aiStatus === 'ANALYZING') {
      throw new BadRequestException('AI 正在识别素材，暂时不能删除')
    }

    const linkedProjects = await this.prisma.videoAssemblyScene.findMany({
      where: { selectedClip: { materialId: id } },
      select: { projectId: true },
      distinct: ['projectId'],
    })
    const linkedProjectIds = [...new Set([
      ...linkedProjects.map((item) => item.projectId),
      ...material.assemblyProjectSources.map((item) => item.projectId),
    ])]
    await this.prisma.$transaction(async (transaction) => {
      await transaction.videoMaterial.delete({ where: { id } })
      if (linkedProjectIds.length) {
        await transaction.videoAssemblyProject.updateMany({
          where: { id: { in: linkedProjectIds } },
          data: {
            status: 'FAILED',
            progress: 0,
            stage: '来源素材已删除，请重新选择并匹配',
            errorMessage: '项目使用或限定的部分来源视频已从素材库删除，系统不会自动改用其他视频。',
            completedAt: null,
          },
        })
      }
    })
    await Promise.all([
      this.safeUnlink(material.sourcePath),
      ...material.clips.flatMap((clip) => [
        this.safeUnlink(join(this.clipDirectory, clip.clipFileName)),
        this.safeUnlink(join(this.keyframeDirectory, clip.keyframeFileName)),
      ]),
    ])
    return { id }
  }

  async confirmAiClips(id: number, payload: ConfirmVideoMaterialClipsDto) {
    const material = await this.prisma.videoMaterial.findUnique({ where: { id } })
    if (!material) throw new NotFoundException('视频素材不存在')
    if (material.aiStatus !== 'COMPLETED') {
      throw new BadRequestException('请先完成 AI 智能分类')
    }

    const threshold = payload.threshold ?? 0.75
    const result = await this.prisma.videoMaterialClip.updateMany({
      where: {
        materialId: id,
        reviewStatus: { not: 'CONFIRMED' },
        confidence: { gte: threshold },
        shotType: { notIn: ['UNCLASSIFIED', 'OTHER', 'TRANSITION'] },
        contentType: { notIn: ['UNCLASSIFIED', 'OTHER'] },
      },
      data: { reviewStatus: 'CONFIRMED' },
    })
    await this.prisma.videoMaterial.update({
      where: { id },
      data: {
        aiStage: result.count
          ? `已批量确认 ${result.count} 个高置信度镜头`
          : '没有符合条件的高置信度镜头',
      },
    })
    return { confirmedCount: result.count, threshold }
  }

  async updateClip(id: number, payload: UpdateVideoMaterialClipDto) {
    const clip = await this.prisma.videoMaterialClip.findUnique({
      where: { id },
      include: { material: true },
    })
    if (!clip) throw new NotFoundException('视频片段不存在')

    if (payload.contentType) {
      const allowedTypes = this.getContentTypeValues(clip.material.productCategory)
      if (!allowedTypes.includes(payload.contentType)) {
        throw new BadRequestException('该分类不属于当前产品素材库')
      }
    }
    if (payload.shotType && !this.getShotTypeValues().includes(payload.shotType)) {
      throw new BadRequestException('该画面类型不在素材库分类中')
    }

    const updated = await this.prisma.videoMaterialClip.update({
      where: { id },
      data: {
        ...(payload.shotType !== undefined ? { shotType: payload.shotType } : {}),
        ...(payload.contentType !== undefined ? { contentType: payload.contentType } : {}),
        ...(payload.description !== undefined ? { description: payload.description.trim() } : {}),
        ...(payload.tags !== undefined
          ? { tags: this.cleanTags(payload.tags) as Prisma.InputJsonValue }
          : {}),
        ...(payload.contentTopics !== undefined
          ? { contentTopics: this.cleanTags(payload.contentTopics) as Prisma.InputJsonValue }
          : {}),
        ...(payload.actions !== undefined
          ? { actions: this.cleanTags(payload.actions) as Prisma.InputJsonValue }
          : {}),
        ...(payload.objects !== undefined
          ? { objects: this.cleanTags(payload.objects) as Prisma.InputJsonValue }
          : {}),
        ...(payload.scenes !== undefined
          ? { scenes: this.cleanTags(payload.scenes) as Prisma.InputJsonValue }
          : {}),
        ...(payload.brands !== undefined
          ? { brands: this.cleanTags(payload.brands) as Prisma.InputJsonValue }
          : {}),
        ...(payload.qualityFlags !== undefined
          ? { qualityFlags: this.cleanTags(payload.qualityFlags) as Prisma.InputJsonValue }
          : {}),
        ...(payload.qualityScore !== undefined ? { qualityScore: payload.qualityScore } : {}),
        ...(payload.usabilityScore !== undefined ? { usabilityScore: payload.usabilityScore } : {}),
        ...(payload.hasPerson !== undefined ? { hasPerson: payload.hasPerson } : {}),
        ...(payload.hasTextOverlay !== undefined ? { hasTextOverlay: payload.hasTextOverlay } : {}),
        ...(payload.reviewStatus !== undefined ? { reviewStatus: payload.reviewStatus } : {}),
      },
    })

    if (clip.material.aiStatus === 'COMPLETED') {
      const needsReviewCount = await this.prisma.videoMaterialClip.count({
        where: {
          materialId: clip.materialId,
          reviewStatus: 'NEEDS_REVIEW',
        },
      })
      await this.prisma.videoMaterial.update({
        where: { id: clip.materialId },
        data: {
          aiStage: needsReviewCount > 0
            ? `智能分类完成，${needsReviewCount} 段建议重点复核`
            : '智能分类完成，等待人工确认',
        },
      })
    }

    return this.toClipView(updated)
  }

  resolveStoredFile(kind: string, fileName: string) {
    const directory = kind === 'sources'
      ? this.sourceDirectory
      : kind === 'clips'
        ? this.clipDirectory
        : kind === 'keyframes'
          ? this.keyframeDirectory
          : null
    if (!directory || basename(fileName) !== fileName) {
      throw new NotFoundException('视频文件不存在')
    }

    const filePath = join(directory, fileName)
    try {
      accessSync(filePath, constants.R_OK)
    } catch {
      throw new NotFoundException('视频文件不存在')
    }

    return {
      path: filePath,
      contentType: kind === 'keyframes'
        ? 'image/jpeg'
        : this.videoContentType(extname(fileName).toLowerCase()),
    }
  }

  private scheduleQueue() {
    if (this.queuePromise) return
    this.queuePromise = this.drainQueue()
      .catch((error) => console.error('[VideoMaterials] Processing queue stopped', error))
      .finally(() => {
        this.queuePromise = null
        void this.restartQueueIfNeeded()
      })
  }

  private async restartQueueIfNeeded() {
    const pending = await this.prisma.videoMaterial.findFirst({
      where: { status: 'QUEUED' },
      select: { id: true },
    })
    if (pending) this.scheduleQueue()
  }

  private async drainQueue() {
    while (true) {
      const material = await this.prisma.videoMaterial.findFirst({
        where: { status: 'QUEUED' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
      if (!material) return
      await this.processMaterial(material)
    }
  }

  private scheduleAiQueue() {
    if (this.aiQueuePromise) return
    this.aiQueuePromise = this.drainAiQueue()
      .catch((error) => console.error('[VideoMaterials] AI queue stopped', error))
      .finally(() => {
        this.aiQueuePromise = null
        void this.restartAiQueueIfNeeded()
      })
  }

  private async restartAiQueueIfNeeded() {
    const pending = await this.prisma.videoMaterial.findFirst({
      where: { aiStatus: 'QUEUED' },
      select: { id: true },
    })
    if (pending) this.scheduleAiQueue()
  }

  private async drainAiQueue() {
    while (true) {
      const material = await this.prisma.videoMaterial.findFirst({
        where: { aiStatus: 'QUEUED' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
      if (!material) return
      await this.processAiMaterial(material)
    }
  }

  private async processAiMaterial(material: VideoMaterial) {
    const config = this.materialAi.configuration()
    const tempDirectory = await mkdtemp(join(tmpdir(), `data-aurora-video-ai-${material.id}-`))
    const usage: VideoMaterialAiUsage = { inputTokens: 0, outputTokens: 0, audioSeconds: 0 }
    const warnings: string[] = []

    await this.prisma.videoMaterial.update({
      where: { id: material.id },
      data: {
        aiStatus: 'ANALYZING',
        aiProgress: 2,
        aiStage: '准备镜头和音轨',
        aiErrorMessage: '',
        aiModel: config.visionModel,
        aiStartedAt: new Date(),
        aiCompletedAt: null,
      },
    })

    try {
      const current = await this.prisma.videoMaterial.findUnique({
        where: { id: material.id },
        include: {
          clips: { orderBy: { clipIndex: 'asc' } },
          transcriptSegments: { orderBy: { segmentIndex: 'asc' } },
        },
      })
      if (!current) throw new Error('视频素材不存在')
      const selectedClipIds = this.readAiSelectedClipIds(current.metadata)
      const targetClips = selectedClipIds.length
        ? current.clips.filter((clip) => selectedClipIds.includes(clip.id))
        : current.clips.filter((clip) => clip.reviewStatus !== 'CONFIRMED')
      if (!targetClips.length) throw new Error('所有镜头都已人工确认')

      let timelineSegments: TimelineSegment[] = current.transcriptSegments.map((segment) => ({
        startMs: segment.startMs,
        endMs: segment.endMs,
        text: segment.text,
        words: this.readTimelineWords(segment.words),
        chunkIndex: segment.chunkIndex,
        model: segment.model,
      }))
      let timelineAvailable = timelineSegments.length > 0
      let timelineFallback = false

      if (current.hasAudio && !timelineAvailable) {
        await this.prisma.videoMaterial.update({
          where: { id: material.id },
          data: { aiProgress: 4, aiStage: '整条语音识别并生成时间轴' },
        })
        try {
          timelineSegments = await this.createTranscriptTimeline(current, tempDirectory, usage)
          timelineAvailable = timelineSegments.length > 0
          if (timelineAvailable) {
            await this.prisma.$transaction([
              this.prisma.videoMaterialTranscriptSegment.deleteMany({
                where: { materialId: material.id },
              }),
              this.prisma.videoMaterialTranscriptSegment.createMany({
                data: timelineSegments.map((segment, index) => ({
                  materialId: material.id,
                  segmentIndex: index + 1,
                  startMs: segment.startMs,
                  endMs: segment.endMs,
                  text: segment.text,
                  words: segment.words as unknown as Prisma.InputJsonValue,
                  model: segment.model,
                  chunkIndex: segment.chunkIndex,
                })),
              }),
            ])
          }
        } catch (error) {
          timelineFallback = true
          warnings.push(`整条语音对齐降级：${error instanceof Error ? error.message : '时间轴识别失败'}`)
        }
      }

      if (timelineAvailable) {
        await this.applyTranscriptTimeline(current.clips, timelineSegments)
      }

      const clipsToTranscribe = current.hasAudio && !timelineAvailable
        ? targetClips.filter((clip) => !clip.transcript?.trim())
        : []
      const asrBatchSize = 4
      for (let offset = 0; offset < clipsToTranscribe.length; offset += asrBatchSize) {
        const batch = clipsToTranscribe.slice(offset, offset + asrBatchSize)
        const results = await Promise.all(batch.map(async (clip) => {
          const audioPath = join(tempDirectory, `${clip.id}.mp3`)
          try {
            await this.createAiAudioFile(join(this.clipDirectory, clip.clipFileName), audioPath)
            const result = await this.materialAi.transcribeAudio(audioPath)
            return { clip, transcript: result.data, usage: result.usage, error: '' }
          } catch (error) {
            return {
              clip,
              transcript: '',
              usage: { inputTokens: 0, outputTokens: 0, audioSeconds: 0 },
              error: error instanceof Error ? error.message : '语音转写失败',
            }
          } finally {
            await this.safeUnlink(audioPath)
          }
        }))

        for (const result of results) {
          if (result.error) {
            warnings.push(`镜头 ${result.clip.clipIndex}：${result.error}`)
            continue
          }
          result.clip.transcript = result.transcript
          this.addAiUsage(usage, result.usage)
          if (!result.usage.audioSeconds) usage.audioSeconds += result.clip.durationMs / 1000
          await this.prisma.videoMaterialClip.update({
            where: { id: result.clip.id },
            data: { transcript: result.transcript },
          })
        }

        const completed = Math.min(offset + batch.length, clipsToTranscribe.length)
        const progress = clipsToTranscribe.length
          ? 5 + Math.round((completed / clipsToTranscribe.length) * 45)
          : 50
        await this.prisma.videoMaterial.update({
          where: { id: material.id },
          data: {
            aiProgress: progress,
            aiStage: `语音转写 ${completed}/${clipsToTranscribe.length}`,
            aiInputTokens: usage.inputTokens,
            aiOutputTokens: usage.outputTokens,
            aiAudioSeconds: usage.audioSeconds,
          },
        })
      }

      if (!clipsToTranscribe.length) {
        await this.prisma.videoMaterial.update({
          where: { id: material.id },
          data: {
            aiProgress: 50,
            aiStage: timelineAvailable
              ? `已生成 ${timelineSegments.length} 条语音时间轴`
              : current.hasAudio
                ? '使用已有语音字幕'
                : '视频没有音轨，使用画面识别',
          },
        })
      }

      const classificationFramePaths = new Map<number, string[]>()
      const targetClipIds = new Set(targetClips.map((clip) => clip.id))
      const clipsMissingMotion = current.clips.filter((clip) => clip.motionScore === null)
      const motionBatchSize = 6
      for (let offset = 0; offset < clipsMissingMotion.length; offset += motionBatchSize) {
        const batch = clipsMissingMotion.slice(offset, offset + motionBatchSize)
        await Promise.all(batch.map(async (clip) => {
          const keyframePaths = await this.createAiClassificationFrames(
            join(this.clipDirectory, clip.clipFileName),
            join(this.keyframeDirectory, clip.keyframeFileName),
            tempDirectory,
            clip
          )
          const motionScore = await this.computeMotionScore(keyframePaths)
          clip.motionScore = motionScore
          if (targetClipIds.has(clip.id)) classificationFramePaths.set(clip.id, keyframePaths)
          await this.prisma.videoMaterialClip.update({
            where: { id: clip.id },
            data: { motionScore },
          })
        }))
        const completed = Math.min(offset + batch.length, clipsMissingMotion.length)
        await this.prisma.videoMaterial.update({
          where: { id: material.id },
          data: {
            aiProgress: 50,
            aiStage: `计算镜头动态程度 ${completed}/${clipsMissingMotion.length}`,
          },
        })
      }

      const product = PRODUCT_TAXONOMY.find((item) => item.value === current.productCategory)
      if (!product) throw new Error('找不到当前产品的素材分类配置')
      const taxonomy = product.contentTypes.map(([value, label]) => ({ value, label }))
      const shotTypes = SHOT_TAXONOMY.map(([value, label]) => ({ value, label }))
      const visionBatchSize = 6
      let needsReviewCount = 0

      for (let offset = 0; offset < targetClips.length; offset += visionBatchSize) {
        const batch = targetClips.slice(offset, offset + visionBatchSize)
        const batchWithFrames = await Promise.all(batch.map(async (clip) => ({
          clip,
          keyframePaths: classificationFramePaths.get(clip.id)
            || await this.createAiClassificationFrames(
              join(this.clipDirectory, clip.clipFileName),
              join(this.keyframeDirectory, clip.keyframeFileName),
              tempDirectory,
              clip
            ),
        })))
        const classification = await this.materialAi.classifyClips(
          batchWithFrames.map(({ clip, keyframePaths }) => ({
            clipIndex: clip.clipIndex,
            startMs: clip.startMs,
            endMs: clip.endMs,
            keyframePaths,
            transcript: clip.transcript?.trim() || '',
            transcriptContext: clip.transcriptContext?.trim() || clip.transcript?.trim() || '',
          })),
          product.label,
          taxonomy,
          shotTypes,
          {
            totalClips: current.clips.length,
            durationMs: current.durationMs,
            brandAliases: product.brandAliases.map((item) => ({
              canonical: item.canonical,
              aliases: [...item.aliases],
            })),
          }
        )
        this.addAiUsage(usage, classification.usage)

        for (const result of classification.data) {
          const clip = batch.find((item) => item.clipIndex === result.clipIndex)
          if (!clip) continue
          const needsReview = result.confidence < 0.7
            || result.shotType === 'UNCLASSIFIED'
            || result.shotType === 'OTHER'
            || result.contentType === 'UNCLASSIFIED'
            || result.contentType === 'OTHER'
          if (needsReview) needsReviewCount += 1
          await this.prisma.videoMaterialClip.update({
            where: { id: clip.id },
            data: {
              shotType: result.shotType,
              contentType: result.contentType,
              contentTopics: result.contentTopics as Prisma.InputJsonValue,
              description: result.description,
              tags: result.tags as Prisma.InputJsonValue,
              actions: result.actions as Prisma.InputJsonValue,
              objects: result.objects as Prisma.InputJsonValue,
              scenes: result.scenes as Prisma.InputJsonValue,
              brands: result.brands as Prisma.InputJsonValue,
              qualityFlags: result.qualityFlags as Prisma.InputJsonValue,
              qualityScore: result.qualityScore,
              usabilityScore: result.usabilityScore,
              hasPerson: result.hasPerson,
              hasTextOverlay: result.hasTextOverlay,
              confidence: result.confidence,
              aiModel: config.visionModel,
              analyzedAt: new Date(),
              reviewStatus: needsReview ? 'NEEDS_REVIEW' : 'PENDING',
            },
          })
        }

        const completed = Math.min(offset + batch.length, targetClips.length)
        const progress = 52 + Math.round((completed / targetClips.length) * 46)
        await this.prisma.videoMaterial.update({
          where: { id: material.id },
          data: {
            aiProgress: progress,
            aiStage: `理解画面并分类 ${completed}/${targetClips.length}`,
            aiInputTokens: usage.inputTokens,
            aiOutputTokens: usage.outputTokens,
              aiAudioSeconds: usage.audioSeconds,
          },
        })
      }

      const warningMessage = warnings.length
        ? warnings.slice(0, 4).join('；').slice(0, 1900)
        : ''
      const currentMetadata = this.readJsonObject(current.metadata)
      const { aiSelection: _completedSelection, ...metadataWithoutSelection } = currentMetadata
      await this.prisma.videoMaterial.update({
        where: { id: material.id },
        data: {
          aiStatus: 'COMPLETED',
          aiProgress: 100,
          aiStage: needsReviewCount
            ? `智能分类完成，${needsReviewCount} 段建议重点复核`
            : '智能分类完成',
          aiErrorMessage: warningMessage,
          aiInputTokens: usage.inputTokens,
          aiOutputTokens: usage.outputTokens,
          aiAudioSeconds: usage.audioSeconds,
          aiCompletedAt: new Date(),
          metadata: {
            ...metadataWithoutSelection,
            lastAiAnalysis: {
              completedAt: new Date().toISOString(),
              clipCount: targetClips.length,
              warningCount: warnings.length,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              audioSeconds: usage.audioSeconds,
              timelineSegmentCount: timelineSegments.length,
              timelineFallback,
              visionClipCount: targetClips.length,
            },
          } as Prisma.InputJsonValue,
        },
      })
    } catch (error) {
      await this.prisma.videoMaterial.update({
        where: { id: material.id },
        data: {
          aiStatus: 'FAILED',
          aiStage: '智能分类失败',
          aiErrorMessage: error instanceof Error ? error.message.slice(0, 2000) : 'AI 智能分类失败',
          aiCompletedAt: new Date(),
          aiInputTokens: usage.inputTokens,
          aiOutputTokens: usage.outputTokens,
          aiAudioSeconds: usage.audioSeconds,
        },
      })
    } finally {
      await rm(tempDirectory, { recursive: true, force: true }).catch(() => undefined)
    }
  }

  private async processMaterial(material: VideoMaterial) {
    const current = await this.prisma.videoMaterial.findUnique({
      where: { id: material.id },
      include: {
        clips: { orderBy: { clipIndex: 'asc' } },
        transcriptSegments: { orderBy: { segmentIndex: 'asc' } },
      },
    })
    if (!current) return
    const timelineSegments: TimelineSegment[] = current.transcriptSegments.map((segment) => ({
      startMs: segment.startMs,
      endMs: segment.endMs,
      text: segment.text,
      words: this.readTimelineWords(segment.words),
      chunkIndex: segment.chunkIndex,
      model: segment.model,
    }))
    const reusableTranscripts = timelineSegments.length
      ? []
      : this.readReusableTranscripts(current.metadata)
    const existingClips = current.clips
    const hadExistingResults = existingClips.length > 0
    const runKey = randomUUID().replace(/-/g, '').slice(0, 10)
    const tempDirectory = await mkdtemp(join(tmpdir(), `data-aurora-video-split-${material.id}-`))
    const createdStoragePaths: string[] = []

    await this.prisma.videoMaterial.update({
      where: { id: material.id },
      data: {
        status: 'PROCESSING',
        progress: 2,
        stage: '读取视频信息',
        errorMessage: '',
        processingStartedAt: new Date(),
        completedAt: hadExistingResults ? current.completedAt : null,
      },
    })

    try {
      const probe = await this.probeVideo(current.sourcePath)
      if (probe.durationMs <= 0 || probe.width <= 0 || probe.height <= 0) {
        throw new Error('无法读取视频时长或画面尺寸，请确认文件可以正常播放')
      }

      await this.prisma.videoMaterial.update({
        where: { id: material.id },
        data: {
          durationMs: probe.durationMs,
          width: probe.width,
          height: probe.height,
          fps: probe.fps,
          videoCodec: probe.videoCodec,
          audioCodec: probe.audioCodec,
          hasAudio: probe.hasAudio,
          metadata: probe.raw as Prisma.InputJsonValue,
          progress: 12,
          stage: '识别镜头变化',
        },
      })

      const sceneTimes = await this.detectSceneChanges(current.sourcePath, current.sceneThreshold)
      const { segments, diagnostics } = planVideoSegments({
        durationMs: probe.durationMs,
        sceneTimes,
        minDurationMs: current.minClipDurationMs,
        maxDurationMs: current.maxClipDurationMs,
      })
      if (segments.length === 0) throw new Error('没有识别到可用视频片段')
      if (segments.length > 500) {
        throw new Error('识别出的片段超过 500 个，请调低拆片灵敏度后重试')
      }

      await this.prisma.videoMaterial.update({
        where: { id: material.id },
        data: {
          metadata: {
            ...probe.raw,
            segmentation: diagnostics,
          } as Prisma.InputJsonValue,
          progress: 16,
          stage: `规划 ${segments.length} 个可用片段`,
        },
      })

      const artifacts: Array<{
        data: Prisma.VideoMaterialClipCreateManyInput
        tempClipPath: string
        tempKeyframePath: string
        finalClipPath: string
        finalKeyframePath: string
      }> = []

      for (let index = 0; index < segments.length; index += 1) {
        const segment = segments[index]
        const speech = timelineSegments.length
          ? this.mapTranscriptToClip(segment, timelineSegments)
          : null
        const clipIndex = index + 1
        const paddedIndex = String(clipIndex).padStart(4, '0')
        const clipFileName = `${material.id}-${runKey}-${paddedIndex}.mp4`
        const keyframeFileName = `${material.id}-${runKey}-${paddedIndex}.jpg`
        const tempClipPath = join(tempDirectory, `clip-${paddedIndex}.mp4`)
        const tempKeyframePath = join(tempDirectory, `keyframe-${paddedIndex}.jpg`)
        const progress = 18 + Math.round(((index + 1) / segments.length) * 76)

        await this.prisma.videoMaterial.update({
          where: { id: material.id },
          data: {
            progress,
            stage: `生成片段 ${clipIndex}/${segments.length}`,
          },
        })

        await this.createClipFile(current.sourcePath, tempClipPath, segment)
        await this.createKeyframe(current.sourcePath, tempKeyframePath, segment)
        artifacts.push({
          tempClipPath,
          tempKeyframePath,
          finalClipPath: join(this.clipDirectory, clipFileName),
          finalKeyframePath: join(this.keyframeDirectory, keyframeFileName),
          data: {
            materialId: material.id,
            clipIndex,
            startMs: segment.startMs,
            endMs: segment.endMs,
            durationMs: segment.endMs - segment.startMs,
            clipFileName,
            keyframeFileName,
            shotType: 'UNCLASSIFIED',
            contentType: 'UNCLASSIFIED',
            contentTopics: [] as Prisma.InputJsonValue,
            description: '',
            tags: [] as Prisma.InputJsonValue,
            actions: [] as Prisma.InputJsonValue,
            objects: [] as Prisma.InputJsonValue,
            scenes: [] as Prisma.InputJsonValue,
            brands: [] as Prisma.InputJsonValue,
            qualityFlags: [] as Prisma.InputJsonValue,
            transcript: speech?.transcript
              || this.combineReusableTranscripts(segment, reusableTranscripts)
              || null,
            transcriptContext: speech?.transcriptContext || '',
            speechBoundaryStatus: speech?.speechBoundaryStatus || 'UNKNOWN',
            reviewStatus: 'PENDING',
          },
        })
      }

      await this.prisma.videoMaterial.update({
        where: { id: material.id },
        data: { progress: 95, stage: '校验新片段，原结果仍保留' },
      })

      for (const artifact of artifacts) {
        await this.moveFile(artifact.tempClipPath, artifact.finalClipPath)
        createdStoragePaths.push(artifact.finalClipPath)
        await this.moveFile(artifact.tempKeyframePath, artifact.finalKeyframePath)
        createdStoragePaths.push(artifact.finalKeyframePath)
      }

      const linkedProjects = existingClips.length
        ? await this.prisma.videoAssemblyScene.findMany({
          where: { selectedClip: { materialId: material.id } },
          select: { projectId: true },
          distinct: ['projectId'],
        })
        : []
      const linkedProjectIds = linkedProjects.map((item) => item.projectId)

      await this.prisma.$transaction(async (transaction) => {
        await transaction.videoMaterialClip.deleteMany({ where: { materialId: material.id } })
        await transaction.videoMaterialClip.createMany({
          data: artifacts.map((artifact) => artifact.data),
        })
        await transaction.videoMaterial.update({
          where: { id: material.id },
          data: {
            durationMs: probe.durationMs,
            width: probe.width,
            height: probe.height,
            fps: probe.fps,
            videoCodec: probe.videoCodec,
            audioCodec: probe.audioCodec,
            hasAudio: probe.hasAudio,
            metadata: {
              ...probe.raw,
              segmentation: diagnostics,
              lastReprocess: {
                completedAt: new Date().toISOString(),
                previousClipCount: existingClips.length,
                outputClipCount: segments.length,
                linkedProjectCount: linkedProjectIds.length,
              },
            } as Prisma.InputJsonValue,
            status: 'READY',
            progress: 100,
            stage: `拆片完成：${diagnostics.detectedSceneCount} 个转场，整理为 ${segments.length} 段`,
            errorMessage: '',
            clipCount: segments.length,
            aiStatus: 'NOT_STARTED',
            aiProgress: 0,
            aiStage: '',
            aiErrorMessage: '',
            aiModel: '',
            aiInputTokens: 0,
            aiOutputTokens: 0,
            aiAudioSeconds: 0,
            aiStartedAt: null,
            aiCompletedAt: null,
            completedAt: new Date(),
          },
        })
        if (linkedProjectIds.length) {
          await transaction.videoAssemblyProject.updateMany({
            where: { id: { in: linkedProjectIds } },
            data: {
              status: 'FAILED',
              progress: 0,
              stage: '素材已重新拆片，请重新匹配画面',
              errorMessage: '原来使用的镜头已更新，旧成片仍可下载；再次合成前请重新匹配。',
              completedAt: null,
            },
          })
        }
      })

      await Promise.all(existingClips.flatMap((clip) => [
        this.safeUnlink(join(this.clipDirectory, clip.clipFileName)),
        this.safeUnlink(join(this.keyframeDirectory, clip.keyframeFileName)),
      ]))
    } catch (error) {
      await Promise.all(createdStoragePaths.map((filePath) => this.safeUnlink(filePath)))
      await this.prisma.videoMaterial.update({
        where: { id: material.id },
        data: {
          status: hadExistingResults ? 'READY' : 'FAILED',
          progress: hadExistingResults ? 100 : 0,
          stage: hadExistingResults ? '重新拆片失败，已保留原结果' : '处理失败',
          errorMessage: error instanceof Error ? error.message : '视频处理失败',
          clipCount: existingClips.length,
          metadata: current.metadata as Prisma.InputJsonValue,
          completedAt: hadExistingResults ? current.completedAt : new Date(),
        },
      })
    } finally {
      await rm(tempDirectory, { recursive: true, force: true }).catch(() => undefined)
    }
  }

  private async probeVideo(inputPath: string): Promise<VideoProbe> {
    const output = await this.runProcess(this.ffprobePath, [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      inputPath,
    ])
    const raw = JSON.parse(output.stdout || '{}') as Record<string, any>
    const streams = Array.isArray(raw.streams) ? raw.streams : []
    const videoStream = streams.find((stream: any) => stream.codec_type === 'video') || {}
    const audioStream = streams.find((stream: any) => stream.codec_type === 'audio') || null
    const durationSeconds = Number(raw.format?.duration || videoStream.duration || 0)

    return {
      durationMs: Math.max(0, Math.round(durationSeconds * 1000)),
      width: Number(videoStream.width || 0),
      height: Number(videoStream.height || 0),
      fps: this.parseFrameRate(videoStream.avg_frame_rate || videoStream.r_frame_rate),
      videoCodec: String(videoStream.codec_name || ''),
      audioCodec: String(audioStream?.codec_name || ''),
      hasAudio: Boolean(audioStream),
      raw,
    }
  }

  private async detectSceneChanges(inputPath: string, threshold: number) {
    const filter = `select=gt(scene\\,${threshold.toFixed(3)}),showinfo`
    const output = await this.runProcess(this.ffmpegPath, [
      '-hide_banner',
      '-i', inputPath,
      '-filter:v', filter,
      '-an',
      '-f', 'null',
      '-',
    ])
    const times: number[] = []
    for (const match of output.stderr.matchAll(/pts_time:([0-9]+(?:\.[0-9]+)?)/g)) {
      const seconds = Number(match[1])
      if (Number.isFinite(seconds) && seconds > 0) times.push(Math.round(seconds * 1000))
    }
    return [...new Set(times)].sort((a, b) => a - b)
  }

  private async createClipFile(inputPath: string, outputPath: string, segment: ClipSegment) {
    const startSeconds = (segment.startMs / 1000).toFixed(3)
    const durationSeconds = ((segment.endMs - segment.startMs) / 1000).toFixed(3)
    await this.runProcess(this.ffmpegPath, [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-ss', startSeconds,
      '-i', inputPath,
      '-t', durationSeconds,
      '-map', '0:v:0',
      '-map', '0:a:0?',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '160k',
      '-movflags', '+faststart',
      '-avoid_negative_ts', 'make_zero',
      outputPath,
    ])
  }

  private async createAiAudioFile(inputPath: string, outputPath: string) {
    await this.runProcess(this.ffmpegPath, [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-i', inputPath,
      '-vn',
      '-ac', '1',
      '-ar', '16000',
      '-b:a', '32k',
      '-f', 'mp3',
      outputPath,
    ])
  }

  private addAiUsage(target: VideoMaterialAiUsage, usage: VideoMaterialAiUsage) {
    target.inputTokens += usage.inputTokens
    target.outputTokens += usage.outputTokens
    target.audioSeconds += usage.audioSeconds
  }

  private async createTranscriptTimeline(
    material: VideoMaterial,
    tempDirectory: string,
    usage: VideoMaterialAiUsage
  ): Promise<TimelineSegment[]> {
    const silenceTimes = await this.detectAudioSilences(material.sourcePath).catch(() => [])
    const chunks = this.planAudioChunks(material.durationMs, silenceTimes)
    const product = PRODUCT_TAXONOMY.find((item) => item.value === material.productCategory)
    const vocabulary = [
      product?.label || '',
      ...(product?.brandAliases.flatMap((entry) => [entry.canonical, ...entry.aliases]) || []),
      'UPF', 'UVA', 'UVB', '防晒衣', '原纱', '凉感', '耐水洗',
    ]
    const rows: TimelineSegment[] = []

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index]
      const audioPath = join(tempDirectory, `timeline-${String(index + 1).padStart(3, '0')}.mp3`)
      await this.createAiTimelineAudio(material.sourcePath, audioPath, chunk)
      try {
        const result = await this.materialAi.transcribeAudioTimeline(audioPath, index + 1, vocabulary)
        this.addAiUsage(usage, result.usage)
        if (!result.usage.audioSeconds) usage.audioSeconds += (chunk.endMs - chunk.startMs) / 1000
        rows.push(...result.data.map((segment) => ({
          ...segment,
          startMs: chunk.startMs + segment.startMs,
          endMs: Math.min(material.durationMs, chunk.startMs + segment.endMs),
          words: segment.words.map((word) => ({
            ...word,
            startMs: chunk.startMs + word.startMs,
            endMs: Math.min(material.durationMs, chunk.startMs + word.endMs),
          })),
          model: this.materialAi.configuration().timelineAsrModel,
        })))
      } finally {
        await this.safeUnlink(audioPath)
      }
      await this.prisma.videoMaterial.update({
        where: { id: material.id },
        data: {
          aiProgress: 5 + Math.round(((index + 1) / chunks.length) * 35),
          aiStage: `整条语音识别 ${index + 1}/${chunks.length}`,
          aiInputTokens: usage.inputTokens,
          aiOutputTokens: usage.outputTokens,
          aiAudioSeconds: usage.audioSeconds,
        },
      })
    }

    return this.mergeTimelineSegments(rows)
  }

  private async detectAudioSilences(inputPath: string) {
    const output = await this.runProcess(this.ffmpegPath, [
      '-hide_banner', '-loglevel', 'info', '-i', inputPath,
      '-af', 'silencedetect=noise=-35dB:d=0.35',
      '-f', 'null', '-',
    ])
    return [...output.stderr.matchAll(/silence_end:\s*([0-9]+(?:\.[0-9]+)?)/g)]
      .map((match) => Math.round(Number(match[1]) * 1000))
      .filter((value) => Number.isFinite(value))
  }

  private planAudioChunks(durationMs: number, silenceTimes: number[]) {
    const targetDurationMs = 240_000
    const overlapMs = 2_000
    const chunks: ClipSegment[] = []
    let startMs = 0
    while (startMs < durationMs) {
      const desiredEnd = Math.min(durationMs, startMs + targetDurationMs)
      if (desiredEnd >= durationMs) {
        chunks.push({ startMs, endMs: durationMs })
        break
      }
      const candidates = silenceTimes.filter((time) => (
        time > startMs + 30_000 && Math.abs(time - desiredEnd) <= 15_000
      ))
      const endMs = candidates.sort(
        (left, right) => Math.abs(left - desiredEnd) - Math.abs(right - desiredEnd)
      )[0] || desiredEnd
      chunks.push({ startMs, endMs })
      startMs = Math.max(startMs + 1, endMs - overlapMs)
    }
    return chunks
  }

  private async createAiTimelineAudio(
    inputPath: string,
    outputPath: string,
    segment: ClipSegment
  ) {
    await this.runProcess(this.ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-ss', (segment.startMs / 1000).toFixed(3),
      '-i', inputPath,
      '-t', ((segment.endMs - segment.startMs) / 1000).toFixed(3),
      '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k',
      outputPath,
    ])
  }

  private mergeTimelineSegments(rows: TimelineSegment[]) {
    const merged: TimelineSegment[] = []
    for (const rawRow of rows
      .filter((item) => item.text.trim() && item.endMs > item.startMs)
      .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs)) {
      const row = this.trimTimelineChunkOverlap(rawRow, merged)
      if (!row) continue
      const duplicateIndex = merged.findIndex((item) => {
        const overlaps = Math.min(item.endMs, row.endMs) - Math.max(item.startMs, row.startMs) > -2500
        return overlaps && this.textSimilarity(item.text, row.text) >= 0.68
      })
      if (duplicateIndex < 0) {
        merged.push(row)
        continue
      }
      const existing = merged[duplicateIndex]
      if (row.text.length > existing.text.length) merged[duplicateIndex] = row
    }
    return merged.sort((left, right) => left.startMs - right.startMs)
  }

  private trimTimelineChunkOverlap(row: TimelineSegment, merged: TimelineSegment[]) {
    const normalize = (value: string) => value
      .toLowerCase()
      .replace(/[\s，。；、！？,:;.!?()（）【】\[\]<>《》]/g, '')
    const rowText = normalize(row.text)
    if (rowText.length < 6) return row

    let bestOverlap = 0
    for (const existing of merged) {
      if (row.startMs > existing.endMs + 2500 || row.startMs < existing.startMs) continue
      const existingText = normalize(existing.text)
      const maximum = Math.min(existingText.length, rowText.length)
      for (let length = maximum; length >= 6; length -= 1) {
        if (existingText.endsWith(rowText.slice(0, length))) {
          bestOverlap = Math.max(bestOverlap, length)
          break
        }
      }
    }
    if (bestOverlap < 6) return row
    if (bestOverlap >= rowText.length - 1) return null

    let consumed = 0
    let firstRemainingWord = 0
    for (; firstRemainingWord < row.words.length; firstRemainingWord += 1) {
      const word = row.words[firstRemainingWord]
      consumed += normalize(`${word.text}${word.punctuation}`).length
      if (consumed >= bestOverlap) {
        firstRemainingWord += 1
        break
      }
    }
    const words = row.words.slice(firstRemainingWord)
    if (!words.length) return row
    const text = words
      .map((word) => `${word.text}${word.punctuation}`)
      .join('')
      .replace(/^\s*[,，。；、！？:;.!?]+\s*/, '')
      .replace(/\s+([,.;!?，。；！？])/g, '$1')
      .trim()
    if (normalize(text).length < 2) return null
    return {
      ...row,
      startMs: words[0].startMs,
      text,
      words,
    }
  }

  private textSimilarity(left: string, right: string) {
    const normalize = (value: string) => value
      .toLowerCase()
      .replace(/[\s，。；、！？,:;.!?()（）【】\[\]<>《》]/g, '')
    const a = normalize(left)
    const b = normalize(right)
    if (!a || !b) return 0
    if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length)
    const grams = (value: string) => new Set(
      Array.from({ length: Math.max(0, value.length - 1) }, (_, index) => value.slice(index, index + 2))
    )
    const aGrams = grams(a)
    const bGrams = grams(b)
    if (!aGrams.size || !bGrams.size) return a === b ? 1 : 0
    const intersection = [...aGrams].filter((value) => bGrams.has(value)).length
    return (2 * intersection) / (aGrams.size + bGrams.size)
  }

  private async applyTranscriptTimeline(
    clips: VideoMaterialClip[],
    segments: TimelineSegment[]
  ) {
    const updates = clips.map((clip) => {
      const { transcript, transcriptContext, speechBoundaryStatus } = this.mapTranscriptToClip(
        clip,
        segments
      )
      clip.transcript = transcript || null
      clip.transcriptContext = transcriptContext
      clip.speechBoundaryStatus = speechBoundaryStatus
      return this.prisma.videoMaterialClip.update({
        where: { id: clip.id },
        data: { transcript: transcript || null, transcriptContext, speechBoundaryStatus },
      })
    })
    if (updates.length) await this.prisma.$transaction(updates)
  }

  private mapTranscriptToClip(segment: ClipSegment, segments: TimelineSegment[]) {
    const directIndexes = segments.flatMap((item, index) => (
      item.startMs < segment.endMs && item.endMs > segment.startMs ? [index] : []
    ))
    const primary = segments.filter((item) => {
      const midpoint = item.startMs + (item.endMs - item.startMs) / 2
      return midpoint >= segment.startMs && midpoint < segment.endMs
    })
    const contextIndexes = new Set<number>()
    for (const index of directIndexes) {
      if (index > 0) contextIndexes.add(index - 1)
      contextIndexes.add(index)
      if (index < segments.length - 1) contextIndexes.add(index + 1)
    }
    const crossesStart = directIndexes.some((index) => (
      segments[index].startMs < segment.startMs && segments[index].endMs > segment.startMs
    ))
    const crossesEnd = directIndexes.some((index) => (
      segments[index].startMs < segment.endMs && segments[index].endMs > segment.endMs
    ))
    const speechBoundaryStatus = !directIndexes.length
      ? 'NO_SPEECH'
      : crossesStart && crossesEnd
        ? 'CROSSES_BOTH'
        : crossesStart
          ? 'CROSSES_START'
          : crossesEnd
            ? 'CROSSES_END'
            : 'CLEAN'
    const transcript = (primary.length ? primary : directIndexes.map((index) => segments[index]))
      .map((item) => item.text)
      .join(' ')
      .trim()
    const transcriptContext = [...contextIndexes]
      .sort((left, right) => left - right)
      .map((index) => segments[index].text)
      .join(' ')
      .trim()
    return { transcript, transcriptContext, speechBoundaryStatus }
  }

  private readTimelineWords(value: Prisma.JsonValue | null) {
    if (!Array.isArray(value)) return []
    return value.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return []
      const word = item as Record<string, Prisma.JsonValue>
      return [{
        startMs: Number(word.startMs || 0),
        endMs: Number(word.endMs || 0),
        text: String(word.text || ''),
        punctuation: String(word.punctuation || ''),
      }]
    })
  }

  private async computeMotionScore(paths: string[]) {
    if (paths.length < 2) return 0
    const buffers = await Promise.all(paths.map((path) => (
      sharp(path).resize(64, 64, { fit: 'fill' }).greyscale().raw().toBuffer()
    )))
    let difference = 0
    let comparisons = 0
    for (let index = 1; index < buffers.length; index += 1) {
      const left = buffers[index - 1]
      const right = buffers[index]
      const length = Math.min(left.length, right.length)
      for (let offset = 0; offset < length; offset += 1) {
        difference += Math.abs(left[offset] - right[offset]) / 255
      }
      comparisons += length
    }
    const average = comparisons ? difference / comparisons : 0
    return Math.round(Math.max(0, Math.min(1, (average - 0.008) / 0.16)) * 1000) / 1000
  }

  private async createKeyframe(inputPath: string, outputPath: string, segment: ClipSegment) {
    const midpointSeconds = ((segment.startMs + (segment.endMs - segment.startMs) / 2) / 1000).toFixed(3)
    await this.createKeyframeAt(inputPath, outputPath, midpointSeconds)
  }

  private async createKeyframeAt(inputPath: string, outputPath: string, seconds: string) {
    await this.runProcess(this.ffmpegPath, [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-ss', seconds,
      '-i', inputPath,
      '-frames:v', '1',
      '-vf', 'scale=960:-2:force_original_aspect_ratio=decrease',
      '-q:v', '2',
      outputPath,
    ])
  }

  private async createAiClassificationFrames(
    clipPath: string,
    midpointPath: string,
    tempDirectory: string,
    clip: VideoMaterialClip
  ) {
    const firstPath = join(tempDirectory, `${clip.id}-first.jpg`)
    const lastPath = join(tempDirectory, `${clip.id}-last.jpg`)
    const durationSeconds = clip.durationMs / 1000
    await Promise.all([
      this.createKeyframeAt(clipPath, firstPath, Math.max(0.1, durationSeconds * 0.18).toFixed(3)),
      this.createKeyframeAt(clipPath, lastPath, Math.max(0.2, durationSeconds * 0.82).toFixed(3)),
    ])
    return [firstPath, midpointPath, lastPath]
  }

  private runProcess(command: string, args: string[], timeoutMs = 30 * 60 * 1000) {
    return new Promise<{ stdout: string; stderr: string }>((resolvePromise, reject) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''
      let settled = false
      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        child.kill('SIGKILL')
        reject(new Error(`${basename(command)} 执行超过 ${Math.round(timeoutMs / 1000)} 秒，已停止`))
      }, timeoutMs)
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => { stdout += chunk })
      child.stderr.on('data', (chunk: string) => { stderr += chunk })
      child.once('error', (error) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        reject(error)
      })
      child.once('close', (code) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        if (code === 0) {
          resolvePromise({ stdout, stderr })
          return
        }
        const detail = stderr.trim().split('\n').slice(-6).join(' ')
        reject(new Error(detail || `${basename(command)} 执行失败（${code ?? 'unknown'}）`))
      })
    })
  }

  private async findMaterialRecord(id: number) {
    const material = await this.prisma.videoMaterial.findUnique({ where: { id } })
    if (!material) throw new NotFoundException('视频素材不存在')
    return material
  }

  private async moveFile(sourcePath: string, destinationPath: string) {
    try {
      await rename(sourcePath, destinationPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error
      await copyFile(sourcePath, destinationPath)
      await unlink(sourcePath)
    }
  }

  private async safeUnlink(filePath: string) {
    if (!filePath) return
    await rm(filePath, { force: true }).catch(() => undefined)
  }

  private ensureFfmpegAvailable() {
    for (const binary of [this.ffmpegPath, this.ffprobePath]) {
      if (binary.includes('/') && !existsSync(binary)) {
        throw new BadRequestException(`本机缺少 ${basename(binary)}，请先完成 FFmpeg 安装`)
      }
    }
  }

  private resolveBinary(envName: string, command: string) {
    const configured = process.env[envName]?.trim()
    if (configured) return configured
    for (const candidate of [`/opt/homebrew/bin/${command}`, `/usr/local/bin/${command}`]) {
      if (existsSync(candidate)) return candidate
    }
    return command
  }

  private parseFrameRate(value: unknown) {
    const text = String(value || '')
    if (!text.includes('/')) return Number(text) || 0
    const [numerator, denominator] = text.split('/').map(Number)
    return denominator ? Math.round((numerator / denominator) * 1000) / 1000 : 0
  }

  private normalizeOriginalName(value: string) {
    const rawName = String(value || '').trim()
    const decodedName = Buffer.from(rawName, 'latin1').toString('utf8')
    const normalizedName = decodedName.includes('\uFFFD') ? rawName : decodedName
    const clean = basename(normalizedName).slice(0, 180)
    return clean || `未命名视频-${Date.now()}.mp4`
  }

  private cleanTags(tags: string[]) {
    return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 30)
  }

  private getContentTypeValues(productCategory: string) {
    const product = PRODUCT_TAXONOMY.find((item) => item.value === productCategory)
    return product?.contentTypes.map(([value]) => value as string) ?? ['UNCLASSIFIED', 'OTHER']
  }

  private getShotTypeValues() {
    return SHOT_TAXONOMY.map(([value]) => value as string)
  }

  private readReusableTranscripts(metadata: Prisma.JsonValue) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return []
    const rows = (metadata as Record<string, Prisma.JsonValue>).reusableTranscripts
    if (!Array.isArray(rows)) return []
    return rows.flatMap((row): ReusableTranscriptSegment[] => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return []
      const value = row as Record<string, Prisma.JsonValue>
      const startMs = Number(value.startMs)
      const endMs = Number(value.endMs)
      const transcript = String(value.transcript || '').trim()
      return Number.isFinite(startMs) && Number.isFinite(endMs) && transcript
        ? [{ startMs, endMs, transcript }]
        : []
    })
  }

  private combineReusableTranscripts(
    segment: ClipSegment,
    transcripts: ReusableTranscriptSegment[]
  ) {
    return transcripts
      .filter((item) => item.startMs < segment.endMs && item.endMs > segment.startMs)
      .map((item) => item.transcript)
      .filter((value, index, values) => index === 0 || value !== values[index - 1])
      .join(' ')
      .trim()
  }

  private videoContentType(extension: string) {
    const types: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.m4v': 'video/mp4',
      '.mov': 'video/quicktime',
      '.webm': 'video/webm',
      '.mkv': 'video/x-matroska',
      '.avi': 'video/x-msvideo',
    }
    return types[extension] || 'application/octet-stream'
  }

  private toMaterialView(material: MaterialWithClips, includeClips: boolean) {
    return {
      id: material.id,
      productCategory: material.productCategory,
      originalName: material.originalName,
      sourceFileName: material.sourceFileName,
      sourceUrl: `/api/video-materials/files/sources/${encodeURIComponent(material.sourceFileName)}`,
      mimeType: material.mimeType,
      fileSizeBytes: material.fileSizeBytes,
      durationMs: material.durationMs,
      width: material.width,
      height: material.height,
      fps: material.fps,
      videoCodec: material.videoCodec,
      audioCodec: material.audioCodec,
      hasAudio: material.hasAudio,
      status: material.status,
      progress: material.progress,
      stage: material.stage,
      errorMessage: material.errorMessage,
      sceneThreshold: material.sceneThreshold,
      minClipDurationMs: material.minClipDurationMs,
      maxClipDurationMs: material.maxClipDurationMs,
      clipCount: material._count?.clips ?? material.clipCount,
      transcriptSegmentCount: material._count?.transcriptSegments
        ?? material.transcriptSegments?.length
        ?? 0,
      aiStatus: material.aiStatus,
      aiProgress: material.aiProgress,
      aiStage: material.aiStage,
      aiErrorMessage: material.aiErrorMessage,
      aiModel: material.aiModel,
      aiInputTokens: material.aiInputTokens,
      aiOutputTokens: material.aiOutputTokens,
      aiAudioSeconds: material.aiAudioSeconds,
      aiStartedAt: material.aiStartedAt?.toISOString() ?? null,
      aiCompletedAt: material.aiCompletedAt?.toISOString() ?? null,
      segmentation: this.readSegmentationDiagnostics(material.metadata),
      createdAt: material.createdAt.toISOString(),
      updatedAt: material.updatedAt.toISOString(),
      completedAt: material.completedAt?.toISOString() ?? null,
      clips: includeClips
        ? (material.clips ?? []).map((clip) => this.toClipView(clip))
        : undefined,
    }
  }

  private toClipView(clip: VideoMaterialClip) {
    return {
      id: clip.id,
      materialId: clip.materialId,
      clipIndex: clip.clipIndex,
      startMs: clip.startMs,
      endMs: clip.endMs,
      durationMs: clip.durationMs,
      clipUrl: `/api/video-materials/files/clips/${encodeURIComponent(clip.clipFileName)}`,
      keyframeUrl: `/api/video-materials/files/keyframes/${encodeURIComponent(clip.keyframeFileName)}`,
      shotType: clip.shotType,
      contentType: clip.contentType,
      contentTopics: this.readStringArray(clip.contentTopics),
      description: clip.description,
      tags: Array.isArray(clip.tags) ? clip.tags.map(String) : [],
      actions: this.readStringArray(clip.actions),
      objects: this.readStringArray(clip.objects),
      scenes: this.readStringArray(clip.scenes),
      brands: this.readStringArray(clip.brands),
      qualityFlags: this.readStringArray(clip.qualityFlags),
      qualityScore: clip.qualityScore,
      usabilityScore: clip.usabilityScore,
      hasPerson: clip.hasPerson,
      hasTextOverlay: clip.hasTextOverlay,
      transcript: clip.transcript ?? '',
      transcriptContext: clip.transcriptContext,
      speechBoundaryStatus: clip.speechBoundaryStatus,
      motionScore: clip.motionScore,
      motionLevel: this.motionLevel(clip.motionScore),
      confidence: clip.confidence,
      aiModel: clip.aiModel,
      analyzedAt: clip.analyzedAt?.toISOString() ?? null,
      reviewStatus: clip.reviewStatus,
      createdAt: clip.createdAt.toISOString(),
      updatedAt: clip.updatedAt.toISOString(),
    }
  }

  private motionLevel(score: number | null) {
    if (score === null) return 'UNKNOWN'
    if (score < 0.18) return 'STATIC'
    if (score < 0.4) return 'LOW'
    if (score < 0.68) return 'MEDIUM'
    return 'HIGH'
  }

  private readSegmentationDiagnostics(metadata: Prisma.JsonValue) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
    const segmentation = (metadata as Record<string, Prisma.JsonValue>).segmentation
    if (!segmentation || typeof segmentation !== 'object' || Array.isArray(segmentation)) return null
    const value = segmentation as Record<string, Prisma.JsonValue>
    const numberValue = (key: string) => Math.max(0, Number(value[key] || 0))
    return {
      detectedSceneCount: numberValue('detectedSceneCount'),
      atomicSegmentCount: numberValue('atomicSegmentCount'),
      mergedShortSegmentCount: numberValue('mergedShortSegmentCount'),
      forcedSplitCount: numberValue('forcedSplitCount'),
      outputSegmentCount: numberValue('outputSegmentCount'),
      shortestSegmentMs: numberValue('shortestSegmentMs'),
      longestSegmentMs: numberValue('longestSegmentMs'),
      averageSegmentMs: numberValue('averageSegmentMs'),
    }
  }

  private readJsonObject(value: Prisma.JsonValue | null | undefined) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, Prisma.JsonValue>
      : {}
  }

  private resolveAiTargetClips(
    clips: VideoMaterialClip[],
    payload: AnalyzeVideoMaterialDto
  ) {
    if (payload.clipIds?.length) {
      const requestedIds = [...new Set(payload.clipIds)]
      const selected = clips.filter((clip) => requestedIds.includes(clip.id))
      if (selected.length !== requestedIds.length) {
        throw new BadRequestException('部分所选镜头不属于当前视频')
      }
      return selected
    }
    return payload.reanalyzeConfirmed
      ? clips
      : clips.filter((clip) => clip.reviewStatus !== 'CONFIRMED')
  }

  private readAiSelectedClipIds(metadata: Prisma.JsonValue) {
    const root = this.readJsonObject(metadata)
    const selection = root.aiSelection
    if (!selection || typeof selection !== 'object' || Array.isArray(selection)) return []
    return Array.isArray(selection.clipIds)
      ? selection.clipIds
        .map(Number)
        .filter((value) => Number.isInteger(value) && value > 0)
      : []
  }

  private readStringArray(value: Prisma.JsonValue | null | undefined) {
    return Array.isArray(value) ? value.map(String).filter(Boolean) : []
  }
}
