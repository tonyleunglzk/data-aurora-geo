import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class FindGeoRuleCardsQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => String(value ?? '').trim())
  category?: string

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return false
    if (typeof value === 'boolean') return value

    return String(value).trim().toLowerCase() === 'true'
  })
  activeOnly?: boolean
}
