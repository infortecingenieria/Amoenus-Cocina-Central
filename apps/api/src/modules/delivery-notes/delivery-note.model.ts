import { PACKAGE_FORMATS, type PackageFormat } from '@cocina-central/shared'
import { Schema, model, type Types } from 'mongoose'

export interface DeliveryNoteLineRecord {
  saleArticleId: Types.ObjectId
  code: string
  name: string
  format: PackageFormat
  unitsPerFormat: number
  unitPrice: number
  requestedQty: number
  deliveredQty: number
  /** Ausentes en los albaranes anteriores a la trazabilidad. */
  lotNumber?: string | null
  /** «2026-11-03» */
  expiryDate?: string | null
}

export interface DeliveryNoteRecord {
  _id: Types.ObjectId
  number: string
  orderId: Types.ObjectId
  orderNumber: string
  storeName: string
  issuedAt: Date
  lines: DeliveryNoteLineRecord[]
  createdAt: Date
  updatedAt: Date
}

const deliveryNoteLineSchema = new Schema<DeliveryNoteLineRecord>(
  {
    saleArticleId: { type: Schema.Types.ObjectId, ref: 'SaleArticle', required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    format: { type: String, enum: PACKAGE_FORMATS, required: true },
    unitsPerFormat: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    requestedQty: { type: Number, required: true, min: 1 },
    deliveredQty: { type: Number, required: true, min: 0 },
    lotNumber: { type: String, default: null },
    expiryDate: { type: String, default: null },
  },
  { _id: false },
)

const deliveryNoteSchema = new Schema<DeliveryNoteRecord>(
  {
    number: { type: String, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    orderNumber: { type: String, required: true },
    storeName: { type: String, required: true },
    issuedAt: { type: Date, required: true },
    lines: { type: [deliveryNoteLineSchema], required: true },
  },
  { collection: 'delivery_notes', timestamps: true },
)

deliveryNoteSchema.index({ number: 1 }, { unique: true })
// Un albarán por pedido, aunque se apruebe dos veces a la vez.
deliveryNoteSchema.index({ orderId: 1 }, { unique: true })

export const DeliveryNoteModel = model<DeliveryNoteRecord>('DeliveryNote', deliveryNoteSchema)
