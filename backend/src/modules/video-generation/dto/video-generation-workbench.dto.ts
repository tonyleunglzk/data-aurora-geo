import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'
import { VideoGenerationSourceType, VideoGenerationTemplateType } from '@prisma/client'
import {
  VideoGenerationAssetKind,
  VideoGenerationAssetPriority,
  VideoGenerationAssetSourceType,
  VideoGenerationAssetStatus,
} from '@prisma/client'

export class CreateVideoGenerationTemplateDto {
  @IsOptional()
  @IsString()
  key?: string

  @IsString()
  name!: string

  @IsEnum(VideoGenerationTemplateType)
  type!: VideoGenerationTemplateType

  @IsOptional()
  @IsString()
  description?: string

  @IsString()
  model!: string

  @IsString()
  resolution!: string

  @IsString()
  ratio!: string

  @Type(() => Number)
  @IsInt()
  @Min(-1)
  @Max(12)
  duration!: number

  @IsOptional()
  @IsBoolean()
  generateAudio?: boolean

  @IsOptional()
  @IsBoolean()
  watermark?: boolean

  @IsString()
  promptTemplate!: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number
}

export class UpdateVideoGenerationTemplateDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsEnum(VideoGenerationTemplateType)
  type?: VideoGenerationTemplateType

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  model?: string

  @IsOptional()
  @IsString()
  resolution?: string

  @IsOptional()
  @IsString()
  ratio?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1)
  @Max(12)
  duration?: number

  @IsOptional()
  @IsBoolean()
  generateAudio?: boolean

  @IsOptional()
  @IsBoolean()
  watermark?: boolean

  @IsOptional()
  @IsString()
  promptTemplate?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number
}

export class CreateVideoGenerationCampaignDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsEnum(VideoGenerationSourceType)
  sourceType!: VideoGenerationSourceType

  @Type(() => Number)
  @IsInt()
  templateId!: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productProfileId?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  geoRunId?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  geoItemId?: number

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  topics!: string[]

  @IsOptional()
  @IsArray()
  referenceAssets?: unknown[]

  @IsOptional()
  @IsString()
  model?: string

  @IsOptional()
  @IsString()
  resolution?: string

  @IsOptional()
  @IsString()
  ratio?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1)
  @Max(12)
  duration?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seed?: number

  @IsOptional()
  @IsBoolean()
  cameraFixed?: boolean

  @IsOptional()
  @IsBoolean()
  returnLastFrame?: boolean

  @IsOptional()
  @IsString()
  callbackUrl?: string
}

export class CreateVideoGenerationCampaignTasksDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  topics?: string[]

  @IsOptional()
  @IsArray()
  referenceAssets?: unknown[]

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seed?: number

  @IsOptional()
  @IsBoolean()
  cameraFixed?: boolean

  @IsOptional()
  @IsBoolean()
  returnLastFrame?: boolean

  @IsOptional()
  @IsString()
  callbackUrl?: string
}

export class ImportVideoGenerationTaskDto {
  @IsString()
  taskId!: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  campaignId?: number
}

export class PlanVideoGenerationAssetsDto {
  @Type(() => Number)
  @IsInt()
  productProfileId!: number
}

export class CreateVideoGenerationAssetDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productProfileId?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  campaignId?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  taskId?: number

  @IsOptional()
  @IsString()
  planKey?: string

  @IsString()
  title!: string

  @IsEnum(VideoGenerationAssetKind)
  kind!: VideoGenerationAssetKind

  @IsOptional()
  @IsString()
  role?: string

  @IsOptional()
  @IsEnum(VideoGenerationAssetPriority)
  priority?: VideoGenerationAssetPriority

  @IsOptional()
  @IsEnum(VideoGenerationAssetStatus)
  status?: VideoGenerationAssetStatus

  @IsOptional()
  @IsEnum(VideoGenerationAssetSourceType)
  sourceType?: VideoGenerationAssetSourceType

  @IsOptional()
  @IsString()
  stage?: string

  @IsOptional()
  @IsString()
  purpose?: string

  @IsOptional()
  @IsString()
  brief?: string

  @IsOptional()
  @IsString()
  prompt?: string

  @IsOptional()
  @IsString()
  toolHint?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourceFields?: string[]

  @IsOptional()
  @IsString()
  url?: string
}

export class UpdateVideoGenerationAssetDto {
  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsEnum(VideoGenerationAssetKind)
  kind?: VideoGenerationAssetKind

  @IsOptional()
  @IsString()
  role?: string

  @IsOptional()
  @IsEnum(VideoGenerationAssetPriority)
  priority?: VideoGenerationAssetPriority

  @IsOptional()
  @IsEnum(VideoGenerationAssetStatus)
  status?: VideoGenerationAssetStatus

  @IsOptional()
  @IsEnum(VideoGenerationAssetSourceType)
  sourceType?: VideoGenerationAssetSourceType

  @IsOptional()
  @IsString()
  stage?: string

  @IsOptional()
  @IsString()
  purpose?: string

  @IsOptional()
  @IsString()
  brief?: string

  @IsOptional()
  @IsString()
  prompt?: string

  @IsOptional()
  @IsString()
  toolHint?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourceFields?: string[]

  @IsOptional()
  @IsString()
  url?: string
}

export class GenerateVideoAssetImageDto {
  @IsOptional()
  @IsString()
  prompt?: string

  @IsOptional()
  @IsString()
  size?: string
}

export class GenerateVideoStoryboardDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productProfileId?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  campaignId?: number

  @IsOptional()
  @IsEnum(VideoGenerationSourceType)
  sourceType?: VideoGenerationSourceType

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  topics?: string[]

  @IsOptional()
  @IsString()
  title?: string
}
