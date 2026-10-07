import { BadRequestException, Injectable } from '@nestjs/common'
import type {
  VideoAssemblyProject,
  VideoAssemblyScene,
  VideoMaterial,
  VideoMaterialClip,
} from '@prisma/client'
import { spawn } from 'node:child_process'
import { accessSync, constants, existsSync, mkdirSync } from 'node:fs'
import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import sharp = require('sharp')

type RenderScene = VideoAssemblyScene & {
  selectedClip: (VideoMaterialClip & { material: VideoMaterial }) | null
}

type RenderProject = VideoAssemblyProject & {
  scenes: RenderScene[]
}

type RenderResult = {
  outputFileName: string
  outputPath: string
  durationMs: number
  metadata: Record<string, unknown>
}

@Injectable()
export class VideoAssemblyRendererService {
  private readonly storageRoot: string
  private readonly clipDirectory: string
  private readonly outputDirectory: string
  private readonly ffmpegPath: string
  private readonly ffprobePath: string

  constructor() {
    this.storageRoot = resolve(
      process.env.VIDEO_MATERIAL_STORAGE_ROOT?.trim()
        || join(process.cwd(), 'storage', 'video-materials')
    )
    this.clipDirectory = join(this.storageRoot, 'clips')
    this.outputDirectory = join(this.storageRoot, 'assembly-outputs')
    this.ffmpegPath = this.resolveBinary('FFMPEG_PATH', 'ffmpeg')
    this.ffprobePath = this.resolveBinary('FFPROBE_PATH', 'ffprobe')
    mkdirSync(this.outputDirectory, { recursive: true })
  }

  async probeDuration(inputPath: string) {
    const probe = await this.probeMedia(inputPath)
    return probe.durationMs
  }

  async probeAudio(inputPath: string) {
    const probe = await this.probeMedia(inputPath)
    if (!probe.hasAudio) throw new BadRequestException('所选文件没有可用音轨')
    if (probe.durationMs < 500) throw new BadRequestException('旁白音频短于 0.5 秒，无法使用')
    if (probe.durationMs > 3 * 60 * 60 * 1000) {
      throw new BadRequestException('旁白音频不能超过 3 小时')
    }
    return probe
  }

