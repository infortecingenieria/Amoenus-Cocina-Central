import {
  AMOENUS_ORDER_ORIGINS,
  AMOENUS_SYNC_STATUSES,
  ORDER_STATUSES,
  PACKAGE_FORMATS,
  type AmoenusSync,
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
  /** Ausentes en los pedidos anteriores a la trazabilidad. */
  lotNumber?: string | null
  /** «2026-11-03» */
  expiryDate?: string | null
}

export interface OrderStatusEntryRecord {
  status: OrderStatus
  at: Date
  userId: Types.ObjectId
  userName: string
  reason: string | null
}

export type AmoenusSyncRecord = Omit<AmoenusSync, 'lastAttemptAt' | 'sentAt'> & {
  lastAttemptAt: Date
  sentAt: Date | null
}

export type AmoenusLinkRecord = (
  | { origin: 'amoenus_order'; externalOrderId: string; clientId: string }
  | { origin: 'linked_store' }
) & {
  localId: string
  sync: AmoenusSyncRecord | null
  /** Hasta cuándo está reservado el envío a Amoenus por quien lo está haciendo; null = libre. */
  sendingUntil: Date | null
}

export interface OrderRecord {
  _id: Types.ObjectId
  number: string
  storeName: string
  status: OrderStatus
  notes: string | null
  /** Vínculo con Amoenus; null en los pedidos de tiendas sin vincular. */
  amoenus?: AmoenusLinkRecord | null
  /** Albarán generado al aprobar. */
  deliveryNote?: { id: Types.ObjectId; number: string } | null
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
    lotNumber: { type: String, default: null },
    expiryDate: { type: String, default: null },
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

const deliveryNoteRefSchema = new Schema<NonNullable<OrderRecord['deliveryNote']>>(
  {
    id: { type: Schema.Types.ObjectId, ref: 'DeliveryNote', required: true },
    number: { type: String, required: true },
  },
  { _id: false },
)

const amoenusSyncSchema = new Schema<AmoenusSyncRecord>(
  {
    status: { type: String, enum: AMOENUS_SYNC_STATUSES, required: true },
    attempts: { type: Number, required: true },
    lastError: { type: String, default: null },
    lastAttemptAt: { type: Date, required: true },
    sentAt: { type: Date, default: null },
  },
  { _id: false },
)

const amoenusLinkSchema = new Schema<AmoenusLinkRecord>(
  {
    origin: { type: String, enum: AMOENUS_ORDER_ORIGINS, required: true },
    localId: { type: String, required: true },
    // Solo en los que vienen de Amoenus (`amoenus_order`); sin default para no indexar nulls.
    externalOrderId: { type: String },
    clientId: { type: String },
    sync: { type: amoenusSyncSchema, default: null },
    sendingUntil: { type: Date, default: null },
  },
  { _id: false },
)

const orderSchema = new Schema<OrderRecord>(
  {
    number: { type: String, required: true },
    storeName: { type: String, required: true },
    status: { type: String, enum: ORDER_STATUSES, required: true, default: 'pending' },
    notes: { type: String, default: null },
    amoenus: { type: amoenusLinkSchema, default: null },
    deliveryNote: { type: deliveryNoteRefSchema, default: null },
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
// Un pedido de Amoenus entra una sola vez aunque se reenvíe.
orderSchema.index(
  { 'amoenus.externalOrderId': 1 },
  { unique: true, partialFilterExpression: { 'amoenus.externalOrderId': { $type: 'string' } } },
)
// Envíos a Amoenus pendientes (ver `findIdsPendingAmoenusSync`).
orderSchema.index({ 'amoenus.origin': 1, status: 1 })
// Para saber si un artículo ya se ha pedido (no se puede borrar).
orderSchema.index({ 'lines.saleArticleId': 1 })

export const OrderModel = model<OrderRecord>('Order', orderSchema)
