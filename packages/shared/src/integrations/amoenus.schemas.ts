import { z } from 'zod'

import { isoDateSchema, isoDateTimeSchema, objectIdSchema } from '../common/primitives'
import { MAX_ORDER_LINE_QUANTITY } from '../orders/order.schemas'
import { saleArticleCodeSchema } from '../sale-articles/sale-article.schemas'

/** Cabecera con la clave de API que identifica a Amoenus Central en las rutas de integración. */
export const INTEGRATION_API_KEY_HEADER = 'x-api-key'

/** Línea de un pedido de Amoenus: el artículo se identifica por su código en Cocina Central. */
export const amoenusOrderLineSchema = z.object({
  code: saleArticleCodeSchema,
  /** Número de formatos pedidos (bandejas, cajas…): la unidad de servicio del proveedor en Amoenus. */
  quantity: z
    .number()
    .int('Debe ser un número entero')
    .min(1, 'La cantidad debe ser mayor que 0')
    .max(MAX_ORDER_LINE_QUANTITY, `Máximo ${MAX_ORDER_LINE_QUANTITY}`),
})

/** Un mismo artículo no puede aparecer en dos líneas del pedido. */
const uniqueCodes = (lines: { code: string }[], ctx: z.RefinementCtx) => {
  const seen = new Set<string>()
  lines.forEach((line, index) => {
    if (seen.has(line.code)) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'code'],
        message: 'El artículo está repetido en el pedido',
      })
    }
    seen.add(line.code)
  })
}

/** Pedido a proveedor creado en Amoenus Central para el obrador. */
export const amoenusOrderSchema = z.object({
  /** `_id` del pedido en Amoenus: reenviar el mismo pedido no lo duplica. */
  externalOrderId: objectIdSchema,
  clientId: objectIdSchema,
  localId: objectIdSchema,
  /** Nombre del local en Amoenus: es la tienda del pedido. */
  localName: z.string().trim().min(1, 'El local es obligatorio').max(120),
  /** Usuario de Amoenus que ha hecho el pedido. */
  createdByName: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(500, 'Máximo 500 caracteres').nullable().default(null),
  lines: z
    .array(amoenusOrderLineSchema)
    .min(1, 'El pedido debe tener al menos un artículo')
    .superRefine(uniqueCodes),
})
export type AmoenusOrderInput = z.input<typeof amoenusOrderSchema>
export type AmoenusOrderData = z.output<typeof amoenusOrderSchema>

// --- Envíos de Cocina Central a Amoenus ------------------------------------------------------

/** Albarán tal y como lo recibe Amoenus: lo pedido y lo servido de cada artículo, por su código. */
export const amoenusDeliveryNoteSchema = z.object({
  number: z.string(),
  issuedAt: isoDateTimeSchema,
  lines: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      requestedQty: z.number().int(),
      deliveredQty: z.number().int(),
      unitPrice: z.number(),
    }),
  ),
})
export type AmoenusDeliveryNote = z.infer<typeof amoenusDeliveryNoteSchema>

/** Albarán que se envía a Amoenus al aprobar un pedido suyo: el pedido se corrige con lo servido. */
export const amoenusDeliveryNotePayloadSchema = z.object({
  /** `_id` del pedido a proveedor en Amoenus (`amoenus.externalOrderId` del pedido). */
  externalOrderId: z.string(),
  /** Número del pedido en Cocina Central («PED-2026-0001»), que Amoenus guarda en `orderCode`. */
  orderNumber: z.string(),
  deliveryNote: amoenusDeliveryNoteSchema,
})
export type AmoenusDeliveryNotePayload = z.infer<typeof amoenusDeliveryNotePayloadSchema>

/**
 * Pedido de una tienda vinculada a un local de Amoenus, aprobado por el obrador. Amoenus lo da de
 * alta como pedido a proveedor (Cocina Central) del local, ya con su albarán.
 */
