import { Transform } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

export class FindGeoPromptCodeOptionsQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => String(value ?? '').trim())
  keyword?: string
}
