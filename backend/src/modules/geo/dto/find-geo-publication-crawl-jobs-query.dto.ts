import { Transform } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

const trimValue = ({ value }: { value: unknown }) => String(value ?? '').trim()

export class FindGeoPublicationCrawlJobsQueryDto {
  @IsOptional()
  @IsString()
  @Transform(trimValue)
  product?: string
}
