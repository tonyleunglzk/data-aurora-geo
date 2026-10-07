import { IsString } from 'class-validator'

export class ImportGeoPromptEngineVersionDraftDto {
  @IsString()
  fileName!: string

  @IsString()
  content!: string
}