export const amoenusStoreOrderPayloadSchema = z.object({
  /** `id` del pedido en Cocina Central. */
  orderId: objectIdSchema,
  /** «PED-2026-0001»: identifica el pedido en Amoenus (`orderCode`), así que reenviarlo no lo duplica. */
  orderNumber: z.string(),
  /** Local de Amoenus de la tienda. El cliente lo sabe Amoenus por la clave de API. */
  localId: z.string(),
  storeName: z.string(),
  createdByName: z.string(),
  createdAt: isoDateTimeSchema,
  notes: z.string().nullable(),
  deliveryNote: amoenusDeliveryNoteSchema,
})
export type AmoenusStoreOrderPayload = z.infer<typeof amoenusStoreOrderPayloadSchema>

/** Rechazo de un pedido de Amoenus: allí queda marcado como rechazado y no se puede recepcionar. */
export const amoenusRejectionPayloadSchema = z.object({
  externalOrderId: z.string(),
  orderNumber: z.string(),
  reason: z.string(),
  rejectedAt: isoDateTimeSchema,
  rejectedBy: z.string(),
})
export type AmoenusRejectionPayload = z.infer<typeof amoenusRejectionPayloadSchema>

// --- Cocina Central como TPV del obrador -----------------------------------------------------

/** Por dónde hizo la tienda el pedido: desde Amoenus App o desde Cocina Central. */
export const AMOENUS_SALE_CHANNELS = ['amoenus', 'cocina_central'] as const

/**
 * Venta del obrador: un pedido aprobado, como ticket. Amoenus lo carga en el cliente y el local del
 * obrador (los sabe por la clave de API) y sigue el flujo de cualquier TPV: ventas, mix y consumos
 * según el escandallo. Sin IVA: es un intercambio interno entre el obrador y sus tiendas.
 */
export const amoenusSaleTicketPayloadSchema = z.object({
  orderId: objectIdSchema,
  /** «PED-2026-0001»: es el número del ticket, así que reenviarlo lo sustituye. */
  orderNumber: z.string(),
  /**
   * «ALB-2026-0001»: el mismo número que el albarán del pedido de la tienda, así que une el ticket
   * con la tienda. Es lo único que el ticket registra de ella.
   */
  deliveryNoteNumber: z.string(),
  channel: z.enum(AMOENUS_SALE_CHANNELS),
  /** Quién aprobó el pedido. */
  operatorName: z.string(),
  /** Día de la aprobación en hora de Madrid. */
  businessDate: isoDateSchema,
  /** «09:45», hora de Madrid. */
  time: z.string(),
  /** Lo servido: en formatos (bandejas, cajas…) y a precio de Cocina Central. */
  lines: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      quantity: z.number().int(),
      unitPrice: z.number(),
    }),
  ),
})
export type AmoenusSaleTicketPayload = z.infer<typeof amoenusSaleTicketPayloadSchema>

/**
 * Catálogo del obrador: Amoenus da de alta o actualiza sus artículos de venta por código, sin tocar
 * el escandallo.
 */
export const amoenusSaleArticlesPayloadSchema = z.object({
  articles: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      /** Nombre de la familia; null = sin familia. */
      family: z.string().nullable(),
      /** Precio por formato. */
      price: z.number(),
      active: z.boolean(),
    }),
  ),
})
export type AmoenusSaleArticlesPayload = z.infer<typeof amoenusSaleArticlesPayloadSchema>

/** Resultado de enviar todo el catálogo a Amoenus desde el mantenimiento de artículos. */
export const amoenusCatalogSyncResultSchema = z.object({
  /** Artículos enviados (activos e inactivos). */
  articles: z.number().int(),
  /** null = recibido en Amoenus; si no, por qué ha fallado. */
  error: z.string().nullable(),
})
export type AmoenusCatalogSyncResult = z.infer<typeof amoenusCatalogSyncResultSchema>
