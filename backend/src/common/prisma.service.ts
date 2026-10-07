import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    try {
      await this.$connect()
    } catch (error) {
      console.warn('[Prisma] Database connection skipped during bootstrap:', error)
    }
  }
}