  async runtimeHealth() {
    const checks: Record<string, unknown> = {
      ffmpegPath: this.ffmpegPath,
      ffprobePath: this.ffprobePath,
      outputDirectory: this.outputDirectory,
      sharpVersion: sharp.versions?.sharp || 'unknown',
    }
    const errors: string[] = []
    try {
      accessSync(this.outputDirectory, constants.R_OK | constants.W_OK)
      checks.storageWritable = true
    } catch {
      checks.storageWritable = false
      errors.push('成片目录不可读写')
    }
    try {
      const version = await this.runProcess(this.ffmpegPath, ['-version'], 5000)
      checks.ffmpegVersion = version.stdout.split('\n')[0] || 'unknown'
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'FFmpeg 不可用')
    }
    try {
      const version = await this.runProcess(this.ffprobePath, ['-version'], 5000)
      checks.ffprobeVersion = version.stdout.split('\n')[0] || 'unknown'
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'FFprobe 不可用')
    }
    try {
      await sharp({
        create: { width: 2, height: 2, channels: 4, background: '#ffffff' },
      }).png().toBuffer()
      checks.sharpReady = true
    } catch (error) {
      checks.sharpReady = false
      errors.push(error instanceof Error ? error.message : 'Sharp 不可用')
    }
    return { ready: errors.length === 0, checks, errors }
  }

  private async probeMedia(inputPath: string) {
    const output = await this.runProcess(this.ffprobePath, [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      inputPath,
    ])
    const payload = JSON.parse(output.stdout || '{}')
    const streams = Array.isArray(payload?.streams) ? payload.streams : []
    const audioStream = streams.find((stream: any) => stream?.codec_type === 'audio')
    const videoStream = streams.find((stream: any) => stream?.codec_type === 'video')
    return {
      durationMs: Math.max(0, Math.round(Number(payload?.format?.duration || 0) * 1000)),
      hasAudio: Boolean(audioStream),
      hasVideo: Boolean(videoStream),
      width: Math.max(0, Number(videoStream?.width || 0)),
      height: Math.max(0, Number(videoStream?.height || 0)),
      audioCodec: String(audioStream?.codec_name || ''),
      sampleRate: Number(audioStream?.sample_rate || 0),
      channels: Number(audioStream?.channels || 0),
    }
  }

  async render(
    project: RenderProject,
    onProgress: (progress: number, stage: string) => Promise<void>
  ): Promise<RenderResult> {
    if (!project.scenes.length) throw new BadRequestException('项目没有可渲染的旁白分段')
    if (project.scenes.some((scene) => !scene.selectedClip)) {
      throw new BadRequestException('部分旁白分段还没有选择素材')
    }
    this.ensureFfmpegAvailable()

    const tempDirectory = await mkdtemp(join(tmpdir(), `data-aurora-assembly-${project.id}-`))
    const outputFileName = `${project.id}-${Date.now()}.mp4`
    const outputPath = join(this.outputDirectory, outputFileName)
    try {
      const dimensions = this.outputDimensions(project.aspectRatio)
      const audioDurationMs = project.narrationAudioPath
        ? await this.probeDuration(project.narrationAudioPath)
        : 0
      const durations = this.allocateDurations(
        project.scenes.map((scene) => scene.targetDurationMs),
        audioDurationMs
      )
      const scenePaths: string[] = []
      const sceneFramingModes: string[] = []

      for (let index = 0; index < project.scenes.length; index += 1) {
        const scene = project.scenes[index]
        const clip = scene.selectedClip!
        const inputPath = join(this.clipDirectory, clip.clipFileName)
        if (!existsSync(inputPath)) {
          throw new Error(`镜头 ${scene.sceneIndex} 的素材文件不存在`)
        }
        const scenePath = join(tempDirectory, `scene-${String(index + 1).padStart(4, '0')}.mp4`)
        const subtitlePath = join(tempDirectory, `subtitle-${String(index + 1).padStart(4, '0')}.png`)
        await this.createSubtitleImage(
          subtitlePath,
          scene.narrationText,
          dimensions.width,
          dimensions.height
        )
        const framingMode = this.resolveSceneFramingMode(
          project.framingMode,
          scene,
          dimensions.width,
          dimensions.height
        )
        await this.renderScene({
          inputPath,
          subtitlePath,
          outputPath: scenePath,
          durationMs: durations[index],
          startOffsetMs: Math.max(0, scene.clipStartOffsetMs),
          width: dimensions.width,
          height: dimensions.height,
          removeSourceSubtitles: project.removeSourceSubtitles,
          framingMode,
        })
        scenePaths.push(scenePath)
        sceneFramingModes.push(framingMode)
        await onProgress(
          5 + Math.round(((index + 1) / project.scenes.length) * 78),
          `渲染镜头 ${index + 1}/${project.scenes.length}`
        )
      }

      const concatListPath = join(tempDirectory, 'concat.txt')
      const silentVideoPath = join(tempDirectory, 'silent.mp4')
      await writeFile(
        concatListPath,
        scenePaths.map((path) => `file '${path.replace(/'/g, "'\\''")}'`).join('\n'),
        'utf8'
      )
      await onProgress(87, '拼接全部镜头')
      await this.runProcess(this.ffmpegPath, [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'concat', '-safe', '0', '-i', concatListPath,
        '-c', 'copy', '-movflags', '+faststart', silentVideoPath,
      ])

      if (project.narrationAudioPath) {
        await onProgress(94, '合入新旁白音频')
        await this.runProcess(this.ffmpegPath, [
          '-hide_banner', '-loglevel', 'error', '-y',
          '-i', silentVideoPath,
          '-i', project.narrationAudioPath,
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-shortest',
          '-movflags', '+faststart',
          outputPath,
        ])
      } else {
        await rename(silentVideoPath, outputPath)
      }

      const durationMs = await this.probeDuration(outputPath)
      return {
        outputFileName,
        outputPath,
        durationMs,
        metadata: {
          aspectRatio: project.aspectRatio,
          width: dimensions.width,
          height: dimensions.height,
          fps: 25,
          sceneDurationsMs: durations,
          framingMode: project.framingMode,
          sceneFramingModes,
          narrationAudio: Boolean(project.narrationAudioPath),
          sourceAudioRemoved: true,
          sourceSubtitleAreaBlurred: project.removeSourceSubtitles,
          newSceneSubtitles: true,
        },
      }
    } catch (error) {
      await rm(outputPath, { force: true }).catch(() => undefined)
      throw error
    } finally {
      await rm(tempDirectory, { recursive: true, force: true }).catch(() => undefined)
    }
  }

  private async renderScene(input: {
    inputPath: string
    subtitlePath: string
    outputPath: string
    durationMs: number
    startOffsetMs: number
    width: number
    height: number
    removeSourceSubtitles: boolean
    framingMode: 'FILL_CROP' | 'FIT_BLUR'
  }) {
    const durationSeconds = (Math.max(1000, input.durationMs) / 1000).toFixed(3)
    const startSeconds = (input.startOffsetMs / 1000).toFixed(3)
    const adaptation = input.framingMode === 'FIT_BLUR'
      ? [
        '[0:v]split=2[background_source][foreground_source]',
        `[background_source]scale=${input.width}:${input.height}:force_original_aspect_ratio=increase,crop=${input.width}:${input.height},boxblur=28:2[background]`,
        `[foreground_source]scale=${input.width}:${input.height}:force_original_aspect_ratio=decrease[foreground]`,
        '[background][foreground]overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2,fps=25,setsar=1[adapted]',
      ]
      : [
        `[0:v]scale=${input.width}:${input.height}:force_original_aspect_ratio=increase,crop=${input.width}:${input.height},fps=25,setsar=1[adapted]`,
      ]
    const finishing = input.removeSourceSubtitles
      ? [
        '[adapted]split=2[base][region]',
        '[region]crop=iw:ih*0.38:0:ih*0.62,boxblur=18:2[blurred]',
        '[base][blurred]overlay=0:main_h*0.62[clean]',
        '[1:v]format=rgba[subtitle]',
        '[clean][subtitle]overlay=0:0:format=auto[v]',
      ].join(';')
      : [
        '[adapted]null[clean]',
        '[1:v]format=rgba[subtitle]',
        '[clean][subtitle]overlay=0:0:format=auto[v]',
      ].join(';')
    const filter = [...adaptation, finishing].join(';')

    await this.runProcess(this.ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-stream_loop', '-1',
      '-ss', startSeconds,
      '-i', input.inputPath,
      '-loop', '1',
      '-i', input.subtitlePath,
      '-t', durationSeconds,
      '-filter_complex', filter,
      '-map', '[v]',
      '-an',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '21',
      '-pix_fmt', 'yuv420p',
      '-r', '25',
      '-movflags', '+faststart',
      input.outputPath,
    ])
  }

  private resolveSceneFramingMode(
    requestedMode: string,
    scene: RenderScene,
    outputWidth: number,
    outputHeight: number
  ): 'FILL_CROP' | 'FIT_BLUR' {
    if (requestedMode === 'FIT_BLUR') return 'FIT_BLUR'
    if (requestedMode === 'FILL_CROP') return 'FILL_CROP'
    const clip = scene.selectedClip
    if (!clip) return 'FILL_CROP'
    const sourceWidth = clip.material.width
    const sourceHeight = clip.material.height
    if (!sourceWidth || !sourceHeight) return 'FILL_CROP'
    const sourceRatio = sourceWidth / sourceHeight
    const outputRatio = outputWidth / outputHeight
    if (Math.abs(Math.log(sourceRatio / outputRatio)) < 0.14) return 'FILL_CROP'
    const isPortraitOutput = outputRatio < 0.85
    const isLandscapeSource = sourceRatio > 1.15
    const needsCompleteFrame = ['DATA_GRAPHIC', 'SCREEN_CONTENT', 'TITLE_CARD', 'MONTAGE']
      .includes(clip.shotType)
    return isPortraitOutput && isLandscapeSource && needsCompleteFrame
      ? 'FIT_BLUR'
      : 'FILL_CROP'
  }

  private async createSubtitleImage(
    outputPath: string,
    narrationText: string,
    width: number,
    height: number
  ) {
    const maxCharacters = width > height ? 26 : 16
    const lines = this.wrapSubtitle(narrationText, maxCharacters).slice(0, 4)
    const fontSize = width > height ? 34 : 36
    const lineHeight = Math.round(fontSize * 1.45)
    const blockHeight = lines.length * lineHeight + 34
    const y = Math.round(height * 0.78)
    const panelY = Math.min(height - blockHeight - 24, y - 18)
    const panelWidth = Math.round(width * 0.88)
    const panelX = Math.round((width - panelWidth) / 2)
    const tspans = lines.map((line, index) =>
      `<tspan x="${width / 2}" dy="${index === 0 ? 0 : lineHeight}">${this.escapeXml(line)}</tspan>`
    ).join('')
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="${panelX}" y="${panelY}" width="${panelWidth}" height="${blockHeight}" rx="8" fill="#171214" fill-opacity="0.72"/>
        <text x="${width / 2}" y="${panelY + 28 + fontSize}" text-anchor="middle" font-family="PingFang SC, Noto Sans CJK SC, Microsoft YaHei, sans-serif" font-size="${fontSize}" font-weight="700" fill="#ffffff" stroke="#171214" stroke-width="1.2" paint-order="stroke" letter-spacing="0">${tspans}</text>
      </svg>
    `
    await sharp(Buffer.from(svg)).png().toFile(outputPath)
  }

  private wrapSubtitle(value: string, maxCharacters: number) {
    const text = value.replace(/\s+/g, '').trim()
    if (!text) return ['']
    const lines: string[] = []
    let remaining = text
    while (remaining.length > maxCharacters) {
      const window = remaining.slice(0, maxCharacters + 1)
      const punctuation = Math.max(
        window.lastIndexOf('，'),
        window.lastIndexOf('。'),
        window.lastIndexOf('；'),
        window.lastIndexOf('、'),
        window.lastIndexOf('！'),
        window.lastIndexOf('？')
      )
      const cut = punctuation >= Math.round(maxCharacters * 0.55)
        ? punctuation + 1
        : maxCharacters
      lines.push(remaining.slice(0, cut))
      remaining = remaining.slice(cut)
    }
    if (remaining) lines.push(remaining)
    if (lines.length <= 4) return lines
    return [...lines.slice(0, 3), `${lines.slice(3).join('').slice(0, maxCharacters - 1)}…`]
  }

  private allocateDurations(targetDurations: number[], audioDurationMs: number) {
    const safeTargets = targetDurations.map((value) => Math.max(1000, Math.round(value || 5000)))
    if (!audioDurationMs) return safeTargets
    const targetTotal = safeTargets.reduce((sum, value) => sum + value, 0)
    if (!targetTotal) return safeTargets
    const allocated = safeTargets.map((value) => Math.max(1000, Math.round(value * audioDurationMs / targetTotal)))
    const difference = audioDurationMs - allocated.reduce((sum, value) => sum + value, 0)
    allocated[allocated.length - 1] = Math.max(1000, allocated[allocated.length - 1] + difference)
    return allocated
  }

  private outputDimensions(aspectRatio: string) {
    if (aspectRatio === '16:9') return { width: 1280, height: 720 }
    if (aspectRatio === '1:1') return { width: 720, height: 720 }
    return { width: 720, height: 1280 }
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
        const detail = stderr.trim().split('\n').slice(-8).join(' ')
        reject(new Error(detail || `${basename(command)} 执行失败（${code ?? 'unknown'}）`))
      })
    })
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

  private escapeXml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }
}
