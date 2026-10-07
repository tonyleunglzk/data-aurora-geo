import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator'

export class CreateGeoPublicationRecordDto {
  @IsDateString()
  publishedAt!: string

  @IsString()
  product!: string

  @IsString()
  title!: string

  @IsString()
  platform!: string

  @IsString()
  accountType!: string

  @IsString()
  author!: string

  @IsString()
  promptCode!: string

  @IsString()
  link!: string

  @IsOptional()
  @IsInt()
  @Min(1)
  promptBatchJobItemId?: number
}
