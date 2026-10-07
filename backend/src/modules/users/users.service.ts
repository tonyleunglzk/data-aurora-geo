import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { Prisma, User, UserStatus } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { hashPassword } from '../../common/utils/security'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'

type UserView = {
  id: number
  name: string
  username: string
  role: string
  phone: string
  status: '启用' | '停用'
  createdAt: string
}

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedInitialUsers()
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: [{ createdAt: 'desc' }],
    })

    return users.map((item) => this.toUserView(item))
  }

  async create(payload: CreateUserDto) {
    await this.ensureUsernameAvailable(payload.username)
    const password = payload.password?.trim()
    if (!password || password.length < 6) {
      throw new BadRequestException('创建用户时必须明确提供至少 6 位密码')
    }

    const user = await this.prisma.user.create({
      data: {
        name: payload.name.trim(),
        username: payload.username.trim(),
        passwordHash: hashPassword(password),
        role: payload.role.trim(),
        phone: payload.phone.trim(),
        status: this.toDbStatus(payload.status),
      },
    })

    return this.toUserView(user)
  }

  async update(id: number, payload: UpdateUserDto) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id },
    })

    if (!currentUser) {
      throw new NotFoundException('用户不存在')
    }

    if (payload.username && payload.username.trim() !== currentUser.username) {
      await this.ensureUsernameAvailable(payload.username)
    }

    const data: Prisma.UserUpdateInput = {}

    if (payload.name !== undefined) data.name = payload.name.trim()
    if (payload.username !== undefined) data.username = payload.username.trim()
    if (payload.role !== undefined) data.role = payload.role.trim()
    if (payload.phone !== undefined) data.phone = payload.phone.trim()
    if (payload.status !== undefined) data.status = this.toDbStatus(payload.status)
    if (payload.password?.trim()) data.passwordHash = hashPassword(payload.password.trim())

    const user = await this.prisma.user.update({
      where: { id },
      data,
    })

    return this.toUserView(user)
  }

  async remove(id: number) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id },
    })

    if (!currentUser) {
      throw new NotFoundException('用户不存在')
    }

    const user = await this.prisma.user.delete({
      where: { id },
    })

    return this.toUserView(user)
  }

  private async seedInitialUsers() {
    const userCount = await this.prisma.user.count()

    if (userCount > 0) return

    const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim()
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim()
    if (!username || !password || password.length < 12) {
      throw new Error('空数据库首次启动需设置 BOOTSTRAP_ADMIN_USERNAME 和至少 12 位的 BOOTSTRAP_ADMIN_PASSWORD；不提供默认账号密码')
    }

    await this.prisma.user.create({
      data: {
        name: '演示管理员',
        username,
        passwordHash: hashPassword(password),
        role: '平台管理员',
        phone: '',
        status: UserStatus.ENABLED,
      },
    })
  }

  private async ensureUsernameAvailable(username: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        username: username.trim(),
      },
    })

    if (existingUser) {
      throw new ConflictException('用户名已存在')
    }
  }

  private toDbStatus(status: '启用' | '停用') {
    return status === '启用' ? UserStatus.ENABLED : UserStatus.DISABLED
  }

  private toViewStatus(status: UserStatus) {
    return status === UserStatus.ENABLED ? '启用' : '停用'
  }

  private formatDate(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  private toUserView(user: User): UserView {
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      phone: user.phone,
      status: this.toViewStatus(user.status),
      createdAt: this.formatDate(user.createdAt),
    }
  }
}
