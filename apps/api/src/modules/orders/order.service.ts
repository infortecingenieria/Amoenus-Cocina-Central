import {
  canTransition,
  isFromAmoenus,
  ORDER_STATUS_LABELS,
  type AmoenusOrderLink,
  type ApproveOrderInput,
  type AuthUser,
  type CreateOrderData,
  type DeliveryNoteRef,
  type ListOrdersQuery,
  type Order,
  type OrderLine,
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
import type { UserRepository } from '../auth/user.repository'
import type { DeliveryNoteService } from '../delivery-notes/delivery-note.service'
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
  amoenus: AmoenusOrderLink | null
}

/**
 * Lo que tiene que pasar cuando el obrador aprueba, rechaza o envía un pedido, fuera de este módulo
 * (p. ej. comunicarlo a Amoenus). No debe lanzar: el cambio ya está guardado. Al aprobar y rechazar
 * se espera a los listeners; al enviar se avisan en segundo plano.
 */
export interface OrderResolvedListener {
  orderResolved(order: Order): Promise<void>
}

export interface OrderServiceOptions {
  /** Al enviar, deja la venta pendiente de registrar en Amoenus (integración activa). */
  amoenusSales?: boolean
}

/** Verbo de cada acción para los mensajes de error. */
const ACTION_VERBS: Partial<Record<OrderStatus, string>> = {
  approved: 'aprobar',
  modified: 'aprobar',
  shipped: 'marcar como enviado',
  rejected: 'rechazar',
  cancelled: 'cancelar',
}

/** Reglas de negocio de los pedidos de tienda al obrador. */
export class OrderService {
  private readonly repository: OrderRepository
  private readonly saleArticles: SaleArticleRepository
  private readonly deliveryNotes: DeliveryNoteService
  private readonly resolvedListeners: OrderResolvedListener[]
  private readonly users: UserRepository
  private readonly amoenusSales: boolean

  constructor(
    repository: OrderRepository,
    saleArticles: SaleArticleRepository,
    deliveryNotes: DeliveryNoteService,
    resolvedListeners: OrderResolvedListener[],
    users: UserRepository,
    { amoenusSales = false }: OrderServiceOptions = {},
  ) {
    this.repository = repository
    this.saleArticles = saleArticles
    this.deliveryNotes = deliveryNotes
    this.resolvedListeners = resolvedListeners
    this.users = users
    this.amoenusSales = amoenusSales
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
    const amoenusLocalId = await this.users.findAmoenusLocalId(user.id)
    return this.createFor({
      ...data,
      storeName: user.storeName,
      author: user,
      amoenus: amoenusLocalId
        ? { origin: 'linked_store', localId: amoenusLocalId, sync: null }
        : null,
    })
  }

  /**
   * Alta de un pedido pendiente para una tienda. La usan la propia tienda y las integraciones
   * (Amoenus), para que todos los pedidos compartan validación de artículos y numeración.
   */
  async createFor({
    storeName,
    notes,
    lines,
    author,
    amoenus,
  }: NewOrderRequest): Promise<Order> {
    const orderLines = await this.buildLines(lines)
    const year = currentYear()
    const number = formatOrderNumber(year, await nextSequence(`order-${year}`))

    return this.repository.create({
      number,
      storeName,
      notes: notes || null,
      amoenus,
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

    const confirmed = new Map((data.lines ?? []).map((line) => [line.saleArticleId, line]))
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

    const lines: OrderLine[] = order.lines.map((line) => {
      const input = confirmed.get(line.saleArticleId)
      const confirmedQty = input?.confirmedQty ?? line.requestedQty
      // Lo que no se sirve no lleva lote ni caducidad.
      const served = confirmedQty > 0
      return {
        ...line,
        confirmedQty,
        lotNumber: served ? (input?.lotNumber ?? null) : null,
        expiryDate: served ? (input?.expiryDate ?? null) : null,
      }
    })
    if (lines.every((line) => line.confirmedQty === 0)) {
      throw new ValidationError('Para no servir ningún artículo, rechaza el pedido')
    }

    const modified = lines.some((line) => line.confirmedQty !== line.requestedQty)
    if (modified && !data.reason) {
      const message = 'Indica el motivo de los cambios'
      throw new ValidationError(message, [{ path: '/reason', message }])
    }
    // El albarán se emite con la aprobación, en la misma escritura; el documento se genera a
    // continuación y, si eso se interrumpe, cuando vuelva a hacer falta (`ensureForOrder`).
    const deliveryNote = await this.deliveryNotes.reserve()
    const approved = modified
      ? await this.applyTransition(order, 'modified', user, {
          lines,
          reason: data.reason,
          deliveryNote,
        })
      : await this.applyTransition(order, 'approved', user, { lines, deliveryNote })
    await this.deliveryNotes.ensureForOrder(approved)
    return this.resolved(approved)
  }

  async reject(id: string, { reason }: RejectOrderInput, user: AuthUser): Promise<Order> {
    const order = await this.getById(id, user)
    return this.resolved(await this.applyTransition(order, 'rejected', user, { reason }))
  }

  /**
   * El obrador ha enviado el pedido a la tienda, con lo aprobado: es su venta. La venta para
   * Amoenus queda pendiente en la misma escritura, así que no se pierde aunque el envío falle.
   * No espera a Amoenus (registrar el ticket tarda: allí se recalcula el día del local); el pedido
   * vuelve con la venta sin enviar (`sync: null`) y la ficha muestra cómo acaba.
   */
  async ship(id: string, user: AuthUser): Promise<Order> {
    const order = await this.getById(id, user)
    const shipped = await this.applyTransition(order, 'shipped', user, {
      amoenusSale: this.amoenusSales,
    })
    this.notifyInBackground(shipped)
    return shipped
  }

  /**
   * Solo la tienda que lo hizo y solo mientras el obrador no lo ha tramitado. Los que llegan de
   * Amoenus no: allí no se puede cancelar un pedido enviado y se quedaría esperando el albarán.
   */
  async cancel(id: string, user: AuthUser): Promise<Order> {
    const order = await this.getById(id, user)
    if (isFromAmoenus(order)) {
      throw new InvalidStateError(
        `El pedido ${order.number} se hizo desde Amoenus y no se puede cancelar aquí`,
      )
    }
    return this.applyTransition(order, 'cancelled', user)
  }

  /** Avisa de la resolución y devuelve el pedido como haya quedado (p. ej. con el envío a Amoenus). */
  private async resolved(order: Order): Promise<Order> {
    for (const listener of this.resolvedListeners) await listener.orderResolved(order)
    const reloaded = await this.repository.findById(order.id)
    if (!reloaded) throw new NotFoundError('Pedido no encontrado')
    return reloaded
  }

  /**
   * Como `resolved`, sin esperar: los listeners se avisan en segundo plano y en el mismo orden. No
   * lanzan, y lo que no se envíe se reintenta.
   */
  private notifyInBackground(order: Order): void {
    void (async () => {
      for (const listener of this.resolvedListeners) {
        await listener.orderResolved(order).catch(() => undefined)
      }
    })()
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
          lotNumber: null,
          expiryDate: null,
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
    {
      lines,
      reason,
      deliveryNote,
      amoenusSale,
    }: {
      lines?: OrderLine[]
      reason?: string
      deliveryNote?: DeliveryNoteRef
      amoenusSale?: boolean
    } = {},
  ): Promise<Order> {
    this.ensureCanTransition(order, to)
    const updated = await this.repository.transition(order.id, order.status, {
      status: to,
      lines,
      deliveryNote,
      amoenusSale,
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
