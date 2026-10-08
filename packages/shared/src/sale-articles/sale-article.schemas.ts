import { z } from 'zod'

import { isoDateTimeSchema, objectIdSchema } from '../common/primitives'
import { paginatedSchema, paginationQuerySchema } from '../common/pagination'
import { packageFormatSchema } from './package-format'

/** Código de artículo: exactamente 5 dígitos, conservando los ceros a la izquierda («00123»). */
export const SALE_ARTICLE_CODE_PATTERN = /^\d{5}$/

/** Campos editables de un artículo de venta del obrador. */
const saleArticleFields = {
  code: z.string().trim().regex(SALE_ARTICLE_CODE_PATTERN, 'El código debe tener 5 dígitos numéricos'),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  format: packageFormatSchema,
  unitsPerFormat: z.number().int().positive('Debe ser mayor que 0'),
  /** Precio por formato (la unidad en la que pide la tienda), en euros. */
  price: z.number().nonnegative('El precio no puede ser negativo'),
  /** Familia a la que pertenece. Opcional. */
  familyId: objectIdSchema.nullable(),
  imageUrl: z.url('URL no válida').nullable(),
  active: z.boolean(),
  /** `_id` del artículo de venta equivalente en Amoenus Central, si está vinculado. */
  amoenusSaleItemId: z.string().trim().min(1).nullable(),
}

// Sin `.default()` en los campos base: dentro de `.partial()` Zod 4 seguiría aplicando el
// valor por defecto y un PATCH parcial sobrescribiría campos que no se han enviado.
export const createSaleArticleSchema = z.object({
  ...saleArticleFields,
  familyId: saleArticleFields.familyId.default(null),
  imageUrl: saleArticleFields.imageUrl.default(null),
  active: saleArticleFields.active.default(true),
  amoenusSaleItemId: saleArticleFields.amoenusSaleItemId.default(null),
})
export type CreateSaleArticleInput = z.input<typeof createSaleArticleSchema>
export type CreateSaleArticleData = z.output<typeof createSaleArticleSchema>

export const updateSaleArticleSchema = z.object(saleArticleFields).partial()
export type UpdateSaleArticleInput = z.infer<typeof updateSaleArticleSchema>

export const saleArticleSchema = z.object({
  id: objectIdSchema,
  ...saleArticleFields,
  /** Nombre de la familia (`familyId`), resuelto por la API para mostrarlo en listados. */
  familyName: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})
export type SaleArticle = z.infer<typeof saleArticleSchema>

/** Valor del filtro `familyId` para listar los artículos sin familia. */
export const NO_FAMILY = 'none'

export const listSaleArticlesQuerySchema = paginationQuerySchema.extend({
  /** Busca por código o nombre. */
  search: z.string().trim().min(1).optional(),
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  /** `_id` de una familia, o `NO_FAMILY` para los artículos sin familia. */
  familyId: z.union([objectIdSchema, z.literal(NO_FAMILY)]).optional(),
})
export type ListSaleArticlesQuery = z.output<typeof listSaleArticlesQuerySchema>

/** Parámetros de listado tal y como los envía un cliente HTTP (los booleanos viajan como texto). */
export interface ListSaleArticlesParams {
  page?: number
  pageSize?: number
  search?: string
  active?: boolean
  familyId?: string
}

export const saleArticleListSchema = paginatedSchema(saleArticleSchema)
