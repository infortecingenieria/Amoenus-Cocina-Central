import type { DeliveryNote, DeliveryNoteLine } from '@cocina-central/shared'
import { isValidObjectId, Types } from 'mongoose'

import { roundCurrency } from '../../shared/http'
import {
  DeliveryNoteModel,
  type DeliveryNoteLineRecord,
  type DeliveryNoteRecord,
} from './delivery-note.model'

export interface NewDeliveryNoteData {
  /** El id ya reservado (`newId`), que el pedido guarda al aprobarse. */
  id: string
  number: string
  issuedAt: string
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
  lotNumber: line.lotNumber ?? null,
  expiryDate: line.expiryDate ?? null,
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
  newId(): string {
    return new Types.ObjectId().toString()
  }

  async findByOrderId(orderId: string): Promise<DeliveryNote | null> {
    if (!isValidObjectId(orderId)) return null
    const record = await DeliveryNoteModel.findOne({ orderId }).lean<DeliveryNoteRecord>()
    return record ? toDeliveryNote(record) : null
  }

  async create({ id, ...data }: NewDeliveryNoteData): Promise<DeliveryNote> {
    const document = await DeliveryNoteModel.create({
      ...data,
      _id: new Types.ObjectId(id),
      orderId: new Types.ObjectId(data.orderId),
      issuedAt: new Date(data.issuedAt),
      lines: data.lines.map((line) => ({
        ...line,
        saleArticleId: new Types.ObjectId(line.saleArticleId),
      })),
    })
    return toDeliveryNote(document.toObject<DeliveryNoteRecord>())
  }
}
