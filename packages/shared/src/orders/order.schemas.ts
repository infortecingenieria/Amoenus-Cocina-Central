import { z } from 'zod'

import { isoDateTimeSchema, objectIdSchema } from '../common/primitives'
import { paginatedSchema, paginationQuerySchema } from '../common/pagination'
import { packageFormatSchema } from '../sale-articles/package-format'
import { orderStatusSchema, type OrderStatus } from './order-status'

/** Máximo de formatos (bandejas, cajas…) de un artículo en una línea de pedido. */
export const MAX_ORDER_LINE_QUANTITY = 9999

const notesSchema = z.string().trim().max(500, 'Máximo 500 caracteres').nullable()

/** Motivo de un rechazo o de una aprobación con cambios: la tienda lo ve en el pedido. */
const reasonSchema = z.string().trim().min(1, 'Indica el motivo').max(500, 'Máximo 500 caracteres')

const quantitySchema = z
  .number()
  .int('Debe ser un número entero')
  .max(MAX_ORDER_LINE_QUANTITY, `Máximo ${MAX_ORDER_LINE_QUANTITY}`)

/** Un mismo artículo no puede aparecer en dos líneas del pedido. */
const uniqueArticles = (lines: { saleArticleId: string }[], ctx: z.RefinementCtx) => {
  const seen = new Set<string>()
  lines.forEach((line, index) => {
    if (seen.has(line.saleArticleId)) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'saleArticleId'],
        message: 'El artículo está repetido en el pedido',
      })
    }
    seen.add(line.saleArticleId)
  })
}

// --- Alta (tienda) ---------------------------------------------------------------------------

export const createOrderLineSchema = z.object({
  saleArticleId: objectIdSchema,
  /** Número de formatos pedidos (bandejas, cajas…), no de unidades sueltas. */
  quantity: quantitySchema.min(1, 'La cantidad debe ser mayor que 0'),
})

export const createOrderSchema = z.object({
  notes: notesSchema.default(null),
  lines: z
    .array(createOrderLineSchema)
    .min(1, 'El pedido debe tener al menos un artículo')
    .superRefine(uniqueArticles),
})
export type CreateOrderInput = z.input<typeof createOrderSchema>
export type CreateOrderData = z.output<typeof createOrderSchema>

// --- Validación (obrador) --------------------------------------------------------------------

export const approveOrderLineSchema = z.object({
  saleArticleId: objectIdSchema,
  /** Formatos que servirá el obrador. 0 = no se sirve esa línea. */
  confirmedQty: quantitySchema.min(0, 'La cantidad no puede ser negativa'),
})

/**
 * Las líneas que no se envían se aprueban con la cantidad pedida. Si alguna cantidad cambia, el
 * pedido queda `modified` en lugar de `approved` y el motivo es obligatorio.
 */
export const approveOrderSchema = z.object({
  lines: z.array(approveOrderLineSchema).superRefine(uniqueArticles).optional(),
  reason: reasonSchema.optional(),
})
export type ApproveOrderInput = z.infer<typeof approveOrderSchema>

export const rejectOrderSchema = z.object({
  reason: reasonSchema,
})
export type RejectOrderInput = z.infer<typeof rejectOrderSchema>

// --- Respuestas ------------------------------------------------------------------------------

/** Línea del pedido con una copia del artículo, para que el histórico no cambie con el catálogo. */
export const orderLineSchema = z.object({
  saleArticleId: objectIdSchema,
  code: z.string(),
  name: z.string(),
  format: packageFormatSchema,
  unitsPerFormat: z.number().int(),
  /** Precio por formato en el momento de pedir. */
  unitPrice: z.number(),
  requestedQty: z.number().int(),
  /** Cantidad que sirve el obrador; null mientras no se ha aprobado. */
  confirmedQty: z.number().int().nullable(),
})
export type OrderLine = z.infer<typeof orderLineSchema>

