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

  app.get('/', { schema: listFamiliesRoute }, controller.list)
  app.get('/:id', { schema: getFamilyRoute }, controller.getById)
  app.post('/', { schema: createFamilyRoute }, controller.create)
  app.patch('/:id', { schema: updateFamilyRoute }, controller.update)
  app.delete('/:id', { schema: deleteFamilyRoute }, controller.delete)
}
