import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common'
import { ChangelogService } from './changelog.service'
import { AutoGenerateChangelogEntryDto } from './dto/auto-generate-changelog-entry.dto'
import { CreateChangelogEntryDto } from './dto/create-changelog-entry.dto'
import { UpdateChangelogEntryDto } from './dto/update-changelog-entry.dto'

@Controller('changelog-entries')
export class ChangelogController {
  constructor(private readonly changelogService: ChangelogService) {}

  @Get()
  findAll() {
    return this.changelogService.findAll()
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.changelogService.findOne(id)
  }

  @Post()
  create(@Body() payload: CreateChangelogEntryDto) {
    return this.changelogService.create(payload)
  }

  @Post('auto-generate')
  autoGenerate(@Body() payload: AutoGenerateChangelogEntryDto) {
    return this.changelogService.autoGenerate(payload)
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() payload: UpdateChangelogEntryDto) {
    return this.changelogService.update(id, payload)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.changelogService.remove(id)
  }
}
