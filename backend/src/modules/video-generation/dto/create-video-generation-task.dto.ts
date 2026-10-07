import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class CreateVideoGenerationTaskDto {
  @IsString()
  model!: string

  @IsArray()
  content!: unknown[]

  @IsBoolean()
  generate_audio!: boolean

  @IsString()
  ratio!: string

  @IsInt()
  @Min(-1)
  @Max(12)
  duration!: number

  @IsBoolean()
  watermark!: boolean

  @IsOptional()
  @IsString()
  resolution?: string

  @IsOptional()
  @IsInt()
  seed?: number

  @IsOptional()
  @IsBoolean()
  camera_fixed?: boolean

  @IsOptional()
  @IsBoolean()
  return_last_frame?: boolean

  @IsOptional()
  @IsString()
  callback_url?: string
}
