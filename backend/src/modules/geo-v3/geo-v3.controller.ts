import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
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
import { GeoV3Service } from './geo-v3.service'

@Controller('geo-v3')
export class GeoV3Controller {
  constructor(private readonly geoV3Service: GeoV3Service) {}

  @Get('fixed-rules')
  findFixedRules() {
    return this.geoV3Service.findFixedRules()
  }

  @Patch('fixed-rules')
  updateFixedRules(@Body() payload: UpdateGeoV3FixedRulesDto) {
    return this.geoV3Service.updateFixedRules(payload)
  }

  @Get('versions')
  findVersions() {
    return this.geoV3Service.findVersions()
  }

  @Post('versions')
  createVersion(@Body() payload: GeoV3VersionDto) {
    return this.geoV3Service.createVersion(payload)
  }

  @Patch('versions/batch')
  batchUpdateVersions(@Body() payload: GeoV3VersionBatchActionDto) {
    return this.geoV3Service.batchUpdateVersions(payload)
  }

  @Patch('versions/:id')
  updateVersion(@Param('id', ParseIntPipe) id: number, @Body() payload: UpdateGeoV3VersionDto) {
    return this.geoV3Service.updateVersion(id, payload)
  }

  @Delete('versions/:id')
  removeVersion(@Param('id', ParseIntPipe) id: number) {
    return this.geoV3Service.removeVersion(id)
  }

  @Post('versions/draft')
  createVersionDraft(@Body() payload: GeoV3VersionDraftDto) {
    return this.geoV3Service.createVersionDraft(payload)
  }

  @Post('versions/chat/stream')
  async streamVersionDraftChat(
    @Body() payload: GeoV3VersionDraftChatDto,
    @Req() request: Request,
    @Res() response: Response
  ) {
    await this.geoV3Service.streamVersionDraftChat(payload, request, response)
  }

  @Post('versions/chat/apply')
  applyVersionDraftChat(@Body() payload: GeoV3VersionDraftChatDto) {
    return this.geoV3Service.applyVersionDraftChat(payload)
  }

  @Post('versions/variable-set-draft')
  createVariableSetDraft(@Body() payload: GeoV3VariableSetDraftDto) {
    return this.geoV3Service.createVariableSetDraft(payload)
  }

  @Get('version-draft-sessions')
  findVersionDraftSessions() {
    return this.geoV3Service.findVersionDraftSessions()
  }

  @Post('version-draft-sessions/import-v2')
  importVersionDraftSessionFromV2(@Body() payload: GeoV3VersionDraftSessionImportV2Dto) {
    return this.geoV3Service.importVersionDraftSessionFromV2(payload)
  }

  @Post('version-draft-sessions/batch-txt-jobs')
  createVersionDraftBatchTxtJob(@Body() payload: GeoV3BatchTxtJobDto) {
    return this.geoV3Service.createVersionDraftBatchTxtJob(payload)
  }

  @Get('version-draft-sessions/batch-txt-jobs/:id')
  findVersionDraftBatchTxtJob(@Param('id', ParseIntPipe) id: number) {
    return this.geoV3Service.findVersionDraftBatchTxtJob(id)
  }

  @Post('version-draft-sessions/batch-txt-jobs/:id/retry-failed')
  retryFailedVersionDraftBatchTxtJob(@Param('id', ParseIntPipe) id: number) {
    return this.geoV3Service.retryFailedVersionDraftBatchTxtJob(id)
  }

  @Get('version-draft-sessions/:id')
  findVersionDraftSession(@Param('id', ParseIntPipe) id: number) {
    return this.geoV3Service.findVersionDraftSession(id)
  }

  @Post('version-draft-sessions')
  createVersionDraftSession(@Body() payload: GeoV3VersionDraftSessionDto) {
    return this.geoV3Service.createVersionDraftSession(payload)
  }

  @Patch('version-draft-sessions/:id')
  updateVersionDraftSession(@Param('id', ParseIntPipe) id: number, @Body() payload: GeoV3VersionDraftSessionDto) {
    return this.geoV3Service.updateVersionDraftSession(id, payload)
  }

  @Delete('version-draft-sessions/:id')
  removeVersionDraftSession(@Param('id', ParseIntPipe) id: number) {
    return this.geoV3Service.removeVersionDraftSession(id)
  }

  @Post('version-draft-sessions/:id/chat/stream')
  async streamVersionDraftSessionChat(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request,
    @Res() response: Response
  ) {
    await this.geoV3Service.streamVersionDraftSessionChat(id, request, response)
  }

  @Post('version-draft-sessions/:id/apply')
  applyVersionDraftSession(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: GeoV3VersionDraftSessionApplyDto
  ) {
    return this.geoV3Service.applyVersionDraftSession(id, payload)
  }

  @Get('variables')
  findVariableSets() {
    return this.geoV3Service.findVariableSets()
  }

  @Post('variables')
  createVariableSet(@Body() payload: GeoV3VariableSetDto) {
    return this.geoV3Service.createVariableSet(payload)
  }

  @Patch('variables/:id')
  updateVariableSet(@Param('id', ParseIntPipe) id: number, @Body() payload: UpdateGeoV3VariableSetDto) {
    return this.geoV3Service.updateVariableSet(id, payload)
  }

  @Delete('variables/:id')
  removeVariableSet(@Param('id', ParseIntPipe) id: number) {
    return this.geoV3Service.removeVariableSet(id)
  }

  @Get('products')
  findProducts() {
    return this.geoV3Service.findProducts()
  }

  @Post('products')
  createProduct(@Body() payload: GeoV3ProductDto) {
    return this.geoV3Service.createProduct(payload)
  }

  @Patch('products/:id')
  updateProduct(@Param('id', ParseIntPipe) id: number, @Body() payload: UpdateGeoV3ProductDto) {
    return this.geoV3Service.updateProduct(id, payload)
  }

  @Delete('products/:id')
  removeProduct(@Param('id', ParseIntPipe) id: number) {
    return this.geoV3Service.removeProduct(id)
  }

  @Post('generate')
  generate(@Body() payload: GeoV3GenerateDto) {
    return this.geoV3Service.generate(payload)
  }

  @Get('runs')
  findRuns() {
    return this.geoV3Service.findRuns()
  }

  @Get('runs/:id')
  findRun(@Param('id', ParseIntPipe) id: number) {
    return this.geoV3Service.findRun(id)
  }

  @Get('runs/:id/download')
  async downloadRun(@Param('id', ParseIntPipe) id: number, @Res() response: Response) {
    await this.geoV3Service.downloadRun(id, response)
  }
}
