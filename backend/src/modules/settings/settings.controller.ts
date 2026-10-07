import { Body, Controller, Get, Put } from '@nestjs/common'
import { SettingsService } from './settings.service'
import { UpdateSettingsDto } from './dto/update-settings.dto'

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  findOne() {
    return this.settingsService.findOne()
  }

  @Put()
  update(@Body() payload: UpdateSettingsDto) {
    return this.settingsService.update(payload)
  }
}
