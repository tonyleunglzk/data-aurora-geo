import { IsIn, IsString } from 'class-validator'

export class CreateGeoPublicationOptionDto {
  @IsIn(['PRODUCT', 'PLATFORM', 'ACCOUNT_TYPE'])
  type!: 'PRODUCT' | 'PLATFORM' | 'ACCOUNT_TYPE'

  @IsString()
  label!: string
}
