import { Type } from 'class-transformer'
import { IsArray, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator'
import { PromptEngineVersionDraftMessageDto } from './prompt-engine-version-draft-message.dto'

const VERSION_DRAFT_MODEL_OPTIONS = ['claude-opus-4.7', 'claude-opus-4-6', 'claude-sonnet-4-6']

export class CreateGeoPromptEngineVersionDraftSessionDto {
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
  @IsIn(VERSION_DRAFT_MODEL_OPTIONS)
  model?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromptEngineVersionDraftMessageDto)
  messages?: PromptEngineVersionDraftMessageDto[]

  @IsOptional()
  @IsInt()
  ownerUserId?: number

  @IsOptional()
  @IsString()
  ownerName?: string
}
