import { IsOptional, IsString } from 'class-validator'

export class CreateGeoPublicationCrawlJobDto {
  @IsOptional()
  @IsString()
  product?: string
}
