import { Module } from '@nestjs/common'
import { VideoMaterialsController } from './video-materials.controller'
import { VideoMaterialAiService } from './video-material-ai.service'
import { VideoMaterialsService } from './video-materials.service'
import { VideoAssemblyController } from './video-assembly.controller'
import { VideoAssemblyRendererService } from './video-assembly-renderer.service'
import { VideoAssemblyService } from './video-assembly.service'

@Module({
  controllers: [VideoMaterialsController, VideoAssemblyController],
  providers: [
    VideoMaterialsService,
    VideoMaterialAiService,
    VideoAssemblyService,
    VideoAssemblyRendererService,
  ],
})
export class VideoMaterialsModule {}
