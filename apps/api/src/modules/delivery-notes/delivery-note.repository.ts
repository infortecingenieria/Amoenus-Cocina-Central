import type { DeliveryNote, DeliveryNoteLine } from '@cocina-central/shared'
import { isValidObjectId, Types } from 'mongoose'

import { roundCurrency } from '../../shared/http'
import {
  DeliveryNoteModel,
  type DeliveryNoteLineRecord,
  type DeliveryNoteRecord,
} from './delivery-note.model'

export interface NewDeliveryNoteData {
  number: string
  orderId: string
  orderNumber: string
  storeName: string
  lines: DeliveryNoteLine[]
}

const toLine = (line: DeliveryNoteLineRecord): DeliveryNoteLine => ({
  saleArticleId: line.saleArticleId.toString(),
  code: line.code,
  name: line.name,
  format: line.format,
  unitsPerFormat: line.unitsPerFormat,
  unitPrice: line.unitPrice,
  requestedQty: line.requestedQty,
  deliveredQty: line.deliveredQty,
})

const toDeliveryNote = (record: DeliveryNoteRecord): DeliveryNote => ({
  id: record._id.toString(),
  number: record.number,
  orderId: record.orderId.toString(),
  orderNumber: record.orderNumber,
  storeName: record.storeName,
  issuedAt: record.issuedAt.toISOString(),
  lines: record.lines.map(toLine),
  total: roundCurrency(
    record.lines.reduce((sum, line) => sum + line.unitPrice * line.deliveredQty, 0),
  ),
})

/** Acceso a datos de albaranes. Devuelve siempre DTOs planos, nunca documentos Mongoose. */
export class DeliveryNoteRepository {
  async findByOrderId(orderId: string): Promise<DeliveryNote | null> {
    if (!isValidObjectId(orderId)) return null
    const record = await DeliveryNoteModel.findOne({ orderId }).lean<DeliveryNoteRecord>()
    return record ? toDeliveryNote(record) : null
  }

  async create(data: NewDeliveryNoteData): Promise<DeliveryNote> {
    const document = await DeliveryNoteModel.create({
      ...data,
      orderId: new Types.ObjectId(data.orderId),
      issuedAt: new Date(),
      lines: data.lines.map((line) => ({
        ...line,
        saleArticleId: new Types.ObjectId(line.saleArticleId),
      })),
    })
    return toDeliveryNote(document.toObject<DeliveryNoteRecord>())
  }
}
