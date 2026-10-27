import {
  AMOENUS_SYNC_EVENTS,
  AMOENUS_SYNC_STATUSES,
  ORDER_SOURCE_SYSTEMS,
  ORDER_STATUSES,
  PACKAGE_FORMATS,
  type AmoenusSync,
  type OrderSource,
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

export type AmoenusSyncRecord = Omit<AmoenusSync, 'lastAttemptAt' | 'sentAt'> & {
  lastAttemptAt: Date | null
  sentAt: Date | null
}

export interface OrderRecord {
  _id: Types.ObjectId
  number: string
  storeName: string
  status: OrderStatus
  notes: string | null
  /** Ausente o null en los pedidos hechos desde esta aplicación. */
  source?: OrderSource | null
  /** Local de Amoenus de la tienda, si está vinculada (copia del usuario al crear el pedido). */
  amoenusLocalId?: string | null
  /** Albarán generado al aprobar. */
  deliveryNote?: { id: Types.ObjectId; number: string } | null
  /** Envío a Amoenus (pedidos que vienen de allí o de una tienda vinculada). */
  amoenusSync?: AmoenusSyncRecord | null
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

const orderSourceSchema = new Schema<OrderSource>(
  {
    system: { type: String, enum: ORDER_SOURCE_SYSTEMS, required: true },
    externalOrderId: { type: String, required: true },
    clientId: { type: String, required: true },
    localId: { type: String, required: true },
  },
  { _id: false },
)

const deliveryNoteRefSchema = new Schema<NonNullable<OrderRecord['deliveryNote']>>(
  {
    id: { type: Schema.Types.ObjectId, ref: 'DeliveryNote', required: true },
    number: { type: String, required: true },
  },
  { _id: false },
)

const amoenusSyncSchema = new Schema<AmoenusSyncRecord>(
  {
    event: { type: String, enum: AMOENUS_SYNC_EVENTS, required: true },
    status: { type: String, enum: AMOENUS_SYNC_STATUSES, required: true },
    attempts: { type: Number, required: true, default: 0 },
    lastError: { type: String, default: null },
    lastAttemptAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
  },
  { _id: false },
)

const orderSchema = new Schema<OrderRecord>(
  {
    number: { type: String, required: true },
    storeName: { type: String, required: true },
    status: { type: String, enum: ORDER_STATUSES, required: true, default: 'pending' },
    notes: { type: String, default: null },
    source: { type: orderSourceSchema, default: null },
    amoenusLocalId: { type: String, default: null },
    deliveryNote: { type: deliveryNoteRefSchema, default: null },
    amoenusSync: { type: amoenusSyncSchema, default: null },
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
// Un pedido de otro sistema entra una sola vez aunque se reenvíe.
orderSchema.index(
  { 'source.system': 1, 'source.externalOrderId': 1 },
  { unique: true, partialFilterExpression: { 'source.externalOrderId': { $exists: true } } },
)
// Envíos a Amoenus pendientes de reintentar.
orderSchema.index({ 'amoenusSync.status': 1 })
// Para saber si un artículo ya se ha pedido (no se puede borrar).
orderSchema.index({ 'lines.saleArticleId': 1 })

export const OrderModel = model<OrderRecord>('Order', orderSchema)
