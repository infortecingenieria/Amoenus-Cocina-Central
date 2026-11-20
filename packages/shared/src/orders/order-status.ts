import { z } from 'zod'

/**
 * Ciclo de vida de un pedido de tienda al obrador.
 *
 *   pending ──► approved ──► shipped
 *      ├─► rejected
 *      └─► cancelled
 *
 * `approved` = aprobado por el obrador, con las cantidades que sirve (pueden ser distintas de las
 * solicitadas, o con artículos añadidos: se ve por línea).
 * `shipped` = el obrador ha enviado el pedido a la tienda: es su venta (ticket en Amoenus).
 * `rejected` y `cancelled` son cierres: el pedido no se sirve.
 */
export const ORDER_STATUSES = ['pending', 'approved', 'shipped', 'rejected', 'cancelled'] as const
export const orderStatusSchema = z.enum(ORDER_STATUSES)
export type OrderStatus = z.infer<typeof orderStatusSchema>

/** Los estados del flujo normal; `rejected` y `cancelled` son cierres poco frecuentes. */
export const MAIN_ORDER_STATUSES = [
  'pending',
  'approved',
  'shipped',
] as const satisfies readonly OrderStatus[]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  shipped: 'Enviado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
}

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['shipped'],
  shipped: [],
  rejected: [],
  cancelled: [],
}

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  ORDER_STATUS_TRANSITIONS[from].includes(to)

/** La tienda solo puede editar o cancelar un pedido mientras el obrador no lo ha tramitado. */
export const isEditableByStore = (status: OrderStatus): boolean => status === 'pending'
