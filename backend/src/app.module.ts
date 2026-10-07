import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ChangelogModule } from './modules/changelog/changelog.module'
import { HealthModule } from './common/health.module'
import { PrismaModule } from './common/prisma.module'
import { AuthModule } from './modules/auth/auth.module'
import { GeoModule } from './modules/geo/geo.module'
import { GeoV3Module } from './modules/geo-v3/geo-v3.module'
import { SettingsModule } from './modules/settings/settings.module'
import { UsersModule } from './modules/users/users.module'
import { VideoGenerationModule } from './modules/video-generation/video-generation.module'
import { VideoMaterialsModule } from './modules/video-materials/video-materials.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    SettingsModule,
    GeoModule,
    GeoV3Module,
    VideoGenerationModule,
    VideoMaterialsModule,
    ChangelogModule,
  ],
})
export class AppModule {}
