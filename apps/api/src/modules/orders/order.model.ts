import {
  ORDER_STATUSES,
  PACKAGE_FORMATS,
  type OrderStatus,
  type PackageFormat,
} from '@cocina-central/shared'
import { Schema, model, type Types } from 'mongoose'

export interface OrderLineRecord {
  saleArticleId: Types.ObjectId
  code: string
  name: string
  format: PackageFormat
  unitsPerFormat: number
  unitPrice: number
  requestedQty: number
  confirmedQty: number | null
}

export interface OrderStatusEntryRecord {
  status: OrderStatus
  at: Date
  userId: Types.ObjectId
  userName: string
  reason: string | null
}

export interface OrderRecord {
  _id: Types.ObjectId
  number: string
  storeName: string
  status: OrderStatus
  notes: string | null
  lines: OrderLineRecord[]
  statusHistory: OrderStatusEntryRecord[]
  createdBy: { id: Types.ObjectId; displayName: string }
  createdAt: Date
  updatedAt: Date
}

const orderLineSchema = new Schema<OrderLineRecord>(
  {
    saleArticleId: { type: Schema.Types.ObjectId, ref: 'SaleArticle', required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    format: { type: String, enum: PACKAGE_FORMATS, required: true },
    unitsPerFormat: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    requestedQty: { type: Number, required: true, min: 1 },
    confirmedQty: { type: Number, default: null, min: 0 },
  },
  { _id: false },
)

const orderStatusEntrySchema = new Schema<OrderStatusEntryRecord>(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    reason: { type: String, default: null },
  },
  { _id: false },
)

const orderSchema = new Schema<OrderRecord>(
  {
    number: { type: String, required: true },
    storeName: { type: String, required: true },
    status: { type: String, enum: ORDER_STATUSES, required: true, default: 'pending' },
    notes: { type: String, default: null },
    lines: { type: [orderLineSchema], required: true },
    statusHistory: { type: [orderStatusEntrySchema], default: [] },
    createdBy: {
      id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      displayName: { type: String, required: true },
    },
  },
  { collection: 'orders', timestamps: true },
)

orderSchema.index({ number: 1 }, { unique: true })
orderSchema.index({ storeName: 1, createdAt: -1 })
orderSchema.index({ status: 1, createdAt: -1 })
// Para saber si un artículo ya se ha pedido (no se puede borrar).
orderSchema.index({ 'lines.saleArticleId': 1 })

export const OrderModel = model<OrderRecord>('Order', orderSchema)
