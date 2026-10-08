import { z } from 'zod'

import { isoDateTimeSchema, objectIdSchema } from '../common/primitives'
import { paginatedSchema, paginationQuerySchema } from '../common/pagination'

/** Campos editables de una familia de artículos de venta. */
const familyFields = {
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
}

export const createFamilySchema = z.object(familyFields)
export type CreateFamilyInput = z.infer<typeof createFamilySchema>

export const updateFamilySchema = z.object(familyFields).partial()
export type UpdateFamilyInput = z.infer<typeof updateFamilySchema>

export const familySchema = z.object({
  id: objectIdSchema,
  ...familyFields,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})
export type Family = z.infer<typeof familySchema>

export const listFamiliesQuerySchema = paginationQuerySchema.extend({
  /** Busca por nombre. */
  search: z.string().trim().min(1).optional(),
})
export type ListFamiliesQuery = z.output<typeof listFamiliesQuerySchema>

/** Parámetros de listado tal y como los envía un cliente HTTP. */
export interface ListFamiliesParams {
  page?: number
  pageSize?: number
  search?: string
}

export const familyListSchema = paginatedSchema(familySchema)
