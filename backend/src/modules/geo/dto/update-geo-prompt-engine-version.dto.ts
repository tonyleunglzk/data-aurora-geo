import { PartialType } from '@nestjs/mapped-types'
import { CreateGeoPromptEngineVersionDto } from './create-geo-prompt-engine-version.dto'

export class UpdateGeoPromptEngineVersionDto extends PartialType(CreateGeoPromptEngineVersionDto) {}
