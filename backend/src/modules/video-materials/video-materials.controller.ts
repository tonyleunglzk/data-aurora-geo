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
  AnalyzeVideoMaterialDto,
  ConfirmVideoMaterialClipsDto,
  ReprocessVideoMaterialDto,
  UpdateVideoMaterialClipDto,
  UploadVideoMaterialDto,
} from './dto/video-material.dto'
import { VideoMaterialsService } from './video-materials.service'

const uploadStagingDirectory = join(tmpdir(), 'data-aurora-video-material-uploads')
mkdirSync(uploadStagingDirectory, { recursive: true })

type UploadedVideoFile = {
  fieldname: string
  originalname: string
  encoding: string
  mimetype: string
  destination: string
  filename: string
  path: string
  size: number
}

@Controller('video-materials')
export class VideoMaterialsController {
  constructor(private readonly videoMaterialsService: VideoMaterialsService) {}

  @Get('taxonomy')
  findTaxonomy() {
    return this.videoMaterialsService.findTaxonomy()
  }

  @Get('ai-configuration')
  findAiConfiguration() {
    return this.videoMaterialsService.findAiConfiguration()
  }

  @Get('materials')
  findMaterials(@Query('productCategory') productCategory?: string) {
    return this.videoMaterialsService.findMaterials(productCategory)
  }

  @Post('materials/upload')
  @UseInterceptors(FileInterceptor('file', {
    dest: uploadStagingDirectory,
    limits: {
      fileSize: 4 * 1024 * 1024 * 1024,
      files: 1,
    },
  }))
  uploadMaterial(
    @UploadedFile() file: UploadedVideoFile | undefined,
    @Body() payload: UploadVideoMaterialDto
  ) {
    return this.videoMaterialsService.storeUploadedVideo(file, payload)
  }

  @Get('materials/:id')
  findMaterial(@Param('id', ParseIntPipe) id: number) {
    return this.videoMaterialsService.findMaterial(id)
  }

  @Post('materials/:id/reprocess')
  reprocessMaterial(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: ReprocessVideoMaterialDto
  ) {
    return this.videoMaterialsService.reprocessMaterial(id, payload)
  }

  @Post('materials/:id/segmentation-preview')
  previewSegmentation(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: ReprocessVideoMaterialDto
  ) {
    return this.videoMaterialsService.previewSegmentation(id, payload)
  }

  @Post('materials/:id/analyze')
  analyzeMaterial(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: AnalyzeVideoMaterialDto
  ) {
    return this.videoMaterialsService.analyzeMaterial(id, payload)
  }

  @Post('materials/:id/analyze-preview')
  previewAiAnalysis(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: AnalyzeVideoMaterialDto
  ) {
    return this.videoMaterialsService.previewAiAnalysis(id, payload)
  }

  @Post('materials/:id/confirm-ai')
  confirmAiClips(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: ConfirmVideoMaterialClipsDto
  ) {
    return this.videoMaterialsService.confirmAiClips(id, payload)
  }

  @Delete('materials/:id')
  removeMaterial(@Param('id', ParseIntPipe) id: number) {
    return this.videoMaterialsService.removeMaterial(id)
  }

  @Patch('clips/:id')
  updateClip(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateVideoMaterialClipDto
  ) {
    return this.videoMaterialsService.updateClip(id, payload)
  }

  @Get('files/:kind/:fileName')
  serveFile(
    @Param('kind') kind: string,
    @Param('fileName') fileName: string,
    @Res() response: Response
  ) {
    const file = this.videoMaterialsService.resolveStoredFile(kind, fileName)
    return response.sendFile(file.path, {
      headers: {
        'Content-Type': file.contentType,
        'Cache-Control': 'no-cache',
      },
    })
  }
}
