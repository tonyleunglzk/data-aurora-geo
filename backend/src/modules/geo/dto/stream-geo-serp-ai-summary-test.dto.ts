import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class StreamGeoSerpAiSummaryTestDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => String(value ?? '').trim())
  model?: string

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value
    return String(value ?? '').trim().toLowerCase() === 'true'
  })
  allowFallback?: boolean
}
