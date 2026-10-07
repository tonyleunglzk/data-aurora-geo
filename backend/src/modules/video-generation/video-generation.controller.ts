import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
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
import { VideoGenerationService } from './video-generation.service'

type UploadedVideoGenerationImageFile = {
  buffer: Buffer
  originalname: string
  mimetype: string
  size: number
}

@Controller('video-generation')
export class VideoGenerationController {
  constructor(private readonly videoGenerationService: VideoGenerationService) {}

  @Get('templates')
  findTemplates() {
    return this.videoGenerationService.findTemplates()
  }

  @Post('templates')
  createTemplate(@Body() payload: CreateVideoGenerationTemplateDto) {
    return this.videoGenerationService.createTemplate(payload)
  }

  @Patch('templates/:id')
  updateTemplate(@Param('id', ParseIntPipe) id: number, @Body() payload: UpdateVideoGenerationTemplateDto) {
    return this.videoGenerationService.updateTemplate(id, payload)
  }

  @Get('assets')
  findAssets(@Query() query: Record<string, unknown>) {
    return this.videoGenerationService.findAssets(query)
  }

  @Post('assets/plan')
  planAssets(@Body() payload: PlanVideoGenerationAssetsDto) {
    return this.videoGenerationService.planAssetsForProduct(payload)
  }

  @Post('assets')
  createAsset(@Body() payload: CreateVideoGenerationAssetDto) {
    return this.videoGenerationService.createAsset(payload)
  }

  @Patch('assets/:id')
  updateAsset(@Param('id', ParseIntPipe) id: number, @Body() payload: UpdateVideoGenerationAssetDto) {
    return this.videoGenerationService.updateAsset(id, payload)
  }

  @Post('assets/:id/generate-image')
  generateImageAsset(@Param('id', ParseIntPipe) id: number, @Body() payload: GenerateVideoAssetImageDto) {
    return this.videoGenerationService.generateImageAsset(id, payload)
  }

  @Post('uploads/image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  uploadImage(@UploadedFile() file?: UploadedVideoGenerationImageFile) {
    return this.videoGenerationService.storeUploadedImage(file)
  }

  @Get('storyboards')
  findStoryboards(@Query() query: Record<string, unknown>) {
    return this.videoGenerationService.findStoryboards(query)
  }

  @Post('storyboards/generate')
  generateStoryboard(@Body() payload: GenerateVideoStoryboardDto) {
    return this.videoGenerationService.generateStoryboard(payload)
  }

  @Get('campaigns')
  findCampaigns(@Query() query: Record<string, unknown>) {
    return this.videoGenerationService.findCampaigns(query)
  }

  @Post('campaigns')
  createCampaign(@Body() payload: CreateVideoGenerationCampaignDto) {
    return this.videoGenerationService.createCampaign(payload)
  }

  @Get('campaigns/:id')
  findCampaign(@Param('id', ParseIntPipe) id: number) {
    return this.videoGenerationService.findCampaign(id)
  }

  @Post('campaigns/:id/tasks')
  createCampaignTasks(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: CreateVideoGenerationCampaignTasksDto
  ) {
    return this.videoGenerationService.createCampaignTasks(id, payload)
  }

  @Post('tasks')
  createTask(@Body() payload: CreateVideoGenerationTaskDto) {
    return this.videoGenerationService.createTask(payload)
  }

  @Post('tasks/import')
  importTask(@Body() payload: ImportVideoGenerationTaskDto) {
    return this.videoGenerationService.importTask(payload)
  }

  @Post('tasks/refresh-running')
  refreshRunningTasks() {
    return this.videoGenerationService.refreshRunningTasks()
  }

  @Get('tasks/recent')
  findRecentTasks(@Query() query: Record<string, unknown>) {
    return this.videoGenerationService.findRecentTasks(query)
  }

  @Post('tasks/callback')
  handleTaskCallback(@Body() payload: unknown) {
    return this.videoGenerationService.handleTaskCallback(payload)
  }

  @Post('tasks/:id/refresh')
  refreshTask(@Param('id') id: string) {
    return this.videoGenerationService.refreshTask(id)
  }

  @Get('tasks/:id')
  findTask(@Param('id') id: string) {
    return this.videoGenerationService.findTask(id)
  }

  @Get('files/:category/:fileName')
  serveFile(@Param('category') category: string, @Param('fileName') fileName: string, @Res() response: Response) {
    const file = this.videoGenerationService.resolveStoredFile(category, fileName)
    return response.sendFile(file.path, {
      headers: {
        'Content-Type': file.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }
}
