import { Transform } from 'class-transformer'
import { IsArray, IsDateString, IsIn, IsOptional, IsString } from 'class-validator'

const normalizeStringArray = ({ value }: { value: unknown }) => {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
}

export class AutoGenerateChangelogEntryDto {
  @IsString()
  @Transform(({ value }) => String(value ?? '').trim())
  title!: string

  @IsOptional()
  @IsDateString()
  releaseDate?: string

  @IsString()
  @Transform(({ value }) => String(value ?? '').trim())
  summary!: string

  @IsArray()
  @Transform(normalizeStringArray)
  @IsString({ each: true })
  addedItems!: string[]

  @IsArray()
  @Transform(normalizeStringArray)
  @IsString({ each: true })
  changedItems!: string[]

  @IsArray()
  @Transform(normalizeStringArray)
  @IsString({ each: true })
  removedItems!: string[]

  @IsOptional()
  @IsArray()
  @Transform(normalizeStringArray)
  @IsString({ each: true })
  affectedModules?: string[]

  @IsOptional()
  @IsString()
  @IsIn(['ai_delivery'])
  sourceType?: 'ai_delivery'
}
