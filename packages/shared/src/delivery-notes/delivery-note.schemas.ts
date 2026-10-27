import { z } from 'zod'

import { isoDateSchema, isoDateTimeSchema, objectIdSchema } from '../common/primitives'
import { packageFormatSchema } from '../sale-articles/package-format'

/** Línea del albarán: copia del artículo del pedido con lo pedido y lo que sirve el obrador. */
export const deliveryNoteLineSchema = z.object({
  saleArticleId: objectIdSchema,
  code: z.string(),
  name: z.string(),
  format: packageFormatSchema,
  unitsPerFormat: z.number().int(),
  /** Precio por formato. */
  unitPrice: z.number(),
  /** Formatos pedidos por la tienda. */
  requestedQty: z.number().int(),
  /** Formatos que sirve el obrador (0 = no se sirve). */
  deliveredQty: z.number().int(),
  /** Nº de lote y caducidad de lo servido, si el obrador los ha indicado. */
  lotNumber: z.string().nullable(),
  expiryDate: isoDateSchema.nullable(),
})
export type DeliveryNoteLine = z.infer<typeof deliveryNoteLineSchema>

/** Albarán de entrega: se genera al aprobar el pedido, con las cantidades confirmadas. */
export const deliveryNoteSchema = z.object({
  id: objectIdSchema,
  /** Número correlativo por año: «ALB-2026-0001». */
  number: z.string(),
  orderId: objectIdSchema,
  orderNumber: z.string(),
  storeName: z.string(),
  issuedAt: isoDateTimeSchema,
  lines: z.array(deliveryNoteLineSchema),
  /** Importe de lo servido. */
  total: z.number(),
})
export type DeliveryNote = z.infer<typeof deliveryNoteSchema>

/** Referencia al albarán desde el pedido. */
export const deliveryNoteRefSchema = z.object({
  id: objectIdSchema,
  number: z.string(),
})
export type DeliveryNoteRef = z.infer<typeof deliveryNoteRefSchema>
