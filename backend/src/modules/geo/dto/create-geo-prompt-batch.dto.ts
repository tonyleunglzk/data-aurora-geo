import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class CreateGeoPromptBatchDto {
  @IsIn(['LEGACY', 'V2'])
  engineType!: 'LEGACY' | 'V2'

  @IsInt()
  @Min(1)
  profileId!: number

  @IsOptional()
  @IsInt()
  @Min(1)
  versionId?: number

  @IsInt()
  @Min(1)
  @Max(20)
  count!: number

  @IsOptional()
  @IsString()
  articleText?: string

  @IsOptional()
  @IsString()
  articleUrl?: string
}
