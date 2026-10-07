import { IsArray, IsIn, IsString } from 'class-validator'

export class GeoProductDto {
  @IsString()
  brand!: string

  @IsString()
  name!: string

  @IsString()
  type!: string

  @IsString()
  specs!: string

  @IsArray()
  @IsString({ each: true })
  sellingPoints!: string[]

  @IsString()
  sellingPointsRange!: string

  @IsString()
  targetAudience!: string

  @IsArray()
  @IsString({ each: true })
  emphasis!: string[]

  @IsString()
  emphasisRange!: string

  @IsString()
  keyword!: string

  @IsIn(['exact', 'recompose'])
  keywordMode!: string

  @IsArray()
  @IsString({ each: true })
  seoKeywords!: string[]

  @IsArray()
  @IsString({ each: true })
  brandPool!: string[]

  @IsString()
  brandPoolCount!: string
}
