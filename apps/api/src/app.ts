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
import { familyRoutes } from './modules/families/family.routes'
import { healthRoutes } from './modules/health/health.routes'
import { saleArticleRoutes } from './modules/sale-articles/sale-article.routes'
import { registerErrorHandler } from './plugins/error-handler'
import { registerSwagger } from './plugins/swagger'

export type AppOptions = Pick<AppConfig, 'nodeEnv' | 'logLevel' | 'corsOrigins' | 'docsEnabled'>

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

/** Rutas de negocio versionadas. Cada módulo nuevo se registra aquí con su prefijo. */
const apiV1Routes: FastifyPluginAsyncZod = async (app) => {
  await app.register(saleArticleRoutes, { prefix: '/sale-articles' })
  await app.register(familyRoutes, { prefix: '/families' })
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
  if (options.docsEnabled) await registerSwagger(app)

  await app.register(healthRoutes)
  await app.register(apiV1Routes, { prefix: '/api/v1' })

  return app
}

export type App = Awaited<ReturnType<typeof buildApp>>
