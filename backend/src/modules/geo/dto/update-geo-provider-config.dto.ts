import { IsOptional, IsString } from 'class-validator'

export class UpdateGeoProviderConfigDto {
  @IsOptional()
  @IsString()
  apiKey?: string

  @IsOptional()
  @IsString()
  baseUrl?: string

  @IsOptional()
  @IsString()
  model?: string
}
