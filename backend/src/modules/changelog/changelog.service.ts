import { Injectable, NotFoundException } from '@nestjs/common'
import type { ChangelogEntry, Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { AutoGenerateChangelogEntryDto } from './dto/auto-generate-changelog-entry.dto'
import { CreateChangelogEntryDto } from './dto/create-changelog-entry.dto'
import { UpdateChangelogEntryDto } from './dto/update-changelog-entry.dto'

type ChangelogSourceType = 'manual' | 'ai_delivery'

@Injectable()
export class ChangelogService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const entries = await this.prisma.changelogEntry.findMany({
      orderBy: [{ releaseDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    })

    return entries.map((entry) => this.toView(entry))
  }

  async findOne(id: number) {
    const entry = await this.prisma.changelogEntry.findUnique({
      where: { id },
    })

    if (!entry) {
      throw new NotFoundException('迭代记录不存在')
    }

    return this.toView(entry)
  }

  async create(payload: CreateChangelogEntryDto) {
    const releaseDate = new Date(payload.releaseDate)
    const batchNo = await this.generateBatchNo(releaseDate)

    const entry = await this.prisma.changelogEntry.create({
      data: this.toCreateInput(payload, releaseDate, batchNo, payload.sourceType ?? 'manual'),
    })

    return this.toView(entry)
  }

  async autoGenerate(payload: AutoGenerateChangelogEntryDto) {
    const releaseDate = payload.releaseDate ? new Date(payload.releaseDate) : new Date()
    const batchNo = await this.generateBatchNo(releaseDate)

    const entry = await this.prisma.changelogEntry.create({
      data: this.toCreateInput(payload, releaseDate, batchNo, payload.sourceType ?? 'ai_delivery'),
    })

    return this.toView(entry)
  }

  async update(id: number, payload: UpdateChangelogEntryDto) {
    const currentEntry = await this.prisma.changelogEntry.findUnique({
      where: { id },
    })

    if (!currentEntry) {
      throw new NotFoundException('迭代记录不存在')
    }

    const data: Prisma.ChangelogEntryUpdateInput = {}

    if (payload.title !== undefined) data.title = payload.title
    if (payload.summary !== undefined) data.summary = payload.summary
    if (payload.addedItems !== undefined) data.addedItems = payload.addedItems
    if (payload.changedItems !== undefined) data.changedItems = payload.changedItems
    if (payload.removedItems !== undefined) data.removedItems = payload.removedItems
    if (payload.affectedModules !== undefined) data.affectedModules = payload.affectedModules
    if (payload.sourceType !== undefined) data.sourceType = payload.sourceType

    if (payload.releaseDate !== undefined) {
      const releaseDate = new Date(payload.releaseDate)
      data.releaseDate = releaseDate
      data.batchNo = await this.generateBatchNo(releaseDate, id)
    }

    const entry = await this.prisma.changelogEntry.update({
      where: { id },
      data,
    })

    return this.toView(entry)
  }

  async remove(id: number) {
    const currentEntry = await this.prisma.changelogEntry.findUnique({
      where: { id },
    })

    if (!currentEntry) {
      throw new NotFoundException('迭代记录不存在')
    }

    const entry = await this.prisma.changelogEntry.delete({
      where: { id },
    })

    return this.toView(entry)
  }

  private toCreateInput(
    payload: Pick<CreateChangelogEntryDto, 'title' | 'summary' | 'addedItems' | 'changedItems' | 'removedItems'> &
      Partial<Pick<CreateChangelogEntryDto, 'affectedModules'>>,
    releaseDate: Date,
    batchNo: string,
    sourceType: ChangelogSourceType
  ): Prisma.ChangelogEntryCreateInput {
    return {
      title: payload.title,
      batchNo,
      releaseDate,
      summary: payload.summary,
      addedItems: payload.addedItems,
      changedItems: payload.changedItems,
      removedItems: payload.removedItems,
      affectedModules: payload.affectedModules ?? [],
      sourceType,
      publishedAt: new Date(),
    }
  }

  private async generateBatchNo(releaseDate: Date, ignoreId?: number) {
    const start = this.toDayBoundary(releaseDate, false)
    const end = this.toDayBoundary(releaseDate, true)
    const prefix = `v${this.formatDateNumber(releaseDate).replaceAll('-', '.')}-`

    const entries = await this.prisma.changelogEntry.findMany({
      where: {
        releaseDate: {
          gte: start,
          lt: end,
        },
        ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
      },
      select: {
        batchNo: true,
      },
    })

    const maxIndex = entries.reduce((currentMax, entry) => {
      if (!entry.batchNo.startsWith(prefix)) return currentMax
      const suffix = Number.parseInt(entry.batchNo.slice(prefix.length), 10)
      return Number.isFinite(suffix) ? Math.max(currentMax, suffix) : currentMax
    }, 0)

    return `${prefix}${String(maxIndex + 1).padStart(2, '0')}`
  }

  private toDayBoundary(value: Date, endOfDay: boolean) {
    const date = new Date(value)
    if (endOfDay) {
      date.setHours(24, 0, 0, 0)
      return date
    }

    date.setHours(0, 0, 0, 0)
    return date
  }

  private formatDateNumber(value: Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  private readStringArray(value: Prisma.JsonValue) {
    if (!Array.isArray(value)) return []

    return value
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
  }

  private toView(entry: ChangelogEntry) {
    return {
      id: entry.id,
      title: entry.title,
      batchNo: entry.batchNo,
      releaseDate: this.formatDateNumber(entry.releaseDate),
      summary: entry.summary,
      addedItems: this.readStringArray(entry.addedItems as Prisma.JsonValue),
      changedItems: this.readStringArray(entry.changedItems as Prisma.JsonValue),
      removedItems: this.readStringArray(entry.removedItems as Prisma.JsonValue),
      affectedModules: this.readStringArray(entry.affectedModules as Prisma.JsonValue),
      sourceType: entry.sourceType as ChangelogSourceType,
      publishedAt: entry.publishedAt.toISOString(),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    }
  }
}
