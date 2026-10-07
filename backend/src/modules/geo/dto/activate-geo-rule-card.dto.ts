import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional } from 'class-validator'

export class ActivateGeoRuleCardDto {
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return true
    if (typeof value === 'boolean') return value

    return String(value).trim().toLowerCase() === 'true'
  })
  isActive?: boolean
}
