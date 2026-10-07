import { Transform } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

export class FindGeoAiSummariesQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => String(value ?? '').trim())
  category?: string
}
