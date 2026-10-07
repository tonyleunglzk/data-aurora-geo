import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Request, Response } from 'express'
import { ActivateGeoRuleCardDto } from './dto/activate-geo-rule-card.dto'
import { CreateGeoPromptBatchDto } from './dto/create-geo-prompt-batch.dto'
import { CreateGeoPromptEngineVersionDraftSessionDto } from './dto/create-geo-prompt-engine-version-draft-session.dto'
import { CreateGeoPromptEngineVersionDto } from './dto/create-geo-prompt-engine-version.dto'
import { CreateGeoPublicationCrawlJobDto } from './dto/create-geo-publication-crawl-job.dto'
import { CreateGeoPublicationCrawlKeywordDto } from './dto/create-geo-publication-crawl-keyword.dto'
import { CreateGeoPublicationOptionDto } from './dto/create-geo-publication-option.dto'
import { CreateGeoPublicationRecordDto } from './dto/create-geo-publication-record.dto'
import { CreateSerpResearchProjectDto } from './dto/create-serp-research-project.dto'
import { CreateGeoProfileDto } from './dto/create-geo-profile.dto'
import { FindGeoAiSummariesQueryDto } from './dto/find-geo-ai-summaries-query.dto'
import { FindGeoPromptCodeOptionsQueryDto } from './dto/find-geo-prompt-code-options-query.dto'
import { FindGeoPublicationCrawlJobsQueryDto } from './dto/find-geo-publication-crawl-jobs-query.dto'
import { FindGeoPublicationRecordsQueryDto } from './dto/find-geo-publication-records-query.dto'
import { FindGeoRuleCardsQueryDto } from './dto/find-geo-rule-cards-query.dto'
import { GenerateGeoPromptDto } from './dto/generate-geo-prompt.dto'
import { GenerateGeoPromptV2Dto } from './dto/generate-geo-prompt-v2.dto'
import { GenerateGeoRuleCardDto } from './dto/generate-geo-rule-card.dto'
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
import { GeoService } from './geo.service'

type UploadedPublicationImportFile = {
  buffer: Buffer
  originalname: string
  mimetype: string
  size: number
}

