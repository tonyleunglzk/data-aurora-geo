import { Injectable, UnauthorizedException } from '@nestjs/common'
import { UserStatus } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { hashPassword, issueAccessToken } from '../../common/utils/security'
import { LoginDto } from './dto/login.dto'

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(payload: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        username: payload.username,
      },
    })

    if (!user || user.passwordHash !== hashPassword(payload.password)) {
      throw new UnauthorizedException('用户名或密码错误')
    }

    if (user.status === UserStatus.DISABLED) {
      throw new UnauthorizedException('当前账号已停用')
    }

    return {
      accessToken: issueAccessToken(user.id, user.username),
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        avatar: (user.name || user.username).slice(0, 1).toUpperCase(),
      },
    }
  }
}
