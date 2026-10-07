import { Module } from '@nestjs/common'
import { GeoV3Controller } from './geo-v3.controller'
import { GeoV3Service } from './geo-v3.service'

@Module({
  controllers: [GeoV3Controller],
  providers: [GeoV3Service],
})
export class GeoV3Module {}
