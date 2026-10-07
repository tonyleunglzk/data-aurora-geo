import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator'

export class CreateGeoPromptEngineVersionDto {
  @IsString()
  name!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  articleUrl?: string

  @IsOptional()
  @IsString()
  articleText?: string

  @IsString()
  ruleText!: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}
