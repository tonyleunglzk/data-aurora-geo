import { PartialType } from '@nestjs/mapped-types'
import { CreateGeoPublicationRecordDto } from './create-geo-publication-record.dto'

export class UpdateGeoPublicationRecordDto extends PartialType(CreateGeoPublicationRecordDto) {}
