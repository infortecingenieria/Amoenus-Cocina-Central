import { z } from 'zod'

import { isoDateTimeSchema } from '../common/primitives'
import type { OrderStatus } from '../orders/order-status'

/**
 * Relación de un pedido con Amoenus Central:
 * - `amoenus_order`: lo hizo un local en Amoenus y llegó por la integración.
 * - `linked_store`: lo hizo aquí una tienda vinculada a un local de Amoenus.
 */
export const AMOENUS_ORDER_ORIGINS = ['amoenus_order', 'linked_store'] as const
export type AmoenusOrderOrigin = (typeof AMOENUS_ORDER_ORIGINS)[number]

/** Resultado del último intento de envío a Amoenus. */
export const AMOENUS_SYNC_STATUSES = ['sent', 'failed'] as const

/**
 * Envío a Amoenus de cómo ha resuelto el obrador el pedido. null mientras no se ha intentado; si
 * falla, el pedido sigue resuelto aquí y el envío se reintenta.
 */
export const amoenusSyncSchema = z.object({
  status: z.enum(AMOENUS_SYNC_STATUSES),
  attempts: z.number().int(),
  lastError: z.string().nullable(),
  lastAttemptAt: isoDateTimeSchema,
  sentAt: isoDateTimeSchema.nullable(),
})
export type AmoenusSync = z.infer<typeof amoenusSyncSchema>

const linkBaseShape = {
  /** Local de Amoenus del pedido. */
  localId: z.string(),
  sync: amoenusSyncSchema.nullable(),
}

export const amoenusOrderLinkSchema = z.discriminatedUnion('origin', [
  z.object({
    origin: z.literal('amoenus_order'),
    /** `_id` del pedido a proveedor en Amoenus. */
    externalOrderId: z.string(),
    clientId: z.string(),
    ...linkBaseShape,
  }),
  z.object({ origin: z.literal('linked_store'), ...linkBaseShape }),
])
export type AmoenusOrderLink = z.infer<typeof amoenusOrderLinkSchema>

/**
 * Qué se comunica a Amoenus. De un pedido que viene de allí, el albarán al aprobar o el rechazo; de
 * un pedido de una tienda vinculada, el pedido con su albarán al aprobar.
 */
export const AMOENUS_SYNC_EVENTS = ['delivery_note', 'rejection', 'store_order'] as const
export type AmoenusSyncEvent = (typeof AMOENUS_SYNC_EVENTS)[number]

const APPROVED_STATUSES: readonly OrderStatus[] = [
  'approved',
  'modified',
  'in_preparation',
  'delivered',
]

/**
 * Estados en los que un pedido tiene algo que comunicar a Amoenus, según su origen. El de una tienda
 * rechazado o cancelado no se envía: en Amoenus nunca llegó a existir.
 */
export const AMOENUS_SYNCED_STATUSES: Record<AmoenusOrderOrigin, readonly OrderStatus[]> = {
  amoenus_order: [...APPROVED_STATUSES, 'rejected'],
  linked_store: APPROVED_STATUSES,
}

interface AmoenusLinkedOrder {
  status: OrderStatus
  amoenus: AmoenusOrderLink | null
}

/** Lo que hay que comunicar a Amoenus del pedido en su estado actual; null si nada. */
export const amoenusEventFor = ({ status, amoenus }: AmoenusLinkedOrder): AmoenusSyncEvent | null => {
  if (!amoenus || !AMOENUS_SYNCED_STATUSES[amoenus.origin].includes(status)) return null
  if (amoenus.origin === 'linked_store') return 'store_order'
  return status === 'rejected' ? 'rejection' : 'delivery_note'
}

/** El pedido lo hizo un local en Amoenus (no una tienda desde esta aplicación). */
export const isFromAmoenus = ({ amoenus }: Pick<AmoenusLinkedOrder, 'amoenus'>): boolean =>
  amoenus?.origin === 'amoenus_order'
