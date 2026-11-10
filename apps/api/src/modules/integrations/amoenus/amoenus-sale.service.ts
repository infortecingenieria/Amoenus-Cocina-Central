import {
  isFromAmoenus,
  type AmoenusSaleTicketPayload,
  type AmoenusSync,
  type Order,
} from '@cocina-central/shared'
import type { FastifyBaseLogger } from 'fastify'

import { businessDateTime } from '../../../shared/business-time'
import { InvalidStateError, NotFoundError } from '../../../shared/errors'
import type { DeliveryNoteService } from '../../delivery-notes/delivery-note.service'
import type { OrderRepository } from '../../orders/order.repository'
import type { OrderResolvedListener } from '../../orders/order.service'
import { attemptSend, SEND_LEASE_MS } from './amoenus-sync.service'
import type { AmoenusClient } from './amoenus.client'

/**
 * Cocina Central es el TPV del obrador: cada pedido que el obrador marca como enviado se registra
 * en Amoenus como un ticket de venta, que allí sigue el flujo de cualquier TPV (ventas, mix y
 * consumos según el escandallo). Es independiente del vínculo del pedido con Amoenus
 * (`AmoenusSyncService`): se envían todos, vengan de donde vengan. El resultado queda en
 * `order.amoenusSale.sync`; lo que no se ha enviado se reintenta (`retryUnsent`) o se reenvía a mano.
 */
export class AmoenusSaleService implements OrderResolvedListener {
  private readonly orders: OrderRepository
  private readonly deliveryNotes: DeliveryNoteService
  private readonly client: AmoenusClient
  private readonly log: Pick<FastifyBaseLogger, 'error'>
  /** Integración activa: solo entonces los pedidos que se envían quedan con venta que enviar. */
  readonly enabled: boolean
  /** Último envío en curso: los siguientes esperan a que acabe (ver `send`). */
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    orders: OrderRepository,
    deliveryNotes: DeliveryNoteService,
    client: AmoenusClient,
    log: Pick<FastifyBaseLogger, 'error'>,
    enabled: boolean,
  ) {
    this.orders = orders
    this.deliveryNotes = deliveryNotes
    this.client = client
    this.log = log
    this.enabled = enabled
  }

  /** Al marcar como enviado, lo intenta en el momento. Nunca lanza: lo que no se envíe se reintenta. */
  async orderResolved(order: Order): Promise<void> {
    if (!order.amoenusSale) return
    try {
      await this.send(order.id)
    } catch (error) {
      this.log.error({ err: error, orderId: order.id }, 'Error enviando la venta a Amoenus')
    }
  }

  /** Reenvío a mano desde la ficha del pedido (obrador). */
  async resend(orderId: string): Promise<Order> {
    const order = await this.orders.findById(orderId)
    if (!order) throw new NotFoundError('Pedido no encontrado')
    if (!order.amoenusSale) {
      throw new InvalidStateError(`El pedido ${order.number} no tiene venta que enviar a Amoenus`)
    }
    await this.send(order.id)
    return (await this.orders.findById(orderId)) ?? order
  }

  /**
   * Envía el ticket y guarda el resultado, reservando antes el envío para que no salga dos veces
   * (ver `AmoenusSyncService.send`). null = sin venta, ya enviada o enviándose.
   *
   * De uno en uno (envío al marcar como enviado, reintentos y reenvíos): Amoenus responde cuando ha
   * recalculado el día del local, y dos recálculos a la vez del mismo día duplican ventas, mix y
   * franjas (allí se rehacen borrando y creando). Supone una sola instancia de esta API.
   */
  send(orderId: string): Promise<AmoenusSync | null> {
    const run = this.queue.then(() => this.sendNow(orderId))
    this.queue = run.catch(() => undefined)
    return run
  }

  private async sendNow(orderId: string): Promise<AmoenusSync | null> {
    const claimedUntil = new Date(Date.now() + SEND_LEASE_MS)
    const order = await this.orders.claimAmoenusSync(orderId, 'amoenusSale', claimedUntil)
    if (!order?.amoenusSale) return null

    const result = await attemptSend(order.amoenusSale.sync, async () =>
      this.client.sendSaleTicket(await this.buildTicket(order)),
    )
    await this.orders.saveAmoenusSync(order.id, 'amoenusSale', result, claimedUntil)
    return result
  }

  /** Reintenta todas las ventas sin enviar. Devuelve cuántas quedan enviadas. */
  async retryUnsent(): Promise<number> {
    let sent = 0
    for (const orderId of await this.orders.findIdsPendingAmoenusSync('amoenusSale')) {
      if ((await this.send(orderId))?.status === 'sent') sent += 1
    }
    return sent
  }

  /** Lo servido según el albarán, con la fecha y el usuario del envío (hora de Madrid). */
  private async buildTicket(order: Order): Promise<AmoenusSaleTicketPayload> {
    const shipment = order.statusHistory.findLast((entry) => entry.status === 'shipped')
    if (!shipment) throw new Error('El pedido no está enviado')
    const deliveryNote = await this.deliveryNotes.ensureForOrder(order)
    const { date, time } = businessDateTime(new Date(shipment.at))
    return {
      orderId: order.id,
      orderNumber: order.number,
      deliveryNoteNumber: deliveryNote.number,
      channel: isFromAmoenus(order) ? 'amoenus' : 'cocina_central',
      operatorName: shipment.userName,
      businessDate: date,
      time,
      lines: deliveryNote.lines
        .filter((line) => line.deliveredQty > 0)
        .map((line) => ({
          code: line.code,
          name: line.name,
          quantity: line.deliveredQty,
          unitPrice: line.unitPrice,
        })),
    }
  }
}
