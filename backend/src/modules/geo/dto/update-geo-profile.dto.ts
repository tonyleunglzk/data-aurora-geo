import { PartialType } from '@nestjs/mapped-types'
import { CreateGeoProfileDto } from './create-geo-profile.dto'

export class UpdateGeoProfileDto extends PartialType(CreateGeoProfileDto) {}
