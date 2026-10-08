import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import { SaleArticleRepository } from '../sale-articles/sale-article.repository'
import { FamilyController } from './family.controller'
import { FamilyRepository } from './family.repository'
import {
  createFamilyRoute,
  deleteFamilyRoute,
  getFamilyRoute,
  listFamiliesRoute,
  updateFamilyRoute,
} from './family.schemas'
import { FamilyService } from './family.service'

export const familyRoutes: FastifyPluginAsyncZod = async (app) => {
  const controller = new FamilyController(
    new FamilyService(new FamilyRepository(), new SaleArticleRepository()),
  )

  // Consultar: cualquier usuario. Modificar: solo el obrador.
  const onlyKitchenAdmin = app.requireRole('kitchen_admin')

  app.get('/', { schema: listFamiliesRoute }, controller.list)
  app.get('/:id', { schema: getFamilyRoute }, controller.getById)
  app.post('/', { schema: createFamilyRoute, preHandler: onlyKitchenAdmin }, controller.create)
  app.patch('/:id', { schema: updateFamilyRoute, preHandler: onlyKitchenAdmin }, controller.update)
  app.delete('/:id', { schema: deleteFamilyRoute, preHandler: onlyKitchenAdmin }, controller.delete)
}
