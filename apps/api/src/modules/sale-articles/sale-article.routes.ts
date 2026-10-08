import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import { FamilyRepository } from '../families/family.repository'
import { SaleArticleController } from './sale-article.controller'
import { SaleArticleRepository } from './sale-article.repository'
import {
  createSaleArticleRoute,
  deleteSaleArticleRoute,
  getSaleArticleRoute,
  listSaleArticlesRoute,
  updateSaleArticleRoute,
} from './sale-article.schemas'
import { SaleArticleService } from './sale-article.service'

export const saleArticleRoutes: FastifyPluginAsyncZod = async (app) => {
  const controller = new SaleArticleController(
    new SaleArticleService(new SaleArticleRepository(), new FamilyRepository()),
  )

  app.get('/', { schema: listSaleArticlesRoute }, controller.list)
  app.get('/:id', { schema: getSaleArticleRoute }, controller.getById)
  app.post('/', { schema: createSaleArticleRoute }, controller.create)
  app.patch('/:id', { schema: updateSaleArticleRoute }, controller.update)
  app.delete('/:id', { schema: deleteSaleArticleRoute }, controller.delete)
}
