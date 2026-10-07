import { Type } from 'class-transformer'
import { IsOptional, IsString, ValidateNested } from 'class-validator'
import { GeoProductDto } from './geo-product.dto'

export class GenerateGeoPromptDto {
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
