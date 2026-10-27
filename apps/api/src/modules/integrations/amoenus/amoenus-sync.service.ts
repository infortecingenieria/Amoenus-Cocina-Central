import {
  amoenusEventFor,
  type AmoenusDeliveryNote,
  type AmoenusOrderLink,
  type AmoenusSync,
  type AmoenusSyncEvent,
  type Order,
} from '@cocina-central/shared'
import type { FastifyBaseLogger } from 'fastify'

import { InvalidStateError, NotFoundError } from '../../../shared/errors'
import type { DeliveryNoteService } from '../../delivery-notes/delivery-note.service'
import type { OrderRepository } from '../../orders/order.repository'
import type { OrderResolvedListener } from '../../orders/order.service'
import type { AmoenusClient } from './amoenus.client'

/** Cuánto queda reservado un envío: de sobra para el timeout del cliente HTTP. */
const SEND_LEASE_MS = 60_000

/**
 * Comunica a Amoenus cómo ha resuelto el obrador los pedidos vinculados (`amoenusEventFor`): de los
 * suyos, el albarán al aprobar o el rechazo; de los de una tienda vinculada, el pedido con su
 * albarán al aprobar. El resultado queda en `order.amoenus.sync`. Lo que no se ha enviado se deduce
 * del estado del pedido, así que si Amoenus no responde o el proceso se cae a mitad, se reintenta
 * (`retryUnsent`) o se reenvía a mano.
 */
export class AmoenusSyncService implements OrderResolvedListener {
  private readonly orders: OrderRepository
  private readonly deliveryNotes: DeliveryNoteService
  private readonly client: AmoenusClient
  private readonly log: Pick<FastifyBaseLogger, 'error'>

  constructor(
    orders: OrderRepository,
    deliveryNotes: DeliveryNoteService,
    client: AmoenusClient,
    log: Pick<FastifyBaseLogger, 'error'>,
  ) {
    this.orders = orders
    this.deliveryNotes = deliveryNotes
    this.client = client
    this.log = log
  }

  /** Al aprobar o rechazar, lo intenta en el momento. Nunca lanza: lo que no se envíe se reintenta. */
  async orderResolved(order: Order): Promise<void> {
    if (!amoenusEventFor(order)) return
    try {
      await this.send(order.id)
    } catch (error) {
      this.log.error({ err: error, orderId: order.id }, 'Error enviando el pedido a Amoenus')
    }
  }

  /** Reenvío a mano desde la ficha del pedido (obrador). */
  async resend(orderId: string): Promise<Order> {
    const order = await this.orders.findById(orderId)
    if (!order) throw new NotFoundError('Pedido no encontrado')
    if (!amoenusEventFor(order)) {
      throw new InvalidStateError(`El pedido ${order.number} no tiene nada que enviar a Amoenus`)
    }
    await this.send(order.id)
    return (await this.orders.findById(orderId)) ?? order
  }

  /**
   * Envía lo que el pedido tenga pendiente y guarda el resultado. Antes lo reserva en la base de
   * datos, así que si ya lo está enviando otro (el reintento periódico, otra instancia de la API o
   * un reenvío a mano) no sale dos veces. null = nada que enviar, ya enviado o enviándose.
   */
  async send(orderId: string): Promise<AmoenusSync | null> {
    const claimedUntil = new Date(Date.now() + SEND_LEASE_MS)
    const order = await this.orders.claimAmoenusSync(orderId, claimedUntil)
    const event = order && amoenusEventFor(order)
    // Sin evento la reserva se deja caducar: no hay nada que enviar.
    if (!order?.amoenus || !event) return null

    const previous = order.amoenus.sync
    const attempts = (previous?.attempts ?? 0) + 1
    const now = new Date().toISOString()
    let result: AmoenusSync
    try {
      await this.deliver(order, order.amoenus, event)
      result = { status: 'sent', attempts, lastError: null, lastAttemptAt: now, sentAt: now }
    } catch (error) {
      result = {
        status: 'failed',
        attempts,
        lastError: error instanceof Error ? error.message : String(error),
        lastAttemptAt: now,
        sentAt: null,
      }
    }
    await this.orders.saveAmoenusSync(order.id, result, claimedUntil)
    return result
  }

  /** Reintenta todos los envíos sin completar. Devuelve cuántos quedan enviados. */
  async retryUnsent(): Promise<number> {
    let sent = 0
    for (const orderId of await this.orders.findIdsPendingAmoenusSync()) {
      if ((await this.send(orderId))?.status === 'sent') sent += 1
    }
    return sent
  }

  private async deliver(
    order: Order,
    link: AmoenusOrderLink,
    event: AmoenusSyncEvent,
  ): Promise<void> {
    if (link.origin === 'linked_store') {
      await this.client.sendStoreOrder({
        orderId: order.id,
        orderNumber: order.number,
        localId: link.localId,
        storeName: order.storeName,
        createdByName: order.createdBy.displayName,
        createdAt: order.createdAt,
        notes: order.notes,
        deliveryNote: await this.buildDeliveryNote(order),
      })
      return
    }

    if (event === 'delivery_note') {
      await this.client.sendDeliveryNote({
        externalOrderId: link.externalOrderId,
        orderNumber: order.number,
        deliveryNote: await this.buildDeliveryNote(order),
      })
      return
    }

    const rejection = order.statusHistory.findLast((entry) => entry.status === 'rejected')
    if (!rejection) throw new Error('El pedido no está rechazado')
    await this.client.sendRejection({
      externalOrderId: link.externalOrderId,
      orderNumber: order.number,
      reason: rejection.reason ?? '',
      rejectedAt: rejection.at,
      rejectedBy: rejection.userName,
    })
  }

  private async buildDeliveryNote(order: Order): Promise<AmoenusDeliveryNote> {
    const deliveryNote = await this.deliveryNotes.ensureForOrder(order)
    return {
      number: deliveryNote.number,
      issuedAt: deliveryNote.issuedAt,
      lines: deliveryNote.lines.map((line) => ({
        code: line.code,
        name: line.name,
        requestedQty: line.requestedQty,
        deliveredQty: line.deliveredQty,
        unitPrice: line.unitPrice,
      })),
    }
  }
}
