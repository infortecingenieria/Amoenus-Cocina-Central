import {
  canTransition,
  ORDER_STATUS_LABELS,
  type ApproveOrderInput,
  type AuthUser,
  type CreateOrderData,
  type ListOrdersQuery,
  type Order,
  type OrderLine,
  type OrderSource,
  type OrderStatus,
  type OrderSummary,
  type Paginated,
  type RejectOrderInput,
} from '@cocina-central/shared'

import { nextSequence } from '../../database/counter'
import { currentYear } from '../../shared/business-time'
import {
  ForbiddenError,
  InvalidStateError,
  NotFoundError,
  ValidationError,
  type ValidationIssue,
} from '../../shared/errors'
import type { DeliveryNoteService } from '../delivery-notes/delivery-note.service'
import type { AmoenusSyncService } from '../integrations/amoenus/amoenus-sync.service'
import type { SaleArticleRepository } from '../sale-articles/sale-article.repository'
import type { OrderRepository } from './order.repository'

/** «PED-2026-0001» */
const formatOrderNumber = (year: string, sequence: number): string =>
  `PED-${year}-${String(sequence).padStart(4, '0')}`

/** Quién hace el pedido: el usuario de la tienda o, en las integraciones, un usuario técnico. */
export type OrderAuthor = Pick<AuthUser, 'id' | 'displayName'>

export interface NewOrderRequest {
  storeName: string
  notes: string | null
  lines: CreateOrderData['lines']
  author: OrderAuthor
  source: OrderSource | null
}

/** Verbo de cada acción para los mensajes de error. */
const ACTION_VERBS: Partial<Record<OrderStatus, string>> = {
  approved: 'aprobar',
  modified: 'aprobar',
  rejected: 'rechazar',
  cancelled: 'cancelar',
}

/** Reglas de negocio de los pedidos de tienda al obrador. */
export class OrderService {
  private readonly repository: OrderRepository
  private readonly saleArticles: SaleArticleRepository
  private readonly deliveryNotes: DeliveryNoteService
  private readonly amoenusSync: AmoenusSyncService

  constructor(
    repository: OrderRepository,
    saleArticles: SaleArticleRepository,
    deliveryNotes: DeliveryNoteService,
    amoenusSync: AmoenusSyncService,
  ) {
    this.repository = repository
    this.saleArticles = saleArticles
    this.deliveryNotes = deliveryNotes
    this.amoenusSync = amoenusSync
  }

  /** La tienda solo ve sus pedidos; el obrador, todos. */
  async list(
    { page, pageSize, status, search, sort }: ListOrdersQuery,
    user: AuthUser,
  ): Promise<Paginated<OrderSummary>> {
    const { items, total } = await this.repository.findMany(
      { status, search, storeName: this.storeScope(user) },
      { page, pageSize },
      sort,
    )
    return { items, total, page, pageSize }
  }

  /** Un pedido de otra tienda responde igual que uno inexistente. */
  async getById(id: string, user: AuthUser): Promise<Order> {
    const order = await this.repository.findById(id)
    const storeName = this.storeScope(user)
    if (!order || (storeName !== undefined && order.storeName !== storeName)) {
      throw new NotFoundError('Pedido no encontrado')
    }
    return order
  }

  async create(data: CreateOrderData, user: AuthUser): Promise<Order> {
    if (!user.storeName) throw new ForbiddenError('Tu usuario no tiene ninguna tienda asignada')
    return this.createFor({ ...data, storeName: user.storeName, author: user, source: null })
  }

  /**
   * Alta de un pedido pendiente para una tienda. La usan la propia tienda y las integraciones
   * (Amoenus), para que todos los pedidos compartan validación de artículos y numeración.
   */
  async createFor({ storeName, notes, lines, author, source }: NewOrderRequest): Promise<Order> {
    const orderLines = await this.buildLines(lines)
    const year = currentYear()
    const number = formatOrderNumber(year, await nextSequence(`order-${year}`))

    return this.repository.create({
      number,
      storeName,
      notes: notes || null,
      source,
      lines: orderLines,
      createdBy: { id: author.id, displayName: author.displayName },
      firstEntry: this.historyEntry('pending', author),
    })
  }

