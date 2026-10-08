import {
  apiErrorSchema,
  createSaleArticleSchema,
  idParamsSchema,
  listSaleArticlesQuerySchema,
  saleArticleListSchema,
  saleArticleSchema,
  updateSaleArticleSchema,
} from '@cocina-central/shared'
import { z } from 'zod'

/** Contrato HTTP de cada ruta: validación de entrada, serialización de salida y OpenAPI. */
const tags = ['sale-articles']

export const listSaleArticlesRoute = {
  tags,
  summary: 'Lista paginada de artículos de venta',
  querystring: listSaleArticlesQuerySchema,
  response: { 200: saleArticleListSchema },
}

export const getSaleArticleRoute = {
  tags,
  summary: 'Detalle de un artículo de venta',
  params: idParamsSchema,
  response: { 200: saleArticleSchema, 404: apiErrorSchema },
}

export const createSaleArticleRoute = {
  tags,
  summary: 'Crea un artículo de venta',
  body: createSaleArticleSchema,
  response: { 201: saleArticleSchema, 409: apiErrorSchema },
}

export const updateSaleArticleRoute = {
  tags,
  summary: 'Modifica parcialmente un artículo de venta',
  params: idParamsSchema,
  body: updateSaleArticleSchema,
  response: { 200: saleArticleSchema, 404: apiErrorSchema, 409: apiErrorSchema },
}

export const deleteSaleArticleRoute = {
  tags,
  summary: 'Elimina un artículo de venta',
  params: idParamsSchema,
  response: { 204: z.undefined(), 404: apiErrorSchema },
}
