import { Injectable, OnModuleInit } from '@nestjs/common'
import type { AppSetting } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { UpdateSettingsDto } from './dto/update-settings.dto'

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.prisma.appSetting.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        systemName: 'Data Aurora Admin',
        notificationsEnabled: true,
      },
    })
  }

  async findOne() {
    const settings = await this.prisma.appSetting.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        systemName: 'Data Aurora Admin',
        notificationsEnabled: true,
      },
    })

    return this.toSettingsView(settings)
  }

  async update(payload: UpdateSettingsDto) {
    const settings = await this.prisma.appSetting.upsert({
      where: { id: 1 },
      update: {
        systemName: payload.systemName.trim(),
        notificationsEnabled: payload.notificationsEnabled,
      },
      create: {
        id: 1,
        systemName: payload.systemName.trim(),
        notificationsEnabled: payload.notificationsEnabled,
      },
    })

    return this.toSettingsView(settings)
  }

  private toSettingsView(settings: AppSetting) {
    return {
      systemName: settings.systemName,
      notificationsEnabled: settings.notificationsEnabled,
    }
  }
}
