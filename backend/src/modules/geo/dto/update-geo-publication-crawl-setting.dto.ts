import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator'

export class UpdateGeoPublicationCrawlSettingDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  dailyRunTime?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  lookbackDays?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxKeywordsPerRun?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  requestIntervalMinSec?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  requestIntervalMaxSec?: number
}
