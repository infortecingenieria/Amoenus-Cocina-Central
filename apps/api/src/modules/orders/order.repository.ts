import {
  AMOENUS_ORDER_ORIGINS,
  AMOENUS_SYNCED_STATUSES,
  calculateOrderTotal,
  calculateTotalQuantity,
  type AmoenusOrderLink,
  type AmoenusSync,
  type DeliveryNoteRef,
  type Order,
  type OrderLine,
  type OrderSort,
  type OrderStatus,
  type OrderStatusEntry,
  type OrderSummary,
  type PaginationQuery,
} from '@cocina-central/shared'
import { isValidObjectId, Types, type QueryFilter } from 'mongoose'

import { escapeRegExp } from '../../shared/http'
import {
  OrderModel,
  type AmoenusLinkRecord,
  type AmoenusSyncRecord,
  type OrderLineRecord,
  type OrderRecord,
  type OrderStatusEntryRecord,
} from './order.model'

export interface OrderFilter {
  /** Cualquiera de estos estados. */
  status?: OrderStatus[]
  /** Solo los pedidos de esta tienda (usuarios `store`). */
  storeName?: string
  search?: string
}

export interface NewOrderData {
  number: string
  storeName: string
  notes: string | null
  amoenus: AmoenusOrderLink | null
  lines: OrderLine[]
  createdBy: { id: string; displayName: string }
  firstEntry: OrderStatusEntry
}

/**
 * Cambio de estado: nuevo estado, entrada del historial y, al aprobar, las líneas confirmadas y el
 * albarán. Todo se guarda en una sola escritura.
 */
export interface OrderTransition {
  status: OrderStatus
  entry: OrderStatusEntry
  lines?: OrderLine[]
  deliveryNote?: DeliveryNoteRef
}

type OrderSummaryRecord = Omit<OrderRecord, 'statusHistory'>

const toLine = (line: OrderLineRecord): OrderLine => ({
  saleArticleId: line.saleArticleId.toString(),
  code: line.code,
  name: line.name,
  format: line.format,
  unitsPerFormat: line.unitsPerFormat,
  unitPrice: line.unitPrice,
  requestedQty: line.requestedQty,
  confirmedQty: line.confirmedQty,
})

const toLineRecord = (line: OrderLine): OrderLineRecord => ({
  ...line,
  saleArticleId: new Types.ObjectId(line.saleArticleId),
})

const toEntry = (entry: OrderStatusEntryRecord): OrderStatusEntry => ({
  status: entry.status,
  at: entry.at.toISOString(),
  userId: entry.userId.toString(),
  userName: entry.userName,
  reason: entry.reason,
})

const toEntryRecord = (entry: OrderStatusEntry): OrderStatusEntryRecord => ({
  ...entry,
  at: new Date(entry.at),
  userId: new Types.ObjectId(entry.userId),
})

const toAmoenusSync = (sync: AmoenusSyncRecord): AmoenusSync => ({
  status: sync.status,
  attempts: sync.attempts,
  lastError: sync.lastError,
  lastAttemptAt: sync.lastAttemptAt.toISOString(),
  sentAt: sync.sentAt?.toISOString() ?? null,
})

const toAmoenusSyncRecord = (sync: AmoenusSync): AmoenusSyncRecord => ({
  ...sync,
  lastAttemptAt: new Date(sync.lastAttemptAt),
  sentAt: sync.sentAt ? new Date(sync.sentAt) : null,
})

const toAmoenusLink = (record: AmoenusLinkRecord): AmoenusOrderLink => {
  const sync = record.sync ? toAmoenusSync(record.sync) : null
  if (record.origin === 'linked_store') {
    return { origin: record.origin, localId: record.localId, sync }
  }
  return {
    origin: record.origin,
    externalOrderId: record.externalOrderId,
    clientId: record.clientId,
    localId: record.localId,
    sync,
  }
}

const toAmoenusLinkRecord = (link: AmoenusOrderLink): AmoenusLinkRecord => ({
  ...link,
  sync: link.sync ? toAmoenusSyncRecord(link.sync) : null,
  sendingUntil: null,
})

const toSummaryBase = (record: OrderSummaryRecord) => ({
  id: record._id.toString(),
  number: record.number,
  storeName: record.storeName,
  status: record.status,
  notes: record.notes,
  amoenus: record.amoenus ? toAmoenusLink(record.amoenus) : null,
  deliveryNote: record.deliveryNote
    ? { id: record.deliveryNote.id.toString(), number: record.deliveryNote.number }
    : null,
  total: calculateOrderTotal(record.lines),
  createdBy: { id: record.createdBy.id.toString(), displayName: record.createdBy.displayName },
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
})

const toOrderSummary = (record: OrderSummaryRecord): OrderSummary => ({
  ...toSummaryBase(record),
  lineCount: record.lines.length,
  totalQuantity: calculateTotalQuantity(record.lines),
})

const toOrder = (record: OrderRecord): Order => ({
  ...toSummaryBase(record),
  lines: record.lines.map(toLine),
  statusHistory: record.statusHistory.map(toEntry),
})

