import {
  apiErrorSchema,
  createFamilySchema,
  familyListSchema,
  familySchema,
  idParamsSchema,
  listFamiliesQuerySchema,
  updateFamilySchema,
} from '@cocina-central/shared'
import { z } from 'zod'

/** Contrato HTTP de cada ruta: validación de entrada, serialización de salida y OpenAPI. */
const tags = ['families']

export const listFamiliesRoute = {
  tags,
  summary: 'Lista paginada de familias de artículos',
  querystring: listFamiliesQuerySchema,
  response: { 200: familyListSchema },
}

export const getFamilyRoute = {
  tags,
  summary: 'Detalle de una familia',
  params: idParamsSchema,
  response: { 200: familySchema, 404: apiErrorSchema },
}

export const createFamilyRoute = {
  tags,
  summary: 'Crea una familia',
  body: createFamilySchema,
  response: { 201: familySchema, 409: apiErrorSchema },
}

export const updateFamilyRoute = {
  tags,
  summary: 'Modifica una familia',
  params: idParamsSchema,
  body: updateFamilySchema,
  response: { 200: familySchema, 404: apiErrorSchema, 409: apiErrorSchema },
}

export const deleteFamilyRoute = {
  tags,
  summary: 'Elimina una familia sin artículos asignados',
  params: idParamsSchema,
  response: { 204: z.undefined(), 404: apiErrorSchema, 409: apiErrorSchema },
}
