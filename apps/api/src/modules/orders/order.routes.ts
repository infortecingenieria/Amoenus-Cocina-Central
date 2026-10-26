import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import { DeliveryNoteRepository } from '../delivery-notes/delivery-note.repository'
import { DeliveryNoteService } from '../delivery-notes/delivery-note.service'
import { SaleArticleRepository } from '../sale-articles/sale-article.repository'
import { OrderController } from './order.controller'
import { OrderRepository } from './order.repository'
import {
  approveOrderRoute,
  cancelOrderRoute,
  createOrderRoute,
  getOrderRoute,
  listOrdersRoute,
  rejectOrderRoute,
  resendToAmoenusRoute,
} from './order.schemas'
import { OrderService } from './order.service'

export const orderRoutes: FastifyPluginAsyncZod = async (app) => {
  const controller = new OrderController(
    new OrderService(
      new OrderRepository(),
      new SaleArticleRepository(),
      new DeliveryNoteService(new DeliveryNoteRepository()),
      app.amoenusSync,
    ),
  )

  // La tienda hace y cancela sus pedidos; el obrador los valida. Consultar: los dos.
  const onlyStore = app.requireRole('store')
  const onlyKitchenAdmin = app.requireRole('kitchen_admin')

  app.get('/', { schema: listOrdersRoute }, controller.list)
  app.get('/:id', { schema: getOrderRoute }, controller.getById)
  app.post('/', { schema: createOrderRoute, preHandler: onlyStore }, controller.create)
  app.post(
    '/:id/approve',
    { schema: approveOrderRoute, preHandler: onlyKitchenAdmin },
    controller.approve,
  )
  app.post(
    '/:id/reject',
    { schema: rejectOrderRoute, preHandler: onlyKitchenAdmin },
    controller.reject,
  )
  app.post('/:id/cancel', { schema: cancelOrderRoute, preHandler: onlyStore }, controller.cancel)
  app.post(
    '/:id/amoenus-sync',
    { schema: resendToAmoenusRoute, preHandler: onlyKitchenAdmin },
    controller.resendToAmoenus,
  )
}
