import { Transform } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

const trimValue = ({ value }: { value: unknown }) => String(value ?? '').trim()

export class FindGeoPublicationRecordsQueryDto {
  @IsOptional()
  @IsString()
  @Transform(trimValue)
  product?: string

  @IsOptional()
  @IsString()
  @Transform(trimValue)
  platform?: string

  @IsOptional()
  @IsString()
  @Transform(trimValue)
  accountType?: string

  @IsOptional()
  @IsString()
  @Transform(trimValue)
  promptCode?: string

  @IsOptional()
  @IsString()
  @Transform(trimValue)
  keyword?: string

  @IsOptional()
  @IsString()
  @Transform(trimValue)
  startDate?: string

  @IsOptional()
  @IsString()
  @Transform(trimValue)
  endDate?: string
}
