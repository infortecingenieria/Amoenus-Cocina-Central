import {
  calculateOrderTotal,
  calculateTotalQuantity,
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
  lines: OrderLine[]
  createdBy: { id: string; displayName: string }
  firstEntry: OrderStatusEntry
}

/** Cambio de estado: nuevo estado, entrada del historial y, al aprobar, las líneas confirmadas. */
export interface OrderTransition {
  status: OrderStatus
  entry: OrderStatusEntry
  lines?: OrderLine[]
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

const toSummaryBase = (record: OrderSummaryRecord) => ({
  id: record._id.toString(),
  number: record.number,
  storeName: record.storeName,
  status: record.status,
  notes: record.notes,
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
    if (filter.storeName) query.storeName = filter.storeName
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
        },
        $push: { statusHistory: toEntryRecord(change.entry) },
      },
      { returnDocument: 'after', runValidators: true },
    ).lean<OrderRecord>()
    return record ? toOrder(record) : null
  }
}