  /**
   * Aprueba el pedido con las cantidades confirmadas. Las líneas que no se indican se sirven
   * tal cual se pidieron; si alguna cambia, el pedido queda «modificado por obrador» y hay que
   * indicar el motivo (la tienda lo ve, como el de un rechazo).
   */
  async approve(id: string, data: ApproveOrderInput, user: AuthUser): Promise<Order> {
    const order = await this.getById(id, user)
    this.ensureCanTransition(order, 'approved')

    const confirmed = new Map(
      (data.lines ?? []).map((line) => [line.saleArticleId, line.confirmedQty]),
    )
    const issues: ValidationIssue[] = []
    data.lines?.forEach((line, index) => {
      if (!order.lines.some((orderLine) => orderLine.saleArticleId === line.saleArticleId)) {
        issues.push({
          path: `/lines/${index}/saleArticleId`,
          message: 'El artículo no está en el pedido',
        })
      }
    })
    if (issues.length > 0) throw new ValidationError('Hay líneas que no son del pedido', issues)

    const lines: OrderLine[] = order.lines.map((line) => ({
      ...line,
      confirmedQty: confirmed.get(line.saleArticleId) ?? line.requestedQty,
    }))
    if (lines.every((line) => line.confirmedQty === 0)) {
      throw new ValidationError('Para no servir ningún artículo, rechaza el pedido')
    }

    const modified = lines.some((line) => line.confirmedQty !== line.requestedQty)
    if (modified && !data.reason) {
      const message = 'Indica el motivo de los cambios'
      throw new ValidationError(message, [{ path: '/reason', message }])
    }
    const approved = modified
      ? await this.applyTransition(order, 'modified', user, { lines, reason: data.reason })
      : await this.applyTransition(order, 'approved', user, { lines })

    // Al aprobar se emite el albarán con lo que se sirve y, si el pedido es de Amoenus, se le envía.
    const deliveryNote = await this.deliveryNotes.createForOrder(approved)
    await this.repository.setDeliveryNote(approved.id, {
      id: deliveryNote.id,
      number: deliveryNote.number,
    })
    await this.amoenusSync.queue(approved, 'delivery_note')
    return this.reload(approved.id)
  }

  async reject(id: string, { reason }: RejectOrderInput, user: AuthUser): Promise<Order> {
    const order = await this.getById(id, user)
    const rejected = await this.applyTransition(order, 'rejected', user, { reason })
    await this.amoenusSync.queue(rejected, 'rejection')
    return this.reload(rejected.id)
  }

  /** Reenvía a Amoenus el albarán o el rechazo de un pedido suyo (p. ej. si Amoenus no respondía). */
  async resendToAmoenus(id: string, user: AuthUser): Promise<Order> {
    const order = await this.getById(id, user)
    if (!order.amoenusSync) {
      throw new InvalidStateError(`El pedido ${order.number} no tiene nada que enviar a Amoenus`)
    }
    await this.amoenusSync.send(order.id)
    return this.reload(order.id)
  }

  /** Solo la tienda que lo hizo y solo mientras el obrador no lo ha tramitado. */
  async cancel(id: string, user: AuthUser): Promise<Order> {
    const order = await this.getById(id, user)
    return this.applyTransition(order, 'cancelled', user)
  }

  /** El pedido tal y como ha quedado tras guardar el albarán o el envío a Amoenus. */
  private async reload(id: string): Promise<Order> {
    const order = await this.repository.findById(id)
    if (!order) throw new NotFoundError('Pedido no encontrado')
    return order
  }

  /** `undefined` = sin restricción (obrador). */
  private storeScope(user: AuthUser): string | undefined {
    // Un usuario de tienda sin tienda asignada no ve nada (cadena que no coincide con ninguna).
    return user.role === 'store' ? (user.storeName ?? '') : undefined
  }

  /** Comprueba que todos los artículos existen y están activos, y copia sus datos en la línea. */
  private async buildLines(requested: CreateOrderData['lines']): Promise<OrderLine[]> {
    const articles = await this.saleArticles.findByIds(requested.map((line) => line.saleArticleId))
    const byId = new Map(articles.map((article) => [article.id, article]))

    const issues: ValidationIssue[] = []
    const lines: OrderLine[] = []
    requested.forEach((line, index) => {
      const article = byId.get(line.saleArticleId)
      const path = `/lines/${index}/saleArticleId`
      if (!article) {
        issues.push({ path, message: 'El artículo no existe' })
      } else if (!article.active) {
        issues.push({ path, message: `«${article.name}» ya no está disponible` })
      } else {
        lines.push({
          saleArticleId: article.id,
          code: article.code,
          name: article.name,
          format: article.format,
          unitsPerFormat: article.unitsPerFormat,
          unitPrice: article.price,
          requestedQty: line.quantity,
          confirmedQty: null,
        })
      }
    })
    if (issues.length > 0) {
      throw new ValidationError('Hay artículos del pedido que no se pueden pedir', issues)
    }
    return lines
  }

  private ensureCanTransition(order: Order, to: OrderStatus): void {
    if (!canTransition(order.status, to)) {
      throw new InvalidStateError(
        `El pedido ${order.number} está «${ORDER_STATUS_LABELS[order.status]}» y no se puede ${ACTION_VERBS[to] ?? 'modificar'}`,
      )
    }
  }

  private async applyTransition(
    order: Order,
    to: OrderStatus,
    user: AuthUser,
    { lines, reason }: { lines?: OrderLine[]; reason?: string } = {},
  ): Promise<Order> {
    this.ensureCanTransition(order, to)
    const updated = await this.repository.transition(order.id, order.status, {
      status: to,
      lines,
      entry: this.historyEntry(to, user, reason),
    })
    if (!updated) {
      throw new InvalidStateError(
        `El pedido ${order.number} ha cambiado mientras tanto. Recarga para ver su estado actual`,
      )
    }
    return updated
  }

  private historyEntry(status: OrderStatus, user: OrderAuthor, reason?: string) {
    return {
      status,
      at: new Date().toISOString(),
      userId: user.id,
      userName: user.displayName,
      reason: reason ?? null,
    }
  }
}
