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
import { DeliveryNoteRepository } from './modules/delivery-notes/delivery-note.repository'
import { DeliveryNoteService } from './modules/delivery-notes/delivery-note.service'
import { familyRoutes } from './modules/families/family.routes'
import { healthRoutes } from './modules/health/health.routes'
import { AmoenusSyncService } from './modules/integrations/amoenus/amoenus-sync.service'
import {
  HttpAmoenusClient,
  type AmoenusClient,
} from './modules/integrations/amoenus/amoenus.client'
import {
  amoenusIntegrationRoutes,
  amoenusSyncRoutes,
} from './modules/integrations/amoenus/amoenus.routes'
import { OrderRepository } from './modules/orders/order.repository'
import { orderRoutes } from './modules/orders/order.routes'
import { saleArticleRoutes } from './modules/sale-articles/sale-article.routes'
import { authPlugin } from './plugins/auth'
import { registerErrorHandler } from './plugins/error-handler'
import { registerSwagger } from './plugins/swagger'

export type AppOptions = Pick<
  AppConfig,
  | 'nodeEnv'
  | 'logLevel'
  | 'corsOrigins'
  | 'docsEnabled'
  | 'jwtSecret'
  | 'jwtExpiresIn'
  | 'amoenusApiKey'
  | 'amoenusApiUrl'
> & {
  /** Sustituye al cliente HTTP de Amoenus (tests). */
  amoenusClient?: AmoenusClient
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Envíos a Amoenus de los pedidos resueltos; `server.ts` reintenta los pendientes. */
    amoenusSync: AmoenusSyncService
  }
}

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
const apiV1Routes: FastifyPluginAsyncZod<Pick<AppOptions, 'amoenusApiKey'>> = async (
  app,
  { amoenusApiKey },
) => {
  await app.register(authRoutes, { prefix: '/auth' })

  // Integraciones de máquina a máquina: se autentican con clave de API, no con sesión.
  await app.register(amoenusIntegrationRoutes, {
    prefix: '/integrations/amoenus',
    apiKey: amoenusApiKey,
  })

  // Todo lo registrado aquí exige sesión iniciada.
  await app.register(async (protectedApp) => {
    protectedApp.addHook('onRequest', protectedApp.authenticate)

    await protectedApp.register(saleArticleRoutes, { prefix: '/sale-articles' })
    await protectedApp.register(familyRoutes, { prefix: '/families' })
    await protectedApp.register(orderRoutes, { prefix: '/orders' })
    await protectedApp.register(amoenusSyncRoutes, { prefix: '/orders' })
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

  app.decorate(
    'amoenusSync',
    new AmoenusSyncService(
      new OrderRepository(),
      new DeliveryNoteService(new DeliveryNoteRepository()),
      options.amoenusClient ??
        new HttpAmoenusClient({ baseUrl: options.amoenusApiUrl, apiKey: options.amoenusApiKey }),
      app.log,
    ),
  )

  await app.register(healthRoutes)
  await app.register(apiV1Routes, { prefix: '/api/v1', amoenusApiKey: options.amoenusApiKey })

  return app
}

export type App = Awaited<ReturnType<typeof buildApp>>
