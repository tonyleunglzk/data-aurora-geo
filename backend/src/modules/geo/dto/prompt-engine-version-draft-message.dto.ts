import { IsIn, IsOptional, IsString } from 'class-validator'

export class PromptEngineVersionDraftMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant'

  @IsString()
  content!: string

  @IsOptional()
  @IsString()
  createdAt?: string
}
