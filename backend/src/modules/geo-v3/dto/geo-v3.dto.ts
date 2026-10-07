import { Type } from 'class-transformer'
import { PartialType } from '@nestjs/mapped-types'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'

export class GeoV3VersionDto {
  @IsString()
  name!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  sourceArticleUrl?: string

  @IsOptional()
  @IsString()
  sourceArticleText?: string

  @IsOptional()
  @IsString()
  sourceArticleTitle?: string

  @IsOptional()
  @IsString()
  ruleText?: string

  @IsOptional()
  @IsString()
  structureRules?: string

  @IsOptional()
  @IsString()
  titleRules?: string

  @IsOptional()
  @IsString()
  paragraphRules?: string

  @IsOptional()
  @IsString()
  seoGeoRules?: string

  @IsOptional()
  @IsString()
  forbiddenRules?: string

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}

export class UpdateGeoV3FixedRulesDto {
  @IsString()
  ruleText!: string
}

export class GeoV3VersionDraftDto {
  @IsOptional()
  @IsString()
  articleText?: string

  @IsOptional()
  @IsString()
  articleUrl?: string

  @IsOptional()
  @IsString()
  notes?: string
}

export class GeoV3VersionDraftMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant'

  @IsString()
  content!: string

  @IsOptional()
  @IsString()
  createdAt?: string
}

export class GeoV3VersionDraftChatDto extends GeoV3VersionDraftDto {
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => GeoV3VersionDraftMessageDto)
  messages!: GeoV3VersionDraftMessageDto[]

  @IsOptional()
  @IsString()
  model?: string
}

export class GeoV3VariableSetDraftDto {
  @IsOptional()
  @IsString()
  versionName?: string

  @IsOptional()
  @IsString()
  ruleText?: string

  @IsOptional()
  @IsString()
  rawContent?: string

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsString()
  model?: string
}

export class GeoV3VersionDraftSessionDto {
  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  articleText?: string

  @IsOptional()
  @IsString()
  articleUrl?: string

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsString()
  model?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => GeoV3VersionDraftMessageDto)
  messages?: GeoV3VersionDraftMessageDto[]

  @IsOptional()
  @IsIn(['ACTIVE', 'APPLIED', 'ARCHIVED'])
  status?: 'ACTIVE' | 'APPLIED' | 'ARCHIVED'

  @IsOptional()
  @IsInt()
  @Min(1)
  ownerUserId?: number

  @IsOptional()
  @IsString()
  ownerName?: string

  @IsOptional()
  @IsString()
  suggestedName?: string

  @IsOptional()
  @IsString()
  suggestedDescription?: string

  @IsOptional()
  @IsString()
  suggestedRuleText?: string

  @IsOptional()
  @IsObject()
  suggestedVariableSetDraft?: Record<string, unknown>

  @IsOptional()
  @IsIn(['MANUAL_CHAT', 'V2_IMPORT', 'TXT_BATCH'])
  sourceType?: 'MANUAL_CHAT' | 'V2_IMPORT' | 'TXT_BATCH'
}

export class GeoV3VersionDraftSessionImportV2Dto {
  @IsInt()
  @Min(1)
  sourceSessionId!: number
}

export class GeoV3VersionDraftSessionApplyDto {
  @IsOptional()
  @IsString()
  feedback?: string

  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean
}

export class GeoV3BatchTxtFileDto {
  @IsString()
  fileName!: string

  @IsString()
  content!: string
}

export class GeoV3BatchTxtJobDto {
  @IsOptional()
  @IsString()
  productCategory?: string

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  requirements!: string[]

  @IsOptional()
  @IsString()
  model?: string

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => GeoV3BatchTxtFileDto)
  files!: GeoV3BatchTxtFileDto[]
}

export class GeoV3VariableItemDto {
  @IsString()
  name!: string

  @IsString()
  label!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsIn(['ONE', 'MANY'])
  pickMode!: 'ONE' | 'MANY'

  @IsInt()
  @Min(0)
  @Max(50)
  pickMin!: number

  @IsInt()
  @Min(0)
  @Max(50)
  pickMax!: number

  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  candidates!: string[]

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}

export class GeoV3VariableSetDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  versionId?: number

  @IsString()
  name!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number

  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => GeoV3VariableItemDto)
  items!: GeoV3VariableItemDto[]
}

export class GeoV3ProductDto {
  @IsString()
  name!: string

  @IsString()
  brand!: string

  @IsString()
  productName!: string

  @IsString()
  category!: string

  @IsOptional()
  @IsString()
  targetAudience?: string

  @IsOptional()
  @IsString()
  coreParameters?: string

  @IsOptional()
  @IsString()
  keyword?: string

  @IsOptional()
  @IsIn(['exact', 'recompose'])
  keywordMode?: 'exact' | 'recompose'

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  seoKeywords?: string[]

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsString({ each: true })
  brandPool?: string[]

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  brandPoolPickMin?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  brandPoolPickMax?: number

  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  requiredContent!: string[]

  @IsArray()
  @ArrayMaxSize(300)
  @IsString({ each: true })
  randomContentPool!: string[]

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsString({ each: true })
  sellingPointsPool?: string[]

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  sellingPointPickMin?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  sellingPointPickMax?: number

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsString({ each: true })
  emphasisPool?: string[]

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  emphasisPickMin?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  emphasisPickMax?: number

  @IsInt()
  @Min(0)
  @Max(50)
  randomPickMin!: number

  @IsInt()
  @Min(0)
  @Max(50)
  randomPickMax!: number

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}

export class GeoV3GenerateDto {
  @IsOptional()
  @IsString()
  articleText?: string

  @IsOptional()
  @IsString()
  articleUrl?: string

  @IsInt()
  @Min(1)
  versionId!: number

  @IsOptional()
  @IsInt()
  @Min(1)
  variableSetId?: number

  @IsInt()
  @Min(1)
  productProfileId!: number

  @IsInt()
  @Min(1)
  @Max(50)
  count!: number

  @IsOptional()
  @IsString()
  topic?: string

  @IsOptional()
  @IsString()
  extraRequirements?: string

  @IsOptional()
  @IsIn(['SYSTEM', 'NONE'])
  fixedRulesMode?: 'SYSTEM' | 'NONE'
}

export class UpdateGeoV3VersionDto extends PartialType(GeoV3VersionDto) {}

export class GeoV3VersionBatchActionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  ids!: number[]

  @IsIn(['PAUSE', 'ARCHIVE'])
  action!: 'PAUSE' | 'ARCHIVE'
}

export class UpdateGeoV3VariableSetDto extends PartialType(GeoV3VariableSetDto) {}
export class UpdateGeoV3ProductDto extends PartialType(GeoV3ProductDto) {}
