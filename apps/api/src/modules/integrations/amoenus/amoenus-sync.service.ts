import type { AmoenusDeliveryNote, AmoenusSync, Order } from '@cocina-central/shared'

import type { DeliveryNoteRepository } from '../../delivery-notes/delivery-note.repository'
import type { OrderRepository } from '../../orders/order.repository'
import type { AmoenusClient } from './amoenus.client'

type AmoenusSyncEvent = AmoenusSync['event']

/** Pedidos que se comunican a Amoenus: los que vienen de allí y los de tiendas vinculadas a un local. */
const isSyncedWithAmoenus = (order: Order): boolean =>
  order.source?.system === 'amoenus' || order.amoenusLocalId !== null

/**
 * Comunica a Amoenus cómo ha resuelto el obrador los pedidos: de los suyos, el albarán al aprobar
 * o el rechazo; de los de una tienda vinculada, el pedido con su albarán al aprobar.
 * El estado del envío queda en `order.amoenusSync`; si Amoenus no responde, el pedido sigue
 * resuelto aquí y el envío se reintenta (`retryUnsent`) o se reenvía a mano.
 */
export class AmoenusSyncService {
  private readonly orders: OrderRepository
  private readonly deliveryNotes: DeliveryNoteRepository
  private readonly client: AmoenusClient

  constructor(
    orders: OrderRepository,
    deliveryNotes: DeliveryNoteRepository,
    client: AmoenusClient,
  ) {
    this.orders = orders
    this.deliveryNotes = deliveryNotes
    this.client = client
  }

  /** Deja el envío pendiente y lo intenta en el momento. Nunca lanza: el fallo queda en el pedido. */
  async queue(order: Order, event: AmoenusSyncEvent): Promise<void> {
    if (!isSyncedWithAmoenus(order)) return
    await this.orders.setAmoenusSync(order.id, {
      event,
      status: 'pending',
      attempts: 0,
      lastError: null,
      lastAttemptAt: null,
      sentAt: null,
    })
    await this.send(order.id)
  }

  /** Envía (o reenvía) lo que esté pendiente del pedido y guarda el resultado. */
  async send(orderId: string): Promise<AmoenusSync | null> {
    const order = await this.orders.findById(orderId)
    if (!order?.amoenusSync || !isSyncedWithAmoenus(order)) return null

    const sync = order.amoenusSync
    const now = new Date().toISOString()
    let result: AmoenusSync
    try {
      await this.deliver(order, sync.event)
      result = {
        ...sync,
        status: 'sent',
        attempts: sync.attempts + 1,
        lastError: null,
        lastAttemptAt: now,
        sentAt: now,
      }
    } catch (error) {
      result = {
        ...sync,
        status: 'failed',
        attempts: sync.attempts + 1,
        lastError: error instanceof Error ? error.message : String(error),
        lastAttemptAt: now,
      }
    }
    await this.orders.setAmoenusSync(order.id, result)
    return result
  }

  /** Reintenta todos los envíos sin completar. Devuelve cuántos quedan enviados. */
  async retryUnsent(): Promise<number> {
    let sent = 0
    for (const orderId of await this.orders.findIdsWithUnsentAmoenusSync()) {
      if ((await this.send(orderId))?.status === 'sent') sent += 1
    }
    return sent
  }

  private async deliver(order: Order, event: AmoenusSyncEvent): Promise<void> {
    if (event === 'store_order') {
      if (!order.amoenusLocalId) throw new Error('La tienda del pedido no está vinculada a Amoenus')
      await this.client.sendStoreOrder({
        orderId: order.id,
        orderNumber: order.number,
        localId: order.amoenusLocalId,
        storeName: order.storeName,
        createdByName: order.createdBy.displayName,
        createdAt: order.createdAt,
        notes: order.notes,
        deliveryNote: await this.buildDeliveryNote(order),
      })
      return
    }

    const source = order.source as NonNullable<Order['source']>
    if (event === 'delivery_note') {
      await this.client.sendDeliveryNote({
        externalOrderId: source.externalOrderId,
        orderNumber: order.number,
        deliveryNote: await this.buildDeliveryNote(order),
      })
      return
    }

    const rejection = order.statusHistory.findLast((entry) => entry.status === 'rejected')
    if (!rejection) throw new Error('El pedido no está rechazado')
    await this.client.sendRejection({
      externalOrderId: source.externalOrderId,
      orderNumber: order.number,
      reason: rejection.reason ?? '',
      rejectedAt: rejection.at,
      rejectedBy: rejection.userName,
    })
  }

  private async buildDeliveryNote(order: Order): Promise<AmoenusDeliveryNote> {
    const deliveryNote = await this.deliveryNotes.findByOrderId(order.id)
    if (!deliveryNote) throw new Error('El pedido no tiene albarán')
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
