import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import {
  Prisma,
  type VideoAssemblyProject,
  type VideoAssemblyScene,
  type VideoMaterial,
  type VideoMaterialClip,
} from '@prisma/client'
import {
  accessSync,
  constants,
  mkdirSync,
} from 'node:fs'
import { copyFile, rename, rm, unlink } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../common/prisma.service'
import {
  CreateVideoAssemblyProjectDto,
  MatchVideoAssemblyProjectDto,
  UpdateVideoAssemblyProjectDto,
  UpdateVideoAssemblySceneDto,
} from './dto/video-assembly.dto'
import { VIDEO_MATERIAL_PRODUCT_CATEGORIES } from './dto/video-material.dto'
import { VideoMaterialAiService } from './video-material-ai.service'
import {
  getVideoMaterialProductTaxonomy,
  getVideoMaterialShotTaxonomy,
} from './video-materials.service'
import { VideoAssemblyRendererService } from './video-assembly-renderer.service'

type UploadedAudioFile = {
  originalname: string
  mimetype: string
  path: string
  size: number
}

type ClipWithMaterial = VideoMaterialClip & { material: VideoMaterial }

type SceneWithClip = VideoAssemblyScene & {
  selectedClip?: ClipWithMaterial | null
}

type ProjectSourceWithMaterial = {
  materialId: number
  material: VideoMaterial
}

type ProjectWithScenes = VideoAssemblyProject & {
  scenes?: SceneWithClip[]
  sourceMaterials?: ProjectSourceWithMaterial[]
  _count?: { scenes: number }
}

type MatchCandidate = {
  clipId: number
  score: number
  reason: string
  materialId: number
  materialName: string
  clipIndex: number
  durationMs: number
  shotType: string
  contentType: string
  description: string
  keyframeUrl: string
  clipUrl: string
  reviewStatus: string
  motionScore: number | null
  motionLevel: string
  visualCompatible: boolean
  staticFallback: boolean
  scoreBreakdown: {
    content: number
    visualIntent: number
    keywords: number
    quality: number
    penalties: number
  }
  warningFlags: string[]
}

const ALLOWED_AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'])
const MINIMUM_AUTOMATIC_MATCH_SCORE = 60
const STATIC_SHOT_TYPES = new Set(['DATA_GRAPHIC', 'SCREEN_CONTENT', 'TITLE_CARD'])
const INFORMATION_SHOT_TYPES = new Set(['DATA_GRAPHIC', 'SCREEN_CONTENT', 'TITLE_CARD', 'MONTAGE'])
const ACTION_SHOT_TYPES = new Set(['TEST_DEMONSTRATION'])
const EXPERIENCE_SHOT_TYPES = new Set(['TRY_ON', 'OUTDOOR_USAGE', 'TALKING_HEAD'])
const PRODUCT_SHOT_TYPES = new Set(['PRODUCT_DISPLAY', 'DETAIL_CLOSEUP', 'MONTAGE'])
const GENERIC_MATCH_KEYWORDS = new Set([
  '夏天',
  '防晒衣',
  '冲锋衣',
  '产品',
  '衣服',
  '品牌',
  '舒适',
  '户外',
  '日常',
])

const CONTENT_TYPE_CONCEPT_TERMS: Record<string, string[]> = {
  UV_PROTECTION: ['紫外线', '防晒力', 'upf', 'uva', 'uvb', '透过率'],
  BREATHABILITY_COOLING: ['透气', '凉感', '排汗', '闷汗', '降温'],
  COVERAGE_DESIGN: ['遮阳', '覆盖', '帽檐', '袖口', '面罩'],
  FABRIC_CRAFT: ['面料', '织物', '纤维', '工艺', '缝线'],
  WASH_DURABILITY: ['水洗', '耐水洗', '洗衣机', '洗涤', '清洗', '耐磨'],
  WATER_REPELLENCY: ['防泼水', '防水', '水珠', '喷淋'],
  WATERPROOF: ['防水', '暴雨', '淋雨', '喷淋', '水压'],
  WINDPROOF: ['防风', '大风', '风速', '挡风'],
  BREATHABILITY: ['透气', '排汗', '闷热', '透湿'],
  SEAM_CONSTRUCTION: ['压胶', '接缝', '走线', '缝线'],
  HOOD_CUFF_DESIGN: ['帽檐', '风帽', '袖口', '抽绳'],
  ABRASION_DURABILITY: ['耐磨', '摩擦', '刮擦', '耐用'],
  BRAND_REVIEW: ['品牌', '单品', '测评'],
  BRAND_COMPARISON: ['对比', '横评', '多款', '多个品牌'],
  PRICE_BUYING_GUIDE: ['价格', '预算', '购买', '推荐', '性价比'],
  KNOWLEDGE_GUIDE: ['科普', '指标', '选购', '知识'],
  GENERAL_CONTEXT: ['需求', '痛点', '行业', '背景'],
  PRODUCT_OVERVIEW: ['产品', '整体', '介绍', '外观'],
}

