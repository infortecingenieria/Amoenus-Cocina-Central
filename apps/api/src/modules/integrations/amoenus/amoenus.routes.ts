import { createHash, timingSafeEqual } from 'node:crypto'

import { INTEGRATION_API_KEY_HEADER } from '@cocina-central/shared'
import type { FastifyRequest } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import { UnauthorizedError } from '../../../shared/errors'
import { UserRepository } from '../../auth/user.repository'
import { OrderRepository } from '../../orders/order.repository'
import { OrderService } from '../../orders/order.service'
import { SaleArticleRepository } from '../../sale-articles/sale-article.repository'
import { AmoenusIntegrationController } from './amoenus.controller'
import { receiveAmoenusOrderRoute } from './amoenus.schemas'
import { AmoenusIntegrationService } from './amoenus.service'

export interface AmoenusRoutesOptions {
  /** Clave que Amoenus envía en `X-Api-Key`. null = integración desactivada (todo responde 401). */
  apiKey: string | null
}

/** Compara los resúmenes SHA-256 para que el tiempo no dependa de la longitud ni del contenido. */
const sameKey = (provided: string, expected: string): boolean =>
  timingSafeEqual(
    createHash('sha256').update(provided).digest(),
    createHash('sha256').update(expected).digest(),
  )

/**
 * Rutas que usa Amoenus Central, de máquina a máquina: no van con sesión de usuario (JWT) sino
 * con una clave de API compartida.
 */
export const amoenusIntegrationRoutes: FastifyPluginAsyncZod<AmoenusRoutesOptions> = async (
  app,
  { apiKey },
) => {
  const orderRepository = new OrderRepository()
  const saleArticles = new SaleArticleRepository()
  const controller = new AmoenusIntegrationController(
    new AmoenusIntegrationService(
      new OrderService(orderRepository, saleArticles),
      orderRepository,
      saleArticles,
      new UserRepository(),
    ),
  )

  app.addHook('onRequest', async (request: FastifyRequest) => {
    const provided = request.headers[INTEGRATION_API_KEY_HEADER]
    if (!apiKey || typeof provided !== 'string' || !sameKey(provided, apiKey)) {
      throw new UnauthorizedError('Clave de integración no válida')
    }
  })

  app.post('/orders', { schema: receiveAmoenusOrderRoute }, controller.receiveOrder)
}
