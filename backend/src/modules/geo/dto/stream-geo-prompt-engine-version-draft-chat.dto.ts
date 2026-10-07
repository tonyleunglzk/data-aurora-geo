import { Type } from 'class-transformer'
import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator'
import { PromptEngineVersionDraftMessageDto } from './prompt-engine-version-draft-message.dto'

const VERSION_DRAFT_MODEL_OPTIONS = ['claude-opus-4.7', 'claude-opus-4-6', 'claude-sonnet-4-6']

export class StreamGeoPromptEngineVersionDraftChatDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromptEngineVersionDraftMessageDto)
  messages!: PromptEngineVersionDraftMessageDto[]

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
}
