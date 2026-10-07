import { Transform } from 'class-transformer'
import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class CreateSerpResearchProjectDto {
  @IsString()
  @Transform(({ value }) => String(value ?? '').trim())
  category!: string

  @IsString()
  @IsOptional()
  @Transform(({ value }) => String(value ?? '').trim())
  keyword!: string

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(50)
  rankLimit!: number

  @IsString()
  @IsOptional()
  @IsIn(['automatic', 'manual'])
  @Transform(({ value }) => String(value ?? 'automatic').trim())
  mode?: 'automatic' | 'manual'

  @IsArray()
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item ?? '').trim())
        .filter(Boolean)
    }

    return []
  })
  articleUrls?: string[]
}
