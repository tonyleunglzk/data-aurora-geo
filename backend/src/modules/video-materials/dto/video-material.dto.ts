import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export const VIDEO_MATERIAL_PRODUCT_CATEGORIES = [
  'SUN_PROTECTIVE_CLOTHING',
  'SHELL_JACKET',
] as const

export class UploadVideoMaterialDto {
  @IsString()
  @IsIn(VIDEO_MATERIAL_PRODUCT_CATEGORIES)
  productCategory!: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.12)
  @Max(0.6)
  sceneThreshold?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(500)
  @Max(10_000)
  minClipDurationMs?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(5_000)
  @Max(60_000)
  maxClipDurationMs?: number
}

export class ReprocessVideoMaterialDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.12)
  @Max(0.6)
  sceneThreshold?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(500)
  @Max(10_000)
  minClipDurationMs?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(5_000)
  @Max(60_000)
  maxClipDurationMs?: number
}

export class AnalyzeVideoMaterialDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  reanalyzeConfirmed?: boolean

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  clipIds?: number[]
}

export class ConfirmVideoMaterialClipsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(1)
  threshold?: number
}

export class UpdateVideoMaterialClipDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  shotType?: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  contentType?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contentTopics?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actions?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  objects?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scenes?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  brands?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  qualityFlags?: string[]

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  qualityScore?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  usabilityScore?: number

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasPerson?: boolean

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasTextOverlay?: boolean

  @IsOptional()
  @IsString()
  @IsIn(['PENDING', 'CONFIRMED', 'NEEDS_REVIEW'])
  reviewStatus?: string
}
