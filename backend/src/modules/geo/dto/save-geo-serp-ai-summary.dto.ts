import { Transform } from 'class-transformer'
import { IsArray, IsOptional, IsString } from 'class-validator'

const toStringArray = (value: unknown) => {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
}

export class SaveGeoSerpAiSummaryDto {
  @IsString()
  @Transform(({ value }) => String(value ?? '').trim())
  model!: string

  @IsString()
  @Transform(({ value }) => String(value ?? '').trim())
  rawSummary!: string

  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  titlePatterns!: string[]

  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  leadPatterns!: string[]

  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  sectionBlueprint!: string[]

  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  keywordPlacement!: string[]

  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  sellingPointOrder!: string[]

  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  trustSignals!: string[]

  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  endingPatterns!: string[]

  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  antiPatterns!: string[]

  @IsArray()
  @Transform(({ value }) => toStringArray(value))
  rankingHypotheses!: string[]

  @IsOptional()
  @IsString()
  @Transform(({ value }) => String(value ?? '').trim())
  requestedModel?: string

  @IsOptional()
  fallbackUsed?: boolean

  @IsOptional()
  @IsString()
  @Transform(({ value }) => String(value ?? '').trim())
  fallbackReason?: string
}
