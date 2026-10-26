import { effectiveQuantity, type DeliveryNote, type Order } from '@cocina-central/shared'

import { nextSequence } from '../../database/counter'
import { currentYear } from '../../shared/business-time'
import type { DeliveryNoteRepository } from './delivery-note.repository'

/** «ALB-2026-0001» */
const formatDeliveryNoteNumber = (year: string, sequence: number): string =>
  `ALB-${year}-${String(sequence).padStart(4, '0')}`

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 11000

/** Albaranes de entrega: uno por pedido, con lo que sirve el obrador. */
export class DeliveryNoteService {
  private readonly repository: DeliveryNoteRepository

  constructor(repository: DeliveryNoteRepository) {
    this.repository = repository
  }

  /**
   * Genera el albarán de un pedido aprobado con las cantidades confirmadas. Si ya existe (p. ej.
   * dos aprobaciones a la vez), devuelve el existente en lugar de crear otro.
   */
  async createForOrder(order: Order): Promise<DeliveryNote> {
    const existing = await this.repository.findByOrderId(order.id)
    if (existing) return existing

    const year = currentYear()
    try {
      return await this.repository.create({
        number: formatDeliveryNoteNumber(year, await nextSequence(`delivery-note-${year}`)),
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
      if (!isDuplicateKeyError(error)) throw error
      const created = await this.repository.findByOrderId(order.id)
      if (!created) throw error
      return created
    }
  }

  findByOrderId(orderId: string): Promise<DeliveryNote | null> {
    return this.repository.findByOrderId(orderId)
  }
}
