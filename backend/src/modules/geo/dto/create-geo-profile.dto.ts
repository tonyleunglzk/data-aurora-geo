import { IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { GeoProductDto } from './geo-product.dto'

export class CreateGeoProfileDto extends GeoProductDto {
  @IsString()
  @IsNotEmpty()
  profileName!: string

  @IsOptional()
  @IsString()
  articleUrl?: string
}
