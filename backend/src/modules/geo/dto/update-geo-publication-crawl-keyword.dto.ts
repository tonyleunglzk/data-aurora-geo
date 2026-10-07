import { PartialType } from '@nestjs/mapped-types'
import { CreateGeoPublicationCrawlKeywordDto } from './create-geo-publication-crawl-keyword.dto'

export class UpdateGeoPublicationCrawlKeywordDto extends PartialType(CreateGeoPublicationCrawlKeywordDto) {}
