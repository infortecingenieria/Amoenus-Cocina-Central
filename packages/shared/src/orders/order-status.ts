import { z } from 'zod'

/**
 * Ciclo de vida de un pedido de tienda al obrador.
 *
 *   pending ──► approved ──┬──────────────────────► shipped ──► delivered
 *      │    └─► modified ──┴─► in_preparation ───┘
 *      ├─► rejected
 *      └─► cancelled
 *
 * `modified` = aprobado por el obrador con cantidades distintas a las solicitadas.
 * `shipped` = el obrador ha enviado el pedido a la tienda: es su venta (ticket en Amoenus).
 */
export const ORDER_STATUSES = [
  'pending',
  'approved',
  'modified',
  'in_preparation',
  'shipped',
  'delivered',
  'rejected',
  'cancelled',
] as const
export const orderStatusSchema = z.enum(ORDER_STATUSES)
export type OrderStatus = z.infer<typeof orderStatusSchema>

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  modified: 'Modificado por obrador',
  in_preparation: 'En preparación',
  shipped: 'Enviado',
  delivered: 'Entregado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
}

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['approved', 'modified', 'rejected', 'cancelled'],
  approved: ['in_preparation', 'shipped'],
  modified: ['in_preparation', 'shipped'],
  in_preparation: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  rejected: [],
  cancelled: [],
}

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  ORDER_STATUS_TRANSITIONS[from].includes(to)

/** La tienda solo puede editar o cancelar un pedido mientras el obrador no lo ha tramitado. */
export const isEditableByStore = (status: OrderStatus): boolean => status === 'pending'