/** Cambio de estado del pedido: quién, cuándo y, si se rechaza, por qué. */
export const orderStatusEntrySchema = z.object({
  status: orderStatusSchema,
  at: isoDateTimeSchema,
  userId: objectIdSchema,
  userName: z.string(),
  reason: z.string().nullable(),
})
export type OrderStatusEntry = z.infer<typeof orderStatusEntrySchema>

const orderBaseSchema = z.object({
  id: objectIdSchema,
  /** Número correlativo por año: «PED-2026-0001». */
  number: z.string(),
  // TODO: pasará a `storeId` cuando exista el módulo de tiendas.
  storeName: z.string(),
  status: orderStatusSchema,
  notes: z.string().nullable(),
  /** Importe con las cantidades confirmadas o, si aún no las hay, las pedidas. */
  total: z.number(),
  createdBy: z.object({ id: objectIdSchema, displayName: z.string() }),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export const orderSchema = orderBaseSchema.extend({
  lines: z.array(orderLineSchema),
  statusHistory: z.array(orderStatusEntrySchema),
})
export type Order = z.infer<typeof orderSchema>

/** Pedido tal y como aparece en el listado de solicitudes (sin líneas ni historial). */
export const orderSummarySchema = orderBaseSchema.extend({
  /** Número de artículos distintos. */
  lineCount: z.number().int(),
  /** Formatos en total (bandejas, cajas…), con el mismo criterio que `total`. */
  totalQuantity: z.number().int(),
})
export type OrderSummary = z.infer<typeof orderSummarySchema>

export const orderListSchema = paginatedSchema(orderSummarySchema)

/** Orden del listado por fecha de creación: `-createdAt` = más nuevos primero. */
export const ORDER_SORTS = ['-createdAt', 'createdAt'] as const
export type OrderSort = (typeof ORDER_SORTS)[number]

export const listOrdersQuerySchema = paginationQuerySchema.extend({
  /** Uno o varios estados separados por comas: `?status=pending,modified`. */
  status: z
    .string()
    .transform((value) => value.split(',').map((status) => status.trim()))
    .pipe(z.array(orderStatusSchema).min(1))
    .optional(),
  /** Busca por número de pedido o tienda. */
  search: z.string().trim().min(1).optional(),
  sort: z.enum(ORDER_SORTS).default('-createdAt'),
})
export type ListOrdersQuery = z.output<typeof listOrdersQuerySchema>

/** Parámetros de listado tal y como los envía un cliente HTTP (los estados viajan unidos por comas). */
export interface ListOrdersParams {
  page?: number
  pageSize?: number
  status?: OrderStatus[]
  search?: string
  sort?: OrderSort
}

// --- Importes --------------------------------------------------------------------------------

/** Redondea a céntimos para no arrastrar errores de coma flotante. */
const roundToCents = (value: number): number => Math.round(value * 100) / 100

/** Cantidad que cuenta para el importe: la confirmada por el obrador o, si no hay, la pedida. */
export const effectiveQuantity = (line: Pick<OrderLine, 'requestedQty' | 'confirmedQty'>): number =>
  line.confirmedQty ?? line.requestedQty

export const orderLineTotal = (
  line: Pick<OrderLine, 'unitPrice' | 'requestedQty' | 'confirmedQty'>,
): number => roundToCents(line.unitPrice * effectiveQuantity(line))

/** Formatos en total del pedido. */
export const calculateTotalQuantity = (
  lines: readonly Pick<OrderLine, 'requestedQty' | 'confirmedQty'>[],
): number => lines.reduce((sum, line) => sum + effectiveQuantity(line), 0)

export const calculateOrderTotal = (
  lines: readonly Pick<OrderLine, 'unitPrice' | 'requestedQty' | 'confirmedQty'>[],
): number => roundToCents(lines.reduce((sum, line) => sum + orderLineTotal(line), 0))