@Injectable()
export class VideoAssemblyService implements OnModuleInit {
  private readonly storageRoot: string
  private readonly audioDirectory: string
  private readonly outputDirectory: string
  private renderQueuePromise: Promise<void> | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly materialAi: VideoMaterialAiService,
    private readonly renderer: VideoAssemblyRendererService
  ) {
    this.storageRoot = resolve(
      process.env.VIDEO_MATERIAL_STORAGE_ROOT?.trim()
        || join(process.cwd(), 'storage', 'video-materials')
    )
    this.audioDirectory = join(this.storageRoot, 'assembly-audio')
    this.outputDirectory = join(this.storageRoot, 'assembly-outputs')
    mkdirSync(this.audioDirectory, { recursive: true })
    mkdirSync(this.outputDirectory, { recursive: true })
  }

  async onModuleInit() {
    try {
      await this.prisma.videoAssemblyProject.updateMany({
        where: { status: 'RENDERING' },
        data: {
          status: 'RENDER_QUEUED',
          progress: 0,
          stage: '服务恢复，重新排队渲染',
          completedAt: null,
        },
      })
      this.scheduleRenderQueue()
    } catch (error) {
      console.error('[VideoAssembly] Failed to recover render queue', error)
    }
  }

  async runtimeHealth() {
    const [runtime, queuedCount, renderingCount] = await Promise.all([
      this.renderer.runtimeHealth(),
      this.prisma.videoAssemblyProject.count({ where: { status: 'RENDER_QUEUED' } }),
      this.prisma.videoAssemblyProject.count({ where: { status: 'RENDERING' } }),
    ])
    return {
      ...runtime,
      ai: this.materialAi.configuration(),
      queue: { queuedCount, renderingCount },
    }
  }

  async findProjects(productCategory?: string) {
    const category = productCategory?.trim()
    if (category && !VIDEO_MATERIAL_PRODUCT_CATEGORIES.includes(category as any)) {
      throw new BadRequestException('不支持的产品品类')
    }
    const projects = await this.prisma.videoAssemblyProject.findMany({
      where: category ? { productCategory: category } : undefined,
      include: {
        _count: { select: { scenes: true } },
        sourceMaterials: { include: { material: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    })
    return projects.map((project) => this.toProjectView(project, false))
  }

  async findProject(id: number) {
    const project = await this.prisma.videoAssemblyProject.findUnique({
      where: { id },
      include: {
        scenes: {
          include: { selectedClip: { include: { material: true } } },
          orderBy: { sceneIndex: 'asc' },
        },
        sourceMaterials: { include: { material: true } },
      },
    })
    if (!project) throw new NotFoundException('旁白成片项目不存在')
    return this.toProjectView(project, true)
  }

  async createProject(payload: CreateVideoAssemblyProjectDto) {
    const name = payload.name.trim()
    const narrationText = payload.narrationText.trim()
    if (!name) throw new BadRequestException('请输入项目名称')
    if (!narrationText) throw new BadRequestException('请输入完整旁白')

    const sourceMode = payload.sourceMode || 'ALL'
    const sourceMaterialIds = await this.validateSourceMaterials(
      payload.productCategory,
      sourceMode,
      payload.sourceMaterialIds || []
    )

    const project = await this.prisma.videoAssemblyProject.create({
      data: {
        productCategory: payload.productCategory,
        name,
        narrationText,
        aspectRatio: payload.aspectRatio || '9:16',
        removeSourceSubtitles: payload.removeSourceSubtitles ?? true,
        sourceMode,
        framingMode: payload.framingMode || 'SMART',
        ...(sourceMaterialIds.length ? {
          sourceMaterials: {
            create: sourceMaterialIds.map((materialId) => ({ materialId })),
          },
        } : {}),
        status: 'DRAFT',
        progress: 0,
        stage: '等待拆解旁白',
        errorMessage: '',
      },
      include: { sourceMaterials: { include: { material: true } } },
    })
    return this.toProjectView(project, false)
  }

  async updateProject(id: number, payload: UpdateVideoAssemblyProjectDto) {
    const project = await this.findProjectRecord(id)
    this.assertProjectIdle(project)
    const narrationChanged = payload.narrationText !== undefined
      && payload.narrationText.trim() !== project.narrationText
    const nameChanged = payload.name !== undefined && payload.name.trim() !== project.name
    const aspectRatioChanged = payload.aspectRatio !== undefined
      && payload.aspectRatio !== project.aspectRatio
    const subtitleSettingChanged = payload.removeSourceSubtitles !== undefined
      && payload.removeSourceSubtitles !== project.removeSourceSubtitles
    const framingModeChanged = payload.framingMode !== undefined
      && payload.framingMode !== project.framingMode
    if (payload.name !== undefined && !payload.name.trim()) {
      throw new BadRequestException('项目名称不能为空')
    }
    if (payload.narrationText !== undefined && !payload.narrationText.trim()) {
      throw new BadRequestException('完整旁白不能为空')
    }

    const sourceConfigurationProvided = payload.sourceMode !== undefined
      || payload.sourceMaterialIds !== undefined
    const nextSourceMode = payload.sourceMode || project.sourceMode
    const currentSourceIds = project.sourceMaterials.map((item) => item.materialId).sort((a, b) => a - b)
    const nextSourceIds = sourceConfigurationProvided
      ? await this.validateSourceMaterials(
        project.productCategory,
        nextSourceMode,
        payload.sourceMaterialIds ?? currentSourceIds
      )
      : currentSourceIds
    const sourceChanged = sourceConfigurationProvided && (
      nextSourceMode !== project.sourceMode
      || !this.sameNumberArray(currentSourceIds, nextSourceIds)
    )
    const renderConfigurationChanged = narrationChanged
      || aspectRatioChanged
      || subtitleSettingChanged
      || framingModeChanged
      || sourceChanged
    if (!nameChanged && !renderConfigurationChanged) return this.findProject(id)

    const hasScenes = Boolean(project.scenes.length)
    const stage = narrationChanged
      ? '旁白已修改，请重新智能规划'
      : sourceChanged
        ? '素材范围已修改，请重新匹配画面'
        : '成片配置已更新'
    const errorMessage = sourceChanged && hasScenes
      ? '原画面选择已失效，请点击重新匹配。旧成片仍可查看。'
      : ''

    const updated = await this.prisma.$transaction(async (transaction) => {
      if (narrationChanged) {
        await transaction.videoAssemblyScene.deleteMany({ where: { projectId: id } })
      } else if (sourceChanged && hasScenes) {
        await transaction.videoAssemblyScene.updateMany({
          where: { projectId: id },
          data: {
            selectedClipId: null,
            clipStartOffsetMs: 0,
            clipDurationMs: 0,
            matchScore: null,
            matchReason: '素材范围已修改，请重新匹配',
            candidates: Prisma.JsonNull,
            status: 'PENDING',
          },
        })
      }
      if (sourceChanged) {
        await transaction.videoAssemblyProjectMaterial.deleteMany({ where: { projectId: id } })
        if (nextSourceIds.length) {
          await transaction.videoAssemblyProjectMaterial.createMany({
            data: nextSourceIds.map((materialId) => ({ projectId: id, materialId })),
          })
        }
      }
      return transaction.videoAssemblyProject.update({
        where: { id },
        data: {
          ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
          ...(payload.narrationText !== undefined
            ? { narrationText: payload.narrationText.trim() }
            : {}),
          ...(payload.aspectRatio !== undefined ? { aspectRatio: payload.aspectRatio } : {}),
          ...(payload.removeSourceSubtitles !== undefined
            ? { removeSourceSubtitles: payload.removeSourceSubtitles }
            : {}),
          ...(payload.framingMode !== undefined ? { framingMode: payload.framingMode } : {}),
          ...(sourceChanged ? { sourceMode: nextSourceMode } : {}),
          status: narrationChanged
            ? 'DRAFT'
            : sourceChanged && hasScenes
              ? 'FAILED'
              : renderConfigurationChanged && hasScenes
                ? 'READY'
                : project.status,
          ...(renderConfigurationChanged ? {
            progress: 0,
            stage,
            errorMessage,
            completedAt: null,
          } : {}),
        },
        include: { sourceMaterials: { include: { material: true } } },
      })
    })
    return this.toProjectView(updated, false)
  }

  async removeProject(id: number) {
    const project = await this.findProjectRecord(id)
    this.assertProjectIdle(project)
    await this.prisma.videoAssemblyProject.delete({ where: { id } })
    await Promise.all([
      this.safeUnlink(project.narrationAudioPath),
      this.safeUnlink(project.outputPath),
    ])
    return { id }
  }

  async planProject(id: number) {
    const project = await this.findProjectRecord(id)
    this.assertProjectIdle(project)
    const product = getVideoMaterialProductTaxonomy(project.productCategory)
    if (!product) throw new BadRequestException('找不到当前产品的素材分类')
    if (!this.materialAi.configuration().configured) {
      throw new BadRequestException('后端尚未配置百炼 API Key')
    }

    await this.prisma.videoAssemblyProject.update({
      where: { id },
      data: {
        status: 'PLANNING',
        progress: 10,
        stage: 'AI 正在拆解旁白和画面需求',
        errorMessage: '',
        aiInputTokens: 0,
        aiOutputTokens: 0,
        aiModel: this.materialAi.configuration().textModel,
        completedAt: null,
      },
    })

    try {
      const result = await this.materialAi.planNarration(
        project.narrationText,
        product.label,
        product.contentTypes,
        getVideoMaterialShotTaxonomy()
      )
      await this.prisma.$transaction([
        this.prisma.videoAssemblyScene.deleteMany({ where: { projectId: id } }),
        this.prisma.videoAssemblyScene.createMany({
          data: result.data.map((scene) => ({
            projectId: id,
            sceneIndex: scene.sceneIndex,
            narrationText: scene.narrationText,
            targetDurationMs: scene.targetDurationMs,
            visualBrief: scene.visualBrief,
            visualIntent: scene.visualIntent,
            contentTypes: scene.contentTypes as Prisma.InputJsonValue,
            shotTypes: scene.shotTypes as Prisma.InputJsonValue,
            keywords: scene.keywords as Prisma.InputJsonValue,
            negativeKeywords: scene.negativeKeywords as Prisma.InputJsonValue,
            status: 'PENDING',
          })),
        }),
        this.prisma.videoAssemblyProject.update({
          where: { id },
          data: {
            status: 'MATCHING',
            progress: 55,
            stage: `已拆成 ${result.data.length} 段，正在匹配素材`,
            aiInputTokens: result.usage.inputTokens,
            aiOutputTokens: result.usage.outputTokens,
          },
        }),
      ])
      await this.applyMatching(id, false)
      return this.findProject(id)
    } catch (error) {
      await this.prisma.videoAssemblyProject.update({
        where: { id },
        data: {
          status: 'FAILED',
          progress: 0,
          stage: '旁白规划失败',
          errorMessage: error instanceof Error ? error.message.slice(0, 2000) : '旁白规划失败',
        },
      })
      throw new BadRequestException(error instanceof Error ? error.message : '旁白规划失败')
    }
  }

  async matchProject(id: number, payload: MatchVideoAssemblyProjectDto) {
    const project = await this.findProjectRecord(id)
    this.assertProjectIdle(project)
    if (!project.scenes?.length) throw new BadRequestException('请先进行 AI 旁白规划')
    await this.prisma.videoAssemblyProject.update({
      where: { id },
      data: { status: 'MATCHING', progress: 60, stage: '正在重新匹配素材', errorMessage: '' },
    })
    await this.applyMatching(id, payload.confirmedOnly ?? false)
    return this.findProject(id)
  }

  async updateScene(id: number, payload: UpdateVideoAssemblySceneDto) {
    const scene = await this.prisma.videoAssemblyScene.findUnique({
      where: { id },
      include: {
        project: { include: { sourceMaterials: true } },
        selectedClip: { include: { material: true } },
      },
    })
    if (!scene) throw new NotFoundException('旁白分段不存在')
    this.assertProjectIdle(scene.project)

    let selectedClip: ClipWithMaterial | null = null
    if (payload.selectedClipId !== undefined) {
      selectedClip = await this.prisma.videoMaterialClip.findUnique({
        where: { id: payload.selectedClipId },
        include: { material: true },
      })
      if (!selectedClip || selectedClip.material.productCategory !== scene.project.productCategory) {
        throw new BadRequestException('所选镜头不属于当前产品素材库')
      }
      if (selectedClip.material.status !== 'READY') {
        throw new BadRequestException('所选镜头尚未处理完成')
      }
      if (
        scene.project.sourceMode === 'SELECTED'
        && !scene.project.sourceMaterials.some((item) => item.materialId === selectedClip?.materialId)
      ) {
        throw new BadRequestException('所选镜头不在当前项目限定的来源视频中')
      }
    }

    const activeClip = selectedClip || scene.selectedClip
    if ((payload.clipStartOffsetMs !== undefined || payload.clipDurationMs !== undefined) && !activeClip) {
      throw new BadRequestException('请先为这段旁白选择素材')
    }
    const nextDurationMs = payload.clipDurationMs
      ?? (selectedClip ? Math.min(scene.targetDurationMs, selectedClip.durationMs) : scene.clipDurationMs)
    const nextOffsetMs = payload.clipStartOffsetMs
      ?? (selectedClip ? Math.max(0, Math.round((selectedClip.durationMs - nextDurationMs) / 2)) : scene.clipStartOffsetMs)
    if (activeClip && nextOffsetMs + nextDurationMs > activeClip.durationMs) {
      throw new BadRequestException('取片位置超出原镜头范围，请缩短时长或向前调整')
    }

    await this.prisma.videoAssemblyScene.update({
      where: { id },
      data: {
        ...(payload.selectedClipId !== undefined ? { selectedClipId: payload.selectedClipId } : {}),
        ...((payload.clipStartOffsetMs !== undefined || selectedClip)
          ? { clipStartOffsetMs: nextOffsetMs }
          : {}),
        ...((payload.clipDurationMs !== undefined || selectedClip)
          ? { clipDurationMs: nextDurationMs }
          : {}),
        ...(payload.narrationText !== undefined
          ? { narrationText: payload.narrationText.trim() }
          : {}),
        ...(payload.visualBrief !== undefined ? { visualBrief: payload.visualBrief.trim() } : {}),
        ...(payload.visualIntent !== undefined ? { visualIntent: payload.visualIntent } : {}),
        ...(payload.contentTypes !== undefined
          ? { contentTypes: this.cleanStringArray(payload.contentTypes, 5) as Prisma.InputJsonValue }
          : {}),
        ...(payload.shotTypes !== undefined
          ? { shotTypes: this.cleanStringArray(payload.shotTypes, 5) as Prisma.InputJsonValue }
          : {}),
        ...(payload.keywords !== undefined
          ? { keywords: this.cleanStringArray(payload.keywords, 12) as Prisma.InputJsonValue }
          : {}),
        ...(payload.negativeKeywords !== undefined
          ? { negativeKeywords: this.cleanStringArray(payload.negativeKeywords, 10) as Prisma.InputJsonValue }
          : {}),
        status: payload.selectedClipId !== undefined ? 'MANUAL' : scene.status,
      },
    })
    await this.prisma.videoAssemblyProject.update({
      where: { id: scene.projectId },
      data: {
        status: 'READY',
        progress: 100,
        stage: '画面方案已调整',
        errorMessage: '',
        completedAt: null,
      },
    })
    return this.findProject(scene.projectId)
  }

  async uploadNarrationAudio(id: number, file: UploadedAudioFile | undefined) {
    const project = await this.findProjectRecord(id)
    this.assertProjectIdle(project)
    if (!file) throw new BadRequestException('请选择旁白音频')
    const extension = extname(file.originalname).toLowerCase()
    if (!ALLOWED_AUDIO_EXTENSIONS.has(extension)) {
      await this.safeUnlink(file.path)
      throw new BadRequestException('仅支持 MP3、WAV、M4A、AAC、FLAC 和 OGG 音频')
    }

    const fileName = `${randomUUID()}${extension}`
    const destinationPath = join(this.audioDirectory, fileName)
    try {
      await this.moveFile(file.path, destinationPath)
      const audioProbe = await this.renderer.probeAudio(destinationPath)
      const durationMs = audioProbe.durationMs
      await this.safeUnlink(project.narrationAudioPath)
      await this.safeUnlink(project.outputPath)
      await this.prisma.videoAssemblyProject.update({
        where: { id },
        data: {
          narrationAudioFileName: fileName,
          narrationAudioPath: destinationPath,
          outputFileName: '',
          outputPath: '',
          durationMs,
          status: project.scenes?.length ? 'READY' : project.status,
          stage: `旁白音频已上传（${(durationMs / 1000).toFixed(1)} 秒）`,
          errorMessage: '',
          completedAt: null,
          metadata: {
            ...this.readJsonObject(project.metadata),
            audioOriginalName: basename(file.originalname).slice(0, 180),
            audioMimeType: file.mimetype || '',
            audioSizeBytes: file.size || 0,
            audioDurationMs: durationMs,
            audioCodec: audioProbe.audioCodec,
            audioSampleRate: audioProbe.sampleRate,
            audioChannels: audioProbe.channels,
          } as Prisma.InputJsonValue,
        },
      })
      return this.findProject(id)
    } catch (error) {
      await this.safeUnlink(file.path)
      await this.safeUnlink(destinationPath)
      if (error instanceof BadRequestException) throw error
      console.error('[VideoAssembly] Failed to inspect narration audio', error)
      throw new BadRequestException('无法读取旁白音频，请确认文件可以正常播放后重试')
    }
  }

  async renderProject(id: number) {
    const project = await this.findProjectRecord(id)
    this.assertProjectIdle(project)
    if (!project.scenes?.length) throw new BadRequestException('请先规划旁白并匹配素材')
    const missingCount = project.scenes.filter((scene) => !scene.selectedClipId).length
    if (missingCount) throw new BadRequestException(`还有 ${missingCount} 段没有匹配画面`)

    const updated = await this.prisma.videoAssemblyProject.update({
      where: { id },
      data: {
        status: 'RENDER_QUEUED',
        progress: 0,
        stage: project.narrationAudioPath ? '等待合成视频' : '等待导出静音画面预览',
        errorMessage: '',
        completedAt: null,
      },
    })
    this.scheduleRenderQueue()
    return this.findProject(updated.id)
  }

  resolveStoredFile(kind: string, fileName: string) {
    const directory = kind === 'audio'
      ? this.audioDirectory
      : kind === 'outputs'
        ? this.outputDirectory
        : null
    if (!directory || basename(fileName) !== fileName) {
      throw new NotFoundException('成片文件不存在')
    }
    const filePath = join(directory, fileName)
    try {
      accessSync(filePath, constants.R_OK)
    } catch {
      throw new NotFoundException('成片文件不存在')
    }
    return {
      path: filePath,
      contentType: kind === 'audio' ? this.audioContentType(extname(fileName)) : 'video/mp4',
    }
  }

  private async applyMatching(projectId: number, confirmedOnly: boolean) {
    const project = await this.prisma.videoAssemblyProject.findUnique({
      where: { id: projectId },
      include: {
        scenes: { orderBy: { sceneIndex: 'asc' } },
        sourceMaterials: true,
      },
    })
    if (!project) throw new NotFoundException('旁白成片项目不存在')

    const sourceMaterialIds = project.sourceMaterials.map((item) => item.materialId)
    if (project.sourceMode === 'SELECTED' && !sourceMaterialIds.length) {
      await this.prisma.videoAssemblyProject.update({
        where: { id: projectId },
        data: {
          status: 'FAILED',
          progress: 0,
          stage: '指定的来源素材已删除',
          errorMessage: '项目限定的来源视频已不存在，请重新选择素材范围。',
        },
      })
      throw new BadRequestException('指定的来源素材已删除，请重新选择素材范围')
    }

    const clips = await this.prisma.videoMaterialClip.findMany({
      where: {
        material: {
          productCategory: project.productCategory,
          status: 'READY',
          ...(project.sourceMode === 'SELECTED' ? { id: { in: sourceMaterialIds } } : {}),
        },
        shotType: { notIn: ['UNCLASSIFIED', 'OTHER', 'TRANSITION'] },
        contentType: { notIn: ['UNCLASSIFIED', 'OTHER'] },
        ...(confirmedOnly ? { reviewStatus: 'CONFIRMED' } : {}),
      },
      include: { material: true },
      orderBy: [{ reviewStatus: 'asc' }, { usabilityScore: 'desc' }, { id: 'asc' }],
      take: 5000,
    })
    if (!clips.length) {
      await this.prisma.videoAssemblyProject.update({
        where: { id: projectId },
        data: {
          status: 'FAILED',
          progress: 0,
          stage: '没有可匹配的素材',
          errorMessage: confirmedOnly
            ? '当前产品还没有已确认素材，请先确认素材或取消“只用已确认素材”。'
            : '当前产品还没有完成 AI 分类的可用素材。',
        },
      })
      throw new BadRequestException(
        confirmedOnly
          ? '当前产品还没有已确认素材，请先确认素材或关闭“只用已确认素材”'
          : '当前产品还没有完成 AI 分类的可用素材'
      )
    }

    const usage = new Map<number, number>()
    const clipById = new Map(clips.map((clip) => [clip.id, clip]))
    let consecutiveStaticCount = 0
    for (const scene of project.scenes) {
      if (scene.status === 'MANUAL' && scene.selectedClipId) {
        usage.set(scene.selectedClipId, (usage.get(scene.selectedClipId) || 0) + 1)
        const manualClip = clipById.get(scene.selectedClipId)
        consecutiveStaticCount = manualClip && this.isStaticClip(manualClip)
          ? consecutiveStaticCount + 1
          : 0
        continue
      }
      const allCandidates = clips
        .map((clip) => this.scoreCandidate(
          scene,
          clip,
          usage,
          project.removeSourceSubtitles,
          consecutiveStaticCount
        ))
        .sort((left, right) => right.score - left.score)
      const compatibleCandidates = allCandidates.filter((candidate) => candidate.visualCompatible)
      const fallbackCandidates = compatibleCandidates.length
        ? []
        : allCandidates.filter((candidate) => candidate.staticFallback)
      const selected = [...compatibleCandidates, ...fallbackCandidates]
        .find((candidate) => candidate.score >= MINIMUM_AUTOMATIC_MATCH_SCORE)
      const candidates = selected
        ? [...allCandidates.slice(0, 5), selected]
          .filter((candidate, index, rows) => (
            rows.findIndex((item) => item.clipId === candidate.clipId) === index
          ))
          .sort((left, right) => right.score - left.score)
          .slice(0, 6)
        : allCandidates.slice(0, 6)
      const clipDurationMs = selected
        ? Math.min(scene.targetDurationMs, selected.durationMs)
        : 0
      const clipStartOffsetMs = selected
        ? Math.max(0, Math.round((selected.durationMs - clipDurationMs) / 2))
        : 0
      await this.prisma.videoAssemblyScene.update({
        where: { id: scene.id },
        data: {
          selectedClipId: selected?.clipId ?? null,
          clipStartOffsetMs,
          clipDurationMs,
          matchScore: selected?.score ?? null,
          matchReason: selected
            ? `${selected.staticFallback ? '使用静态备选；' : ''}${selected.reason}`
            : compatibleCandidates.length
              ? '有意图相符的素材，但匹配分不足 60 分'
              : '没有找到与旁白画面意图相符的素材',
          candidates: candidates as unknown as Prisma.InputJsonValue,
          status: selected ? 'MATCHED' : 'NO_MATCH',
        },
      })
      if (selected) {
        usage.set(selected.clipId, (usage.get(selected.clipId) || 0) + 1)
        const selectedClip = clipById.get(selected.clipId)
        consecutiveStaticCount = selectedClip && this.isStaticClip(selectedClip)
          ? consecutiveStaticCount + 1
          : 0
      } else {
        consecutiveStaticCount = 0
      }
    }

    const matchedCount = await this.prisma.videoAssemblyScene.count({
      where: { projectId, selectedClipId: { not: null } },
    })
    await this.prisma.videoAssemblyProject.update({
      where: { id: projectId },
      data: {
        status: matchedCount === project.scenes.length ? 'READY' : 'FAILED',
        progress: matchedCount === project.scenes.length ? 100 : 0,
        stage: matchedCount === project.scenes.length
          ? `已为 ${matchedCount} 段旁白匹配画面`
          : `已匹配 ${matchedCount}/${project.scenes.length} 段`,
        errorMessage: matchedCount === project.scenes.length
          ? ''
          : '部分旁白暂时没有匹配画面，请补充素材或手动选择。',
      },
    })
  }

  private scoreCandidate(
    scene: VideoAssemblyScene,
    clip: ClipWithMaterial,
    usage: Map<number, number>,
    removeSourceSubtitles: boolean,
    consecutiveStaticCount: number
  ): MatchCandidate {
    const desiredContentTypes = this.readStringArray(scene.contentTypes)
    const desiredShotTypes = this.readStringArray(scene.shotTypes)
    const keywords = this.readStringArray(scene.keywords)
    const negatives = this.readStringArray(scene.negativeKeywords)
    const clipTopics = [clip.contentType, ...this.readStringArray(clip.contentTopics)]
    const clipTerms = [
      clip.description,
      clip.transcript || '',
      clip.transcriptContext || '',
      ...this.readStringArray(clip.tags),
      ...this.readStringArray(clip.actions),
      ...this.readStringArray(clip.objects),
      ...this.readStringArray(clip.scenes),
      ...this.readStringArray(clip.brands),
    ].filter(Boolean)
    const searchable = clipTerms.join(' ').toLowerCase()
    const reasons: string[] = []
    const warningFlags: string[] = []

    const explicitContentMatches = desiredContentTypes.filter((type) => clipTopics.includes(type))
    const inferredContentMatches = desiredContentTypes.filter((type) =>
      (CONTENT_TYPE_CONCEPT_TERMS[type] ?? []).some((term) => this.termMatches(searchable, term))
    )
    const inferredOnlyMatches = inferredContentMatches.filter(
      (type) => !explicitContentMatches.includes(type)
    )
    const explicitCoverage = explicitContentMatches.length / Math.max(1, desiredContentTypes.length)
    const inferredCoverage = inferredOnlyMatches.length / Math.max(1, desiredContentTypes.length)
    const contentScore = Math.min(40, explicitCoverage * 32 + inferredCoverage * 8)
    if (explicitContentMatches.length) reasons.push('内容主题匹配')
    if (inferredOnlyMatches.length) reasons.push('语音语境补充命中')

    const visualCompatible = this.isVisualCompatible(scene.visualIntent, clip)
    const desiredShotMatched = desiredShotTypes.includes(clip.shotType)
    const visualIntentScore = Math.min(30,
      (visualCompatible ? 18 : 0)
      + (desiredShotMatched ? 12 : 0)
      + (!desiredShotTypes.length && visualCompatible ? 6 : 0)
    )
    if (visualCompatible) reasons.push('画面意图相符')
    if (desiredShotMatched) reasons.push('画面类型匹配')
    if (!visualCompatible) warningFlags.push('INTENT_MISMATCH')

    const keywordMatches = keywords.filter((keyword) => this.termMatches(searchable, keyword))
    let keywordScore = keywordMatches.length
      ? Math.min(15, keywordMatches.reduce(
        (sum, keyword) => sum + Math.max(2, this.keywordMatchWeight(keyword) / 2),
        0
      ))
      : 0
    if (keywordMatches.length) reasons.push(`命中${keywordMatches.slice(0, 3).join('、')}`)
    const primaryConcept = this.selectPrimaryKeyword(keywords)
    if (primaryConcept) {
      if (this.termMatches(searchable, primaryConcept)) {
        keywordScore = Math.min(15, keywordScore + 4)
        reasons.push(`关键概念${primaryConcept}`)
      }
    }

    const qualityScoreValue = clip.qualityScore ?? 0.55
    const usabilityScore = clip.usabilityScore ?? 0.55
    const durationCoverage = Math.min(1, clip.durationMs / Math.max(1000, scene.targetDurationMs))
    const qualityScore = Math.min(15,
      qualityScoreValue * 5
      + usabilityScore * 6
      + durationCoverage * 2
      + (clip.reviewStatus === 'CONFIRMED' ? 2 : 0)
    )
    if (usabilityScore >= 0.8) reasons.push('素材可用度高')
    if (clip.reviewStatus === 'CONFIRMED') reasons.push('已人工确认')
    else warningFlags.push('UNCONFIRMED')

    let penalties = 0
    const negativeMatches = negatives.filter((keyword) => this.termMatches(searchable, keyword))
    penalties += Math.min(30, negativeMatches.length * 12)
    if (negativeMatches.length) reasons.push(`含排除项${negativeMatches.slice(0, 2).join('、')}`)
    const isStatic = this.isStaticClip(clip)
    const requiresDynamic = ['ACTION', 'EXPERIENCE'].includes(scene.visualIntent)
    if (requiresDynamic && STATIC_SHOT_TYPES.has(clip.shotType)) penalties += 30
    if (requiresDynamic && clip.motionScore !== null && clip.motionScore < 0.18) penalties += 15
    if (clip.reviewStatus === 'NEEDS_REVIEW') penalties += 8
    if (clip.durationMs < scene.targetDurationMs) {
      penalties += Math.min(15, ((scene.targetDurationMs - clip.durationMs) / 1000) * 3)
    }
    if (clip.hasTextOverlay && !removeSourceSubtitles) penalties += 6
    if (usabilityScore < 0.4) {
      penalties += 18
      warningFlags.push('LOW_USABILITY')
    }
    const qualityFlags = this.readStringArray(clip.qualityFlags)
    penalties += qualityFlags.length * 3
    if (qualityFlags.some((flag) => /水印|模糊|遮挡/.test(flag))) penalties += 6
    penalties += (usage.get(clip.id) || 0) * 45
    if (isStatic && consecutiveStaticCount > 0) {
      penalties += Math.min(24, consecutiveStaticCount * 12)
      reasons.push('连续静态画面降权')
    }

    const score = Math.round(Math.max(
      0,
      Math.min(100, contentScore + visualIntentScore + keywordScore + qualityScore - penalties)
    ) * 10) / 10
    const staticFallback = !visualCompatible && isStatic && requiresDynamic
    if (staticFallback) warningFlags.push('STATIC_FALLBACK')
    if (score < MINIMUM_AUTOMATIC_MATCH_SCORE) warningFlags.push('LOW_SCORE')
    return {
      clipId: clip.id,
      score,
      reason: reasons.length ? reasons.join('；') : '按素材质量和时长排序',
      materialId: clip.materialId,
      materialName: clip.material.originalName,
      clipIndex: clip.clipIndex,
      durationMs: clip.durationMs,
      shotType: clip.shotType,
      contentType: clip.contentType,
      description: clip.description,
      keyframeUrl: `/api/video-materials/files/keyframes/${encodeURIComponent(clip.keyframeFileName)}`,
      clipUrl: `/api/video-materials/files/clips/${encodeURIComponent(clip.clipFileName)}`,
      reviewStatus: clip.reviewStatus,
      motionScore: clip.motionScore,
      motionLevel: this.motionLevel(clip.motionScore),
      visualCompatible,
      staticFallback,
      scoreBreakdown: {
        content: Math.round(contentScore * 10) / 10,
        visualIntent: Math.round(visualIntentScore * 10) / 10,
        keywords: Math.round(keywordScore * 10) / 10,
        quality: Math.round(qualityScore * 10) / 10,
        penalties: Math.round(penalties * 10) / 10,
      },
      warningFlags: [...new Set(warningFlags)],
    }
  }

  private isVisualCompatible(intent: string, clip: VideoMaterialClip) {
    if (intent === 'INFORMATION') return INFORMATION_SHOT_TYPES.has(clip.shotType)
    if (intent === 'ACTION') {
      return ACTION_SHOT_TYPES.has(clip.shotType)
        && (clip.motionScore === null || clip.motionScore >= 0.12)
    }
    if (intent === 'EXPERIENCE') {
      return EXPERIENCE_SHOT_TYPES.has(clip.shotType)
        && (clip.motionScore === null || clip.motionScore >= 0.1)
    }
    if (intent === 'PRODUCT') return PRODUCT_SHOT_TYPES.has(clip.shotType)
    return true
  }

  private isStaticClip(clip: VideoMaterialClip) {
    return STATIC_SHOT_TYPES.has(clip.shotType)
      || (clip.motionScore !== null && clip.motionScore < 0.18)
  }

  private motionLevel(score: number | null) {
    if (score === null) return 'UNKNOWN'
    if (score < 0.18) return 'STATIC'
    if (score < 0.4) return 'LOW'
    if (score < 0.68) return 'MEDIUM'
    return 'HIGH'
  }

  private scheduleRenderQueue() {
    if (this.renderQueuePromise) return
    this.renderQueuePromise = this.drainRenderQueue()
      .catch((error) => console.error('[VideoAssembly] Render queue stopped', error))
      .finally(() => {
        this.renderQueuePromise = null
        void this.restartRenderQueueIfNeeded()
      })
  }

  private async restartRenderQueueIfNeeded() {
    const pending = await this.prisma.videoAssemblyProject.findFirst({
      where: { status: 'RENDER_QUEUED' },
      select: { id: true },
    })
    if (pending) this.scheduleRenderQueue()
  }

  private async drainRenderQueue() {
    while (true) {
      const project = await this.prisma.videoAssemblyProject.findFirst({
        where: { status: 'RENDER_QUEUED' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
      if (!project) return
      await this.processRender(project.id)
    }
  }

  private async processRender(projectId: number) {
    await this.prisma.videoAssemblyProject.update({
      where: { id: projectId },
      data: { status: 'RENDERING', progress: 2, stage: '准备成片素材', errorMessage: '' },
    })
    try {
      const project = await this.prisma.videoAssemblyProject.findUnique({
        where: { id: projectId },
        include: {
          scenes: {
            include: { selectedClip: { include: { material: true } } },
            orderBy: { sceneIndex: 'asc' },
          },
        },
      })
      if (!project) throw new Error('旁白成片项目不存在')
      const result = await this.renderer.render(project, async (progress, stage) => {
        await this.prisma.videoAssemblyProject.update({
          where: { id: projectId },
          data: { progress, stage },
        })
      })
      await this.prisma.videoAssemblyProject.update({
        where: { id: projectId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          stage: project.narrationAudioPath ? '视频合成完成' : '静音画面预览已导出',
          errorMessage: '',
          outputFileName: result.outputFileName,
          outputPath: result.outputPath,
          durationMs: result.durationMs,
          metadata: {
            ...this.readJsonObject(project.metadata),
            render: result.metadata,
          } as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      })
      if (project.outputPath && project.outputPath !== result.outputPath) {
        await this.safeUnlink(project.outputPath)
      }
    } catch (error) {
      await this.prisma.videoAssemblyProject.update({
        where: { id: projectId },
        data: {
          status: 'FAILED',
          progress: 0,
          stage: '视频合成失败',
          errorMessage: error instanceof Error ? error.message.slice(0, 2000) : '视频合成失败',
          completedAt: null,
        },
      })
    }
  }

  private async findProjectRecord(id: number) {
    const project = await this.prisma.videoAssemblyProject.findUnique({
      where: { id },
      include: {
        scenes: { orderBy: { sceneIndex: 'asc' } },
        sourceMaterials: { include: { material: true } },
      },
    })
    if (!project) throw new NotFoundException('旁白成片项目不存在')
    return project
  }

  private async validateSourceMaterials(
    productCategory: string,
    sourceMode: string,
    materialIds: number[]
  ) {
    if (sourceMode === 'ALL') return []
    const uniqueIds = [...new Set(materialIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
      .sort((left, right) => left - right)
    if (!uniqueIds.length) throw new BadRequestException('指定视频模式至少要选择一个来源视频')
    if (uniqueIds.length > 100) throw new BadRequestException('一次最多选择 100 个来源视频')
    const materials = await this.prisma.videoMaterial.findMany({
      where: {
        id: { in: uniqueIds },
        productCategory,
        status: 'READY',
      },
      select: { id: true },
    })
    if (materials.length !== uniqueIds.length) {
      throw new BadRequestException('部分来源视频不属于当前产品，或尚未完成拆片')
    }
    return uniqueIds
  }

  private sameNumberArray(left: number[], right: number[]) {
    return left.length === right.length && left.every((value, index) => value === right[index])
  }

  private assertProjectIdle(project: VideoAssemblyProject) {
    if (['PLANNING', 'MATCHING', 'RENDER_QUEUED', 'RENDERING'].includes(project.status)) {
      throw new BadRequestException('当前项目正在处理中，请完成后再操作')
    }
  }

  private toProjectView(project: ProjectWithScenes, includeScenes: boolean) {
    return {
      id: project.id,
      productCategory: project.productCategory,
      name: project.name,
      narrationText: project.narrationText,
      status: project.status,
      progress: project.progress,
      stage: project.stage,
      errorMessage: project.errorMessage,
      aspectRatio: project.aspectRatio,
      removeSourceSubtitles: project.removeSourceSubtitles,
      sourceMode: project.sourceMode,
      sourceMaterialIds: (project.sourceMaterials ?? []).map((item) => item.materialId),
      sourceMaterials: (project.sourceMaterials ?? []).map((item) => ({
        id: item.material.id,
        originalName: item.material.originalName,
        status: item.material.status,
        clipCount: item.material.clipCount,
      })),
      framingMode: project.framingMode,
      narrationAudioFileName: project.narrationAudioFileName,
      narrationAudioUrl: project.narrationAudioFileName
        ? `/api/video-materials/assembly/files/audio/${encodeURIComponent(project.narrationAudioFileName)}`
        : '',
      outputFileName: project.outputFileName,
      outputUrl: project.outputFileName
        ? `/api/video-materials/assembly/files/outputs/${encodeURIComponent(project.outputFileName)}`
        : '',
      outputStale: Boolean(project.outputFileName && project.status !== 'COMPLETED'),
      durationMs: project.durationMs,
      aiModel: project.aiModel,
      aiInputTokens: project.aiInputTokens,
      aiOutputTokens: project.aiOutputTokens,
      sceneCount: project._count?.scenes ?? project.scenes?.length ?? 0,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      completedAt: project.completedAt?.toISOString() ?? null,
      scenes: includeScenes
        ? (project.scenes ?? []).map((scene) => this.toSceneView(scene))
        : undefined,
    }
  }

  private toSceneView(scene: SceneWithClip) {
    const selectedCandidate = this.readSelectedCandidate(scene)
    return {
      id: scene.id,
      projectId: scene.projectId,
      sceneIndex: scene.sceneIndex,
      narrationText: scene.narrationText,
      targetDurationMs: scene.targetDurationMs,
      visualBrief: scene.visualBrief,
      visualIntent: scene.visualIntent,
      contentTypes: this.readStringArray(scene.contentTypes),
      shotTypes: this.readStringArray(scene.shotTypes),
      keywords: this.readStringArray(scene.keywords),
      negativeKeywords: this.readStringArray(scene.negativeKeywords),
      selectedClipId: scene.selectedClipId,
      clipStartOffsetMs: scene.clipStartOffsetMs,
      clipDurationMs: scene.clipDurationMs,
      matchScore: selectedCandidate && typeof selectedCandidate.score === 'number'
        ? selectedCandidate.score
        : scene.matchScore,
      matchReason: selectedCandidate && typeof selectedCandidate.reason === 'string'
        ? selectedCandidate.reason
        : scene.matchReason,
      candidates: this.readCandidates(scene.candidates),
      warningFlags: this.readSelectedCandidateWarnings(scene),
      status: scene.status,
      selectedClip: scene.selectedClip ? {
        id: scene.selectedClip.id,
        materialId: scene.selectedClip.materialId,
        materialName: scene.selectedClip.material.originalName,
        clipIndex: scene.selectedClip.clipIndex,
        durationMs: scene.selectedClip.durationMs,
        shotType: scene.selectedClip.shotType,
        contentType: scene.selectedClip.contentType,
        description: scene.selectedClip.description,
        keyframeUrl: `/api/video-materials/files/keyframes/${encodeURIComponent(scene.selectedClip.keyframeFileName)}`,
        clipUrl: `/api/video-materials/files/clips/${encodeURIComponent(scene.selectedClip.clipFileName)}`,
        reviewStatus: scene.selectedClip.reviewStatus,
        motionScore: scene.selectedClip.motionScore,
        motionLevel: this.motionLevel(scene.selectedClip.motionScore),
      } : null,
      createdAt: scene.createdAt.toISOString(),
      updatedAt: scene.updatedAt.toISOString(),
    }
  }

  private readCandidates(value: Prisma.JsonValue | null | undefined) {
    if (!Array.isArray(value)) return []
    return value.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
  }

  private readSelectedCandidateWarnings(scene: VideoAssemblyScene) {
    const selected = this.readSelectedCandidate(scene)
    return Array.isArray(selected?.warningFlags) ? selected.warningFlags.map(String) : []
  }

  private readSelectedCandidate(scene: VideoAssemblyScene) {
    return this.readCandidates(scene.candidates).find((candidate) => (
      Number((candidate as Record<string, unknown>).clipId) === scene.selectedClipId
    )) as Record<string, unknown> | undefined
  }

  private readStringArray(value: Prisma.JsonValue | null | undefined) {
    return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : []
  }

  private cleanStringArray(value: string[], limit: number) {
    return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))].slice(0, limit)
  }

  private readJsonObject(value: Prisma.JsonValue | null | undefined) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, Prisma.JsonValue>
      : {}
  }

  private termMatches(searchable: string, term: string) {
    const normalized = term.trim().toLowerCase()
    if (!normalized) return false
    const compactSearchable = searchable.replace(/[\s，。；、！？,:;.!?()（）【】\[\]<>《》]/g, '')
    const compactTerm = normalized.replace(/[\s，。；、！？,:;.!?()（）【】\[\]<>《》]/g, '')
    if (compactSearchable.includes(compactTerm)) return true
    const pieces = normalized.match(/[a-z0-9]+|[\u3400-\u9fff]{2,}/gi) ?? []
    return pieces.length > 1
      && pieces.some((piece) => compactSearchable.includes(piece.toLowerCase()))
  }

  private selectPrimaryKeyword(keywords: string[]) {
    const technical = keywords.find((keyword) => /(?:upf|uva|uvb|spf|pa\+?)/i.test(keyword))
    if (technical) return technical
    return keywords.find((keyword) => {
      const normalized = keyword.trim().toLowerCase()
      return normalized.length >= 2 && !GENERIC_MATCH_KEYWORDS.has(normalized)
    })
  }

  private keywordMatchWeight(keyword: string) {
    const normalized = keyword.trim().toLowerCase()
    if (GENERIC_MATCH_KEYWORDS.has(normalized)) return 3
    if (/(?:upf|uva|uvb|spf|pa\+?)/i.test(normalized)) return 11
    if (normalized.length >= 4) return 9
    return 7
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

  private audioContentType(extension: string) {
    const types: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.flac': 'audio/flac',
      '.ogg': 'audio/ogg',
    }
    return types[extension.toLowerCase()] || 'application/octet-stream'
  }
}