@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('profiles')
  findProfiles() {
    return this.geoService.findProfiles()
  }

  @Post('profiles')
  createProfile(@Body() payload: CreateGeoProfileDto) {
    return this.geoService.createProfile(payload)
  }

  @Patch('profiles/:id')
  updateProfile(@Param('id', ParseIntPipe) id: number, @Body() payload: UpdateGeoProfileDto) {
    return this.geoService.updateProfile(id, payload)
  }

  @Delete('profiles/:id')
  removeProfile(@Param('id', ParseIntPipe) id: number) {
    return this.geoService.removeProfile(id)
  }

  @Get('provider-config')
  findProviderConfig() {
    return this.geoService.findProviderConfig()
  }

  @Put('provider-config')
  updateProviderConfig(@Body() payload: UpdateGeoProviderConfigDto) {
    return this.geoService.updateProviderConfig(payload)
  }

  @Get('prompt-engine-v2/fixed-rules')
  findPromptEngineV2FixedRules() {
    return this.geoService.findPromptEngineV2FixedRules()
  }

  @Get('prompt-engine-legacy/rules')
  findLegacyPromptEngineRules() {
    return this.geoService.findLegacyPromptEngineRules()
  }

  @Put('prompt-engine-v2/fixed-rules')
  updatePromptEngineV2FixedRules(@Body() payload: UpdateGeoPromptEngineV2FixedRulesDto) {
    return this.geoService.updatePromptEngineV2FixedRules(payload)
  }

  @Get('prompt-engine-v2/versions')
  findPromptEngineV2Versions() {
    return this.geoService.findPromptEngineV2Versions()
  }

  @Post('prompt-engine-v2/versions')
  createPromptEngineV2Version(@Body() payload: CreateGeoPromptEngineVersionDto) {
    return this.geoService.createPromptEngineV2Version(payload)
  }

  @Patch('prompt-engine-v2/versions/:id')
  updatePromptEngineV2Version(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateGeoPromptEngineVersionDto
  ) {
    return this.geoService.updatePromptEngineV2Version(id, payload)
  }

  @Delete('prompt-engine-v2/versions/:id')
  removePromptEngineV2Version(@Param('id', ParseIntPipe) id: number) {
    return this.geoService.removePromptEngineV2Version(id)
  }

  @Get('prompt-engine-v2/version-draft-sessions')
  findPromptEngineV2VersionDraftSessions() {
    return this.geoService.findPromptEngineV2VersionDraftSessions()
  }

  @Get('prompt-engine-v2/version-draft-sessions/:id')
  findPromptEngineV2VersionDraftSession(@Param('id', ParseIntPipe) id: number) {
    return this.geoService.findPromptEngineV2VersionDraftSession(id)
  }

  @Post('prompt-engine-v2/version-draft-sessions')
  createPromptEngineV2VersionDraftSession(
    @Body() payload: CreateGeoPromptEngineVersionDraftSessionDto
  ) {
    return this.geoService.createPromptEngineV2VersionDraftSession(payload)
  }

  @Patch('prompt-engine-v2/version-draft-sessions/:id')
  updatePromptEngineV2VersionDraftSession(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateGeoPromptEngineVersionDraftSessionDto
  ) {
    return this.geoService.updatePromptEngineV2VersionDraftSession(id, payload)
  }

  @Delete('prompt-engine-v2/version-draft-sessions/:id')
  removePromptEngineV2VersionDraftSession(@Param('id', ParseIntPipe) id: number) {
    return this.geoService.removePromptEngineV2VersionDraftSession(id)
  }

  @Post('prompt-engine-v2/version-draft-sessions/:id/chat/stream')
  async streamPromptEngineV2VersionDraftSessionChat(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request,
    @Res() response: Response
  ) {
    await this.geoService.streamPromptEngineV2VersionDraftSessionChat(id, request, response)
  }

  @Post('prompt-engine-v2/version-draft-sessions/:id/apply')
  applyPromptEngineV2VersionDraftSession(@Param('id', ParseIntPipe) id: number) {
    return this.geoService.applyPromptEngineV2VersionDraftSession(id)
  }

  @Post('prompt-engine-v2/version-drafts/chat/stream')
  async streamPromptEngineV2VersionDraftChat(
    @Body() payload: StreamGeoPromptEngineVersionDraftChatDto,
    @Req() request: Request,
    @Res() response: Response
  ) {
    await this.geoService.streamPromptEngineV2VersionDraftChat(payload, request, response)
  }

  @Post('prompt-engine-v2/version-drafts/chat/apply')
  applyPromptEngineV2VersionDraftChat(@Body() payload: StreamGeoPromptEngineVersionDraftChatDto) {
    return this.geoService.applyPromptEngineV2VersionDraftChat(payload)
  }

  @Post('prompt-engine-v2/version-drafts/import')
  importPromptEngineV2VersionDraft(@Body() payload: ImportGeoPromptEngineVersionDraftDto) {
    return this.geoService.importPromptEngineV2VersionDraft(payload)
  }

  @Get('publication-records')
  findPublicationRecords(@Query() query: FindGeoPublicationRecordsQueryDto) {
    return this.geoService.findPublicationRecords(query)
  }

  @Get('publication-stats')
  findPublicationStats(@Query() query: FindGeoPublicationRecordsQueryDto) {
    return this.geoService.findPublicationStats(query)
  }

  @Post('publication-records')
  createPublicationRecord(@Body() payload: CreateGeoPublicationRecordDto) {
    return this.geoService.createPublicationRecord(payload)
  }

  @Post('publication-records/import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  importPublicationRecords(@UploadedFile() file?: UploadedPublicationImportFile) {
    return this.geoService.importPublicationRecords(file)
  }

  @Patch('publication-records/:id')
  updatePublicationRecord(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateGeoPublicationRecordDto
  ) {
    return this.geoService.updatePublicationRecord(id, payload)
  }

  @Delete('publication-records/:id')
  removePublicationRecord(@Param('id', ParseIntPipe) id: number) {
    return this.geoService.removePublicationRecord(id)
  }

  @Get('publication-options')
  findPublicationOptions() {
    return this.geoService.findPublicationOptions()
  }

  @Post('publication-options')
  createPublicationOption(@Body() payload: CreateGeoPublicationOptionDto) {
    return this.geoService.createPublicationOption(payload)
  }

  @Get('prompt-code-options')
  findPromptCodeOptions(@Query() query: FindGeoPromptCodeOptionsQueryDto) {
    return this.geoService.findPromptCodeOptions(query)
  }

  @Get('publication-crawl/settings')
  findPublicationCrawlSetting() {
    return this.geoService.findPublicationCrawlSetting()
  }

  @Put('publication-crawl/settings')
  updatePublicationCrawlSetting(@Body() payload: UpdateGeoPublicationCrawlSettingDto) {
    return this.geoService.updatePublicationCrawlSetting(payload)
  }

  @Get('publication-crawl/keywords')
  findPublicationCrawlKeywords() {
    return this.geoService.findPublicationCrawlKeywords()
  }

  @Post('publication-crawl/keywords')
  createPublicationCrawlKeyword(@Body() payload: CreateGeoPublicationCrawlKeywordDto) {
    return this.geoService.createPublicationCrawlKeyword(payload)
  }

  @Patch('publication-crawl/keywords/:id')
  updatePublicationCrawlKeyword(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateGeoPublicationCrawlKeywordDto
  ) {
    return this.geoService.updatePublicationCrawlKeyword(id, payload)
  }

  @Delete('publication-crawl/keywords/:id')
  removePublicationCrawlKeyword(@Param('id', ParseIntPipe) id: number) {
    return this.geoService.removePublicationCrawlKeyword(id)
  }

  @Post('publication-crawl/jobs')
  createPublicationCrawlJob(@Body() payload: CreateGeoPublicationCrawlJobDto) {
    return this.geoService.createPublicationCrawlJob(payload)
  }

  @Get('publication-crawl/jobs')
  findPublicationCrawlJobs(@Query() query: FindGeoPublicationCrawlJobsQueryDto) {
    return this.geoService.findPublicationCrawlJobs(query)
  }

  @Get('publication-crawl/jobs/:id')
  findPublicationCrawlJob(@Param('id', ParseIntPipe) id: number) {
    return this.geoService.findPublicationCrawlJob(id)
  }

  @Post('prompt-engine-batches')
  createPromptBatch(@Body() payload: CreateGeoPromptBatchDto) {
    return this.geoService.createPromptBatch(payload)
  }

  @Get('prompt-engine-batches')
  findPromptBatches() {
    return this.geoService.findPromptBatches()
  }

  @Get('prompt-engine-batches/:id/download')
  async downloadPromptBatch(@Param('id', ParseIntPipe) id: number, @Res() response: Response) {
    await this.geoService.downloadPromptBatch(id, response)
  }

  @Get('prompt-engine-batches/:id')
  findPromptBatch(@Param('id', ParseIntPipe) id: number) {
    return this.geoService.findPromptBatch(id)
  }

  @Get('serp-projects')
  findSerpProjects() {
    return this.geoService.findSerpProjects()
  }

  @Get('serp-projects/:id')
  findSerpProject(@Param('id', ParseIntPipe) id: number) {
    return this.geoService.findSerpProject(id)
  }

  @Get('serp-projects/:id/ai-summary')
  findSerpProjectAiSummary(@Param('id', ParseIntPipe) id: number) {
    return this.geoService.findSerpProjectAiSummary(id)
  }

  @Post('serp-projects')
  createSerpProject(@Body() payload: CreateSerpResearchProjectDto) {
    return this.geoService.createSerpProject(payload)
  }

  @Post('serp-projects/:id/ai-summary')
  generateSerpProjectAiSummary(@Param('id', ParseIntPipe) id: number) {
    return this.geoService.generateSerpProjectAiSummary(id)
  }

  @Post('serp-projects/:id/ai-summary/stream')
  async streamSerpProjectAiSummary(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request,
    @Res() response: Response
  ) {
    await this.geoService.streamSerpProjectAiSummary(id, request, response)
  }

  @Post('serp-projects/:id/ai-summary/test-stream')
  async streamSerpProjectAiSummaryTest(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: StreamGeoSerpAiSummaryTestDto,
    @Req() request: Request,
    @Res() response: Response
  ) {
    await this.geoService.streamSerpProjectAiSummaryTest(id, payload, request, response)
  }

  @Post('serp-projects/:id/ai-summary/test-prompt')
  getSerpProjectAiSummaryTestPrompt(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: StreamGeoSerpAiSummaryTestDto
  ) {
    return this.geoService.getSerpProjectAiSummaryTestPrompt(id, payload)
  }

  @Post('serp-projects/:id/ai-summary/prompt-preview')
  getSerpProjectAiSummaryPromptPreview(@Param('id', ParseIntPipe) id: number) {
    return this.geoService.getSerpProjectAiSummaryPromptPreview(id)
  }

  @Put('serp-projects/:id/ai-summary')
  saveSerpProjectAiSummary(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: SaveGeoSerpAiSummaryDto
  ) {
    return this.geoService.saveSerpProjectAiSummary(id, payload)
  }

  @Delete('serp-projects/:id')
  removeSerpProject(@Param('id', ParseIntPipe) id: number) {
    return this.geoService.removeSerpProject(id)
  }

  @Get('ai-summaries')
  findAiSummaries(@Query() query: FindGeoAiSummariesQueryDto) {
    return this.geoService.findAiSummaries(query)
  }

  @Get('rule-cards')
  findRuleCards(@Query() query: FindGeoRuleCardsQueryDto) {
    return this.geoService.findRuleCards(query)
  }

  @Get('rule-cards/:id')
  findRuleCard(@Param('id', ParseIntPipe) id: number) {
    return this.geoService.findRuleCard(id)
  }

  @Post('rule-cards/generate')
  generateRuleCard(@Body() payload: GenerateGeoRuleCardDto) {
    return this.geoService.generateRuleCard(payload)
  }

  @Patch('rule-cards/:id/activate')
  activateRuleCard(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: ActivateGeoRuleCardDto
  ) {
    return this.geoService.activateRuleCard(id, payload)
  }

  @Post('generate')
  async generatePrompt(
    @Body() payload: GenerateGeoPromptDto,
    @Req() request: Request,
    @Res() response: Response
  ) {
    await this.geoService.generatePrompt(payload, request, response)
  }

  @Post('generate-v2')
  async generatePromptV2(
    @Body() payload: GenerateGeoPromptV2Dto,
    @Req() request: Request,
    @Res() response: Response
  ) {
    await this.geoService.generatePromptV2(payload, request, response)
  }
}