/** Acceso a datos de pedidos. Devuelve siempre DTOs planos, nunca documentos Mongoose. */
export class OrderRepository {
  async findMany(
    filter: OrderFilter,
    { page, pageSize }: PaginationQuery,
    sort: OrderSort = '-createdAt',
  ): Promise<{ items: OrderSummary[]; total: number }> {
    const query: QueryFilter<OrderRecord> = {}
    if (filter.status?.length) query.status = { $in: filter.status }
    // `''` también filtra: es el ámbito de una tienda sin tienda asignada, que no ve nada.
    if (filter.storeName !== undefined) query.storeName = filter.storeName
    if (filter.search) {
      const pattern = new RegExp(escapeRegExp(filter.search), 'i')
      query.$or = [{ number: pattern }, { storeName: pattern }]
    }

    const [records, total] = await Promise.all([
      OrderModel.find(query)
        .select('-statusHistory')
        // `_id` desempata pedidos creados en el mismo milisegundo.
        .sort(sort === 'createdAt' ? { createdAt: 1, _id: 1 } : { createdAt: -1, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean<OrderSummaryRecord[]>(),
      OrderModel.countDocuments(query),
    ])

    return { items: records.map(toOrderSummary), total }
  }

  async findById(id: string): Promise<Order | null> {
    if (!isValidObjectId(id)) return null
    const record = await OrderModel.findById(id).lean<OrderRecord>()
    return record ? toOrder(record) : null
  }

  async findByAmoenusOrderId(externalOrderId: string): Promise<Order | null> {
    const record = await OrderModel.findOne({
      'amoenus.externalOrderId': externalOrderId,
    }).lean<OrderRecord>()
    return record ? toOrder(record) : null
  }

  /**
   * Ids de los pedidos con algo que comunicar a Amoenus (`AMOENUS_SYNCED_STATUSES`) que aún no se
   * ha enviado: nunca intentado o fallido.
   */
  async findIdsPendingAmoenusSync(): Promise<string[]> {
    const records = await OrderModel.find(
      {
        'amoenus.sync.status': { $ne: 'sent' },
        $or: AMOENUS_ORDER_ORIGINS.map((origin) => ({
          'amoenus.origin': origin,
          status: { $in: [...AMOENUS_SYNCED_STATUSES[origin]] },
        })),
      },
      { _id: 1 },
    )
      .sort({ updatedAt: 1 })
      .lean<{ _id: Types.ObjectId }[]>()
    return records.map((record) => record._id.toString())
  }

  /**
   * Reserva hasta `until` el envío a Amoenus del pedido, si no está ya enviado ni reservado por
   * otro. Devuelve el pedido reservado o null.
   */
  async claimAmoenusSync(id: string, until: Date): Promise<Order | null> {
    if (!isValidObjectId(id)) return null
    const record = await OrderModel.findOneAndUpdate(
      {
        _id: id,
        'amoenus.origin': { $exists: true },
        'amoenus.sync.status': { $ne: 'sent' },
        // Libre: null, o una reserva caducada de un envío que no terminó.
        'amoenus.sendingUntil': { $not: { $gt: new Date() } },
      },
      { $set: { 'amoenus.sendingUntil': until } },
      { returnDocument: 'after' },
    ).lean<OrderRecord>()
    return record ? toOrder(record) : null
  }

  /** Guarda el resultado del envío y libera la reserva, si sigue siendo la de quien lo envió. */
  async saveAmoenusSync(id: string, sync: AmoenusSync, claimedUntil: Date): Promise<void> {
    await OrderModel.updateOne(
      { _id: id, 'amoenus.sendingUntil': claimedUntil },
      { $set: { 'amoenus.sync': toAmoenusSyncRecord(sync), 'amoenus.sendingUntil': null } },
      { runValidators: true },
    )
  }

  async existsWithArticle(saleArticleId: string): Promise<boolean> {
    if (!isValidObjectId(saleArticleId)) return false
    return (await OrderModel.exists({ 'lines.saleArticleId': saleArticleId })) !== null
  }

  async create(data: NewOrderData): Promise<Order> {
    const document = await OrderModel.create({
      number: data.number,
      storeName: data.storeName,
      status: data.firstEntry.status,
      notes: data.notes,
      amoenus: data.amoenus ? toAmoenusLinkRecord(data.amoenus) : null,
      lines: data.lines.map(toLineRecord),
      statusHistory: [toEntryRecord(data.firstEntry)],
      createdBy: {
        id: new Types.ObjectId(data.createdBy.id),
        displayName: data.createdBy.displayName,
      },
    })
    return toOrder(document.toObject<OrderRecord>())
  }

  /**
   * Cambia el estado solo si el pedido sigue en `from`. Si otro usuario lo ha tramitado antes
   * (dos validaciones a la vez), devuelve null en lugar de pisar su cambio.
   */
  async transition(id: string, from: OrderStatus, change: OrderTransition): Promise<Order | null> {
    if (!isValidObjectId(id)) return null
    const record = await OrderModel.findOneAndUpdate(
      { _id: id, status: from },
      {
        $set: {
          status: change.status,
          ...(change.lines ? { lines: change.lines.map(toLineRecord) } : {}),
          ...(change.deliveryNote
            ? {
                deliveryNote: {
                  id: new Types.ObjectId(change.deliveryNote.id),
                  number: change.deliveryNote.number,
                },
              }
            : {}),
        },
        $push: { statusHistory: toEntryRecord(change.entry) },
      },
      { returnDocument: 'after', runValidators: true },
    ).lean<OrderRecord>()
    return record ? toOrder(record) : null
  }
}
