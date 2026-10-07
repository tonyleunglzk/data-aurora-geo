import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator'
import { GeoProductDto } from './geo-product.dto'

export class GenerateGeoPromptV2Dto {
  @IsInt()
  @Min(1)
  versionId!: number

  @IsOptional()
  @IsString()
  articleText?: string

  @IsOptional()
  @IsString()
  articleUrl?: string

  @ValidateNested()
  @Type(() => GeoProductDto)
  product!: GeoProductDto
}
