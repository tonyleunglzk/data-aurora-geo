import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CreateVideoAssemblyProjectDto,
  MatchVideoAssemblyProjectDto,
  UpdateVideoAssemblyProjectDto,
  UpdateVideoAssemblySceneDto,
} from './dto/video-assembly.dto'
import { VideoAssemblyService } from './video-assembly.service'

const audioStagingDirectory = join(tmpdir(), 'data-aurora-video-assembly-audio')
mkdirSync(audioStagingDirectory, { recursive: true })

type UploadedAudioFile = {
  originalname: string
  mimetype: string
  path: string
  size: number
}

@Controller('video-materials/assembly')
export class VideoAssemblyController {
  constructor(private readonly videoAssemblyService: VideoAssemblyService) {}

  @Get('runtime-health')
  runtimeHealth() {
    return this.videoAssemblyService.runtimeHealth()
  }

  @Get('projects')
  findProjects(@Query('productCategory') productCategory?: string) {
    return this.videoAssemblyService.findProjects(productCategory)
  }

  @Post('projects')
  createProject(@Body() payload: CreateVideoAssemblyProjectDto) {
    return this.videoAssemblyService.createProject(payload)
  }

  @Get('projects/:id')
  findProject(@Param('id', ParseIntPipe) id: number) {
    return this.videoAssemblyService.findProject(id)
  }

  @Patch('projects/:id')
  updateProject(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateVideoAssemblyProjectDto
  ) {
    return this.videoAssemblyService.updateProject(id, payload)
  }

  @Delete('projects/:id')
  removeProject(@Param('id', ParseIntPipe) id: number) {
    return this.videoAssemblyService.removeProject(id)
  }

  @Post('projects/:id/plan')
  planProject(@Param('id', ParseIntPipe) id: number) {
    return this.videoAssemblyService.planProject(id)
  }

  @Post('projects/:id/match')
  matchProject(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: MatchVideoAssemblyProjectDto
  ) {
    return this.videoAssemblyService.matchProject(id, payload)
  }

  @Post('projects/:id/audio')
  @UseInterceptors(FileInterceptor('audio', {
    dest: audioStagingDirectory,
    limits: { fileSize: 500 * 1024 * 1024, files: 1 },
  }))
  uploadNarrationAudio(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: UploadedAudioFile | undefined
  ) {
    return this.videoAssemblyService.uploadNarrationAudio(id, file)
  }

  @Post('projects/:id/render')
  renderProject(@Param('id', ParseIntPipe) id: number) {
    return this.videoAssemblyService.renderProject(id)
  }

  @Patch('scenes/:id')
  updateScene(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateVideoAssemblySceneDto
  ) {
    return this.videoAssemblyService.updateScene(id, payload)
  }

  @Get('files/:kind/:fileName')
  serveFile(
    @Param('kind') kind: string,
    @Param('fileName') fileName: string,
    @Res() response: Response
  ) {
    const file = this.videoAssemblyService.resolveStoredFile(kind, fileName)
    return response.sendFile(file.path, {
      headers: {
        'Content-Type': file.contentType,
        'Cache-Control': 'no-cache',
      },
    })
  }
}
