import { Transform } from 'class-transformer'
import { IsDateString, IsOptional, IsString } from 'class-validator'

export class GenerateGeoRuleCardDto {
  @IsString()
  @Transform(({ value }) => String(value ?? '').trim())
  category!: string

  @IsOptional()
  @IsDateString()
  fromDate?: string

  @IsOptional()
  @IsDateString()
  toDate?: string
}
