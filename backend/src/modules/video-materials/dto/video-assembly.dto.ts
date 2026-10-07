import { Type } from 'class-transformer'
import {
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
import { VIDEO_MATERIAL_PRODUCT_CATEGORIES } from './video-material.dto'

export class CreateVideoAssemblyProjectDto {
  @IsString()
  @IsIn(VIDEO_MATERIAL_PRODUCT_CATEGORIES)
  productCategory!: string

  @IsString()
  @MaxLength(120)
  name!: string

  @IsString()
  @MaxLength(100_000)
  narrationText!: string

  @IsOptional()
  @IsString()
  @IsIn(['9:16', '16:9', '1:1'])
  aspectRatio?: string

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  removeSourceSubtitles?: boolean

  @IsOptional()
  @IsString()
  @IsIn(['ALL', 'SELECTED'])
  sourceMode?: string

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  sourceMaterialIds?: number[]

  @IsOptional()
  @IsString()
  @IsIn(['SMART', 'FILL_CROP', 'FIT_BLUR'])
  framingMode?: string
}

export class UpdateVideoAssemblyProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  narrationText?: string

  @IsOptional()
  @IsString()
  @IsIn(['9:16', '16:9', '1:1'])
  aspectRatio?: string

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  removeSourceSubtitles?: boolean

  @IsOptional()
  @IsString()
  @IsIn(['ALL', 'SELECTED'])
  sourceMode?: string

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  sourceMaterialIds?: number[]

  @IsOptional()
  @IsString()
  @IsIn(['SMART', 'FILL_CROP', 'FIT_BLUR'])
  framingMode?: string
}

export class MatchVideoAssemblyProjectDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  confirmedOnly?: boolean
}

export class UpdateVideoAssemblySceneDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  selectedClipId?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  clipStartOffsetMs?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(30_000)
  clipDurationMs?: number

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  narrationText?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  visualBrief?: string

  @IsOptional()
  @IsString()
  @IsIn(['INFORMATION', 'ACTION', 'EXPERIENCE', 'PRODUCT', 'MIXED'])
  visualIntent?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contentTypes?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  shotTypes?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  negativeKeywords?: string[]
}
