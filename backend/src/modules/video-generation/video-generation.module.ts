import { Module } from '@nestjs/common'
import { VideoGenerationController } from './video-generation.controller'
import { VideoGenerationService } from './video-generation.service'

@Module({
  controllers: [VideoGenerationController],
  providers: [VideoGenerationService],
})
export class VideoGenerationModule {}
