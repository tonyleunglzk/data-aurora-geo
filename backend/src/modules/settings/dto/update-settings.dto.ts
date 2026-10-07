import { IsBoolean, IsNotEmpty, IsString } from 'class-validator'

export class UpdateSettingsDto {
  @IsString()
  @IsNotEmpty()
  systemName!: string

  @IsBoolean()
  notificationsEnabled!: boolean
}
