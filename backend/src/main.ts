import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { json, urlencoded } from 'express'
import { AppModule } from './app.module'

async function bootstrap() {
  const corsOrigin = process.env.CORS_ORIGIN?.trim()
  const originList = corsOrigin
    ? corsOrigin
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : true
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: originList,
    },
    bodyParser: false,
  })

  app.use(json({ limit: '5mb' }))
  app.use(urlencoded({ extended: true, limit: '5mb' }))

  app.setGlobalPrefix('api')
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  )

  const port = Number(process.env.PORT ?? 19988)
  const host = process.env.APP_HOST?.trim() || '127.0.0.1'
  await app.listen(port, host)
}

bootstrap()
