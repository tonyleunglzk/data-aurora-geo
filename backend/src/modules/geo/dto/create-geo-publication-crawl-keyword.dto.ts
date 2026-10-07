import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class CreateGeoPublicationCrawlKeywordDto {
  @IsString()
  product!: string

  @IsString()
  keyword!: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number
}
