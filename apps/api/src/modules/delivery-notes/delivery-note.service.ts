import {
  effectiveQuantity,
  type DeliveryNote,
  type DeliveryNoteRef,
  type Order,
} from '@cocina-central/shared'

import { nextSequence } from '../../database/counter'
import { currentYear } from '../../shared/business-time'
import type { DeliveryNoteRepository } from './delivery-note.repository'

/** «ALB-2026-0001» */
const formatDeliveryNoteNumber = (year: string, sequence: number): string =>
  `ALB-${year}-${String(sequence).padStart(4, '0')}`

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 11000

/**
 * Albaranes de entrega: uno por pedido, con lo que sirve el obrador. El albarán queda emitido con
 * la aprobación (el pedido guarda su id y número en la misma escritura) y el documento se genera a
 * partir del pedido, así que se puede volver a crear si aquello se interrumpió.
 */
export class DeliveryNoteService {
  private readonly repository: DeliveryNoteRepository

  constructor(repository: DeliveryNoteRepository) {
    this.repository = repository
  }

  /**
   * Id y número para el albarán de un pedido que se va a aprobar. Si al final no se aprueba (otro
   * usuario lo ha tramitado antes), el número queda sin usar.
   */
  async reserve(): Promise<DeliveryNoteRef> {
    const year = currentYear()
    return {
      id: this.repository.newId(),
      number: formatDeliveryNoteNumber(year, await nextSequence(`delivery-note-${year}`)),
    }
  }

  /** El albarán de un pedido aprobado; lo crea con las cantidades confirmadas si aún no existe. */
  async ensureForOrder(order: Order): Promise<DeliveryNote> {
    if (!order.deliveryNote) throw new Error(`El pedido ${order.number} no tiene albarán`)
    const existing = await this.repository.findByOrderId(order.id)
    if (existing) return existing

    const approval = order.statusHistory.findLast(
      (entry) => entry.status === 'approved' || entry.status === 'modified',
    )
    try {
      return await this.repository.create({
        id: order.deliveryNote.id,
        number: order.deliveryNote.number,
        issuedAt: approval?.at ?? new Date().toISOString(),
        orderId: order.id,
        orderNumber: order.number,
        storeName: order.storeName,
        lines: order.lines.map((line) => ({
          saleArticleId: line.saleArticleId,
          code: line.code,
          name: line.name,
          format: line.format,
          unitsPerFormat: line.unitsPerFormat,
          unitPrice: line.unitPrice,
          requestedQty: line.requestedQty,
          deliveredQty: effectiveQuantity(line),
        })),
      })
    } catch (error) {
      // Dos a la vez (la aprobación y un envío a Amoenus que lo regenera): vale el primero.
      if (!isDuplicateKeyError(error)) throw error
      const created = await this.repository.findByOrderId(order.id)
      if (!created) throw error
      return created
    }
  }
}
