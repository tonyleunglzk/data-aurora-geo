import { IsIn, IsMobilePhone, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator'

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsString()
  @IsNotEmpty()
  username!: string

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string

  @IsString()
  @IsNotEmpty()
  role!: string

  @IsMobilePhone('zh-CN')
  phone!: string

  @IsString()
  @IsIn(['启用', '停用'])
  status!: '启用' | '停用'
}
