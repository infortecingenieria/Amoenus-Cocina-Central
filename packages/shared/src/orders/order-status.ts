import { z } from 'zod'

/**
 * Ciclo de vida de un pedido de tienda al obrador.
 *
 *   pending ──► approved ──► in_preparation ──► delivered
 *      │    └─► modified ──┘
 *      ├─► rejected
 *      └─► cancelled
 *
 * `modified` = aprobado por el obrador con cantidades distintas a las solicitadas.
 */
export const ORDER_STATUSES = [
  'pending',
  'approved',
  'modified',
  'in_preparation',
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
  delivered: 'Entregado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
}

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['approved', 'modified', 'rejected', 'cancelled'],
  approved: ['in_preparation'],
  modified: ['in_preparation'],
  in_preparation: ['delivered'],
  delivered: [],
  rejected: [],
  cancelled: [],
}

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  ORDER_STATUS_TRANSITIONS[from].includes(to)

/** La tienda solo puede editar o cancelar un pedido mientras el obrador no lo ha tramitado. */
export const isEditableByStore = (status: OrderStatus): boolean => status === 'pending'
