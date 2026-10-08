import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import Fastify, { type FastifyServerOptions } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type FastifyPluginAsyncZod,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'

import type { AppConfig } from './config/env'
import { authRoutes } from './modules/auth/auth.routes'
import { familyRoutes } from './modules/families/family.routes'
import { healthRoutes } from './modules/health/health.routes'
import { saleArticleRoutes } from './modules/sale-articles/sale-article.routes'
import { authPlugin } from './plugins/auth'
import { registerErrorHandler } from './plugins/error-handler'
import { registerSwagger } from './plugins/swagger'

export type AppOptions = Pick<
  AppConfig,
  'nodeEnv' | 'logLevel' | 'corsOrigins' | 'docsEnabled' | 'jwtSecret' | 'jwtExpiresIn'
>

const buildLogger = ({ nodeEnv, logLevel }: AppOptions): FastifyServerOptions['logger'] => {
  if (nodeEnv === 'test') return false
  if (nodeEnv === 'development') {
    return {
      level: logLevel,
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    }
  }
  return { level: logLevel }
}

/**
 * Rutas de negocio versionadas. Cada módulo nuevo se registra aquí con su prefijo, dentro del
 * bloque protegido salvo que deba ser público (como el login).
 */
const apiV1Routes: FastifyPluginAsyncZod = async (app) => {
  await app.register(authRoutes, { prefix: '/auth' })

  // Todo lo registrado aquí exige sesión iniciada.
  await app.register(async (protectedApp) => {
    protectedApp.addHook('onRequest', protectedApp.authenticate)

    await protectedApp.register(saleArticleRoutes, { prefix: '/sale-articles' })
    await protectedApp.register(familyRoutes, { prefix: '/families' })
  })
}

/**
 * Construye la instancia de Fastify sin abrir conexiones ni puertos, para poder usarla
 * tanto desde `server.ts` como desde los tests (`app.inject`).
 */
export async function buildApp(options: AppOptions) {
  const app = Fastify({ logger: buildLogger(options) }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  registerErrorHandler(app)

  await app.register(helmet)
  await app.register(cors, { origin: options.corsOrigins })
  await app.register(authPlugin, {
    jwtSecret: options.jwtSecret,
    jwtExpiresIn: options.jwtExpiresIn,
  })
  if (options.docsEnabled) await registerSwagger(app)

  await app.register(healthRoutes)
  await app.register(apiV1Routes, { prefix: '/api/v1' })

  return app
}

export type App = Awaited<ReturnType<typeof buildApp>>
