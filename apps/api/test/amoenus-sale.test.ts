import type {
  AmoenusCatalogSyncResult,
  ApiErrorBody,
  CreateSaleArticleInput,
  Order,
  SaleArticle,
} from '@cocina-central/shared'
import type { InjectOptions } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { OrderModel } from '../src/modules/orders/order.model'
import { businessDateTime } from '../src/shared/business-time'
import {
  clearDatabase,
  createTestApp,
  FakeAmoenusClient,
  TEST_AMOENUS_API_KEY,
  type TestContext,
} from './helpers/test-app'

const barra: CreateSaleArticleInput = {
  code: '10001',
  name: 'Barra Rústica Tradicional',
  format: 'tray',
  unitsPerFormat: 12,
  price: 1.45,
}
const croissant: CreateSaleArticleInput = {
  code: '20001',
  name: 'Croissant Mantequilla',
  format: 'box',
  unitsPerFormat: 30,
  price: 0.85,
}

const LOCAL_ID = '6ad2118ea308181751f12e16'

describe('Ventas del obrador como tickets de Amoenus', () => {
  const amoenus = new FakeAmoenusClient()
  let ctx: TestContext
  let articles: { barra: SaleArticle; croissant: SaleArticle }

  beforeAll(async () => {
    ctx = await createTestApp({ amoenusClient: amoenus })
  })
  afterAll(async () => {
    await ctx.close()
  })
  beforeEach(async () => {
    await clearDatabase()
    articles = {
      barra: await createArticle(barra),
      croissant: await createArticle(croissant),
    }
    amoenus.reset()
  })

  const asAdmin = (options: InjectOptions) =>
    ctx.app.inject({
      ...options,
      headers: { ...ctx.authHeaders('kitchen_admin'), ...options.headers },
    })
  const asStore = (options: InjectOptions) =>
    ctx.app.inject({ ...options, headers: { ...ctx.authHeaders('store'), ...options.headers } })

  async function createArticle(input: CreateSaleArticleInput) {
    return (
      await asAdmin({ method: 'POST', url: '/api/v1/sale-articles', payload: input })
    ).json<SaleArticle>()
  }

  /** Pedido de la tienda de los tests, que no está vinculada a ningún local de Amoenus. */
  async function storeOrder() {
    const response = await asStore({
      method: 'POST',
      url: '/api/v1/orders',
      payload: {
        notes: null,
        lines: [
          { saleArticleId: articles.barra.id, quantity: 3 },
          { saleArticleId: articles.croissant.id, quantity: 2 },
        ],
      },
    })
    expect(response.statusCode).toBe(201)
    return response.json<Order>()
  }

  async function amoenusOrder() {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/integrations/amoenus/orders',
      payload: {
        externalOrderId: '6ad900000000000000000001',
        clientId: '6ad0e888633d003bc06d96e2',
        localId: LOCAL_ID,
        localName: 'La Empanadera Gran Via',
        createdByName: 'amoenuslaempanadera',
        notes: null,
        lines: [{ code: '10001', quantity: 4 }],
      },
      headers: { 'x-api-key': TEST_AMOENUS_API_KEY },
    })
    expect(response.statusCode).toBe(201)
    return response.json<Order>()
  }

  const approve = async (id: string, payload: object = {}) => {
    const response = await asAdmin({ method: 'POST', url: `/api/v1/orders/${id}/approve`, payload })
    expect(response.statusCode).toBe(200)
    return response.json<Order>()
  }
  const shipRequest = (id: string, as = asAdmin) =>
    as({ method: 'POST', url: `/api/v1/orders/${id}/ship` })
  const getOrder = async (id: string) =>
    (await asAdmin({ url: `/api/v1/orders/${id}` })).json<Order>()
  /** El ticket se envía en segundo plano: espera a que tenga resultado (enviado o con error). */
  const waitForSale = (id: string) =>
    vi.waitFor(
      async () => {
        const order = await getOrder(id)
        if (order.amoenusSale && !order.amoenusSale.sync) throw new Error('Enviando el ticket')
        return order
      },
      { timeout: 5000, interval: 20 },
    )
  /** Marca como enviado sin esperar a Amoenus, y espera después a que acabe el envío del ticket. */
  const ship = async (id: string) => {
    const response = await shipRequest(id)
    expect(response.statusCode).toBe(200)
    expect(response.json<Order>().amoenusSale?.sync ?? null).toBeNull()
    return waitForSale(id)
  }
  /** Aprueba y marca como enviado: es al enviar cuando se registra la venta. */
  const approveAndShip = async (id: string, payload: object = {}) => {
    const approved = await approve(id, payload)
    return { approved, shipped: await ship(id) }
  }
  const resendSale = (id: string) =>
    asAdmin({ method: 'POST', url: `/api/v1/orders/${id}/amoenus-sale` })

  describe('ticket', () => {
    it('no se registra al aprobar sino al enviar, con la fecha, hora y usuario del envío', async () => {
      const order = await storeOrder()
      const approved = await approve(order.id, {
        lines: [{ saleArticleId: articles.croissant.id, confirmedQty: 0 }],
        reason: 'Sin existencias de croissant',
      })
      expect(approved.amoenusSale).toBeNull()
      expect(amoenus.saleTickets).toHaveLength(0)

      const shipped = await ship(order.id)
      expect(shipped.status).toBe('shipped')
      expect(shipped.amoenusSale?.sync).toMatchObject({ status: 'sent', attempts: 1 })
      const shipment = shipped.statusHistory.at(-1)
      expect(shipment?.status).toBe('shipped')
      const { date, time } = businessDateTime(new Date(shipment?.at ?? ''))
      expect(amoenus.saleTickets).toEqual([
        {
          orderId: order.id,
          orderNumber: order.number,
          deliveryNoteNumber: approved.deliveryNote?.number,
          channel: 'cocina_central',
          operatorName: 'kitchen_admin',
          businessDate: date,
          time,
          // El croissant no se sirve: no va en el ticket.
          lines: [
            { code: '10001', name: 'Barra Rústica Tradicional', quantity: 3, unitPrice: 1.45 },
          ],
        },
      ])
    })

    it('marcar como enviado no espera a que Amoenus registre el ticket', async () => {
      const order = await storeOrder()
      await approve(order.id)
      amoenus.saleTicketDelayMs = 300

      const started = Date.now()
      const response = await shipRequest(order.id)
      expect(Date.now() - started).toBeLessThan(300)
      expect(response.statusCode).toBe(200)
      const shipped = response.json<Order>()
      expect(shipped.status).toBe('shipped')
      expect(shipped.amoenusSale).toEqual({ sync: null })
      expect(amoenus.saleTickets).toHaveLength(0)

      const sent = await waitForSale(order.id)
      expect(sent.amoenusSale?.sync).toMatchObject({ status: 'sent', attempts: 1 })
      expect(amoenus.saleTickets).toHaveLength(1)
    })

    it('envía los tickets de uno en uno, para que no se solapen los recálculos en Amoenus', async () => {
      const first = await storeOrder()
      const second = await storeOrder()
      await approve(first.id)
      await approve(second.id)
      amoenus.saleTicketDelayMs = 50

      expect((await shipRequest(first.id)).statusCode).toBe(200)
      expect((await shipRequest(second.id)).statusCode).toBe(200)
      await waitForSale(first.id)
      await waitForSale(second.id)

      expect(amoenus.saleTickets.map((ticket) => ticket.orderNumber)).toEqual([
        first.number,
        second.number,
      ])
      expect(amoenus.maxSaleTicketsInFlight).toBe(1)
    })

    it('el de un pedido hecho en Amoenus lleva el canal y el mismo albarán que recibe la tienda', async () => {
      const { approved } = await approveAndShip((await amoenusOrder()).id)

      const deliveryNoteNumber = approved.deliveryNote?.number
      expect(amoenus.deliveryNotes).toEqual([
        expect.objectContaining({
          deliveryNote: expect.objectContaining({ number: deliveryNoteNumber }),
        }),
      ])
      expect(amoenus.saleTickets).toEqual([
        expect.objectContaining({
          channel: 'amoenus',
          deliveryNoteNumber,
          lines: [
            { code: '10001', name: 'Barra Rústica Tradicional', quantity: 4, unitPrice: 1.45 },
          ],
        }),
      ])
    })

    it('solo se envía un pedido aprobado, y una sola vez', async () => {
      const pending = await storeOrder()
      const shipPending = await shipRequest(pending.id)
      expect(shipPending.statusCode).toBe(409)
      expect(shipPending.json<ApiErrorBody>().code).toBe('INVALID_STATE')

      await asAdmin({
        method: 'POST',
        url: `/api/v1/orders/${pending.id}/reject`,
        payload: { reason: 'Fuera de plazo' },
      })
      expect((await shipRequest(pending.id)).statusCode).toBe(409)
      expect((await resendSale(pending.id)).statusCode).toBe(409)

      const order = await storeOrder()
      await approveAndShip(order.id)
      expect((await shipRequest(order.id)).statusCode).toBe(409)
      expect(amoenus.saleTickets).toHaveLength(1)
    })

    it('la tienda no puede marcar un pedido como enviado', async () => {
      const order = await storeOrder()
      await approve(order.id)
      expect((await shipRequest(order.id, asStore)).statusCode).toBe(403)
    })

    it('si Amoenus no responde, el pedido queda enviado y la venta se reintenta', async () => {
      const order = await storeOrder()
      amoenus.failing = true

      const { shipped } = await approveAndShip(order.id)
      expect(shipped.status).toBe('shipped')
      expect(shipped.amoenusSale?.sync).toMatchObject({
        status: 'failed',
        attempts: 1,
        lastError: 'Amoenus no está disponible',
      })

      amoenus.failing = false
      expect(await ctx.app.amoenusSales.retryUnsent()).toBe(1)
      const stored = (await asAdmin({ url: `/api/v1/orders/${order.id}` })).json<Order>()
      expect(stored.amoenusSale?.sync).toMatchObject({
        status: 'sent',
        attempts: 2,
        lastError: null,
      })
      expect(amoenus.saleTickets).toHaveLength(1)
      // Lo ya enviado no se vuelve a reintentar.
      expect(await ctx.app.amoenusSales.retryUnsent()).toBe(0)
    })

    it('no envía dos veces la misma venta aunque coincidan varios envíos', async () => {
      const order = await storeOrder()
      amoenus.failing = true
      await approveAndShip(order.id)
      amoenus.failing = false

      await Promise.all([
        ctx.app.amoenusSales.retryUnsent(),
        ctx.app.amoenusSales.retryUnsent(),
        resendSale(order.id),
      ])

      expect(amoenus.saleTickets).toHaveLength(1)
    })

    it('el envío de la venta es independiente del albarán, que se sigue reintentando', async () => {
      const order = await amoenusOrder()
      amoenus.failing = true
      await approveAndShip(order.id)
      amoenus.failing = false

      // Solo se reintenta la venta: el albarán sigue pendiente de su propio reintento.
      expect(await ctx.app.amoenusSales.retryUnsent()).toBe(1)
      const stored = (await asAdmin({ url: `/api/v1/orders/${order.id}` })).json<Order>()
      expect(stored.amoenusSale?.sync?.status).toBe('sent')
      expect(stored.amoenus?.sync?.status).toBe('failed')
      expect(amoenus.deliveryNotes).toHaveLength(0)

      // Un pedido ya enviado sigue teniendo el albarán pendiente.
      expect(await ctx.app.amoenusSync.retryUnsent()).toBe(1)
      expect(amoenus.deliveryNotes).toHaveLength(1)
    })

    it('un pedido enviado sin la venta marcada (sin integración) no se envía', async () => {
      const order = await storeOrder()
      amoenus.failing = true
      await approveAndShip(order.id)
      amoenus.failing = false
      // Así queda un pedido enviado mientras la integración no estaba activa.
      await OrderModel.updateOne({ _id: order.id }, { $set: { amoenusSale: null } })

      expect(await ctx.app.amoenusSales.retryUnsent()).toBe(0)
      expect((await resendSale(order.id)).statusCode).toBe(409)
      expect(amoenus.saleTickets).toHaveLength(0)
    })

    it('el obrador puede reenviarla a mano y la tienda no', async () => {
      const order = await storeOrder()
      amoenus.failing = true
      await approveAndShip(order.id)
      amoenus.failing = false

      expect(
        (await asStore({ method: 'POST', url: `/api/v1/orders/${order.id}/amoenus-sale` }))
          .statusCode,
      ).toBe(403)
      const response = await resendSale(order.id)
      expect(response.statusCode).toBe(200)
      expect(response.json<Order>().amoenusSale?.sync?.status).toBe('sent')
    })
  })

  describe('catálogo', () => {
    const syncCatalog = () => asAdmin({ method: 'POST', url: '/api/v1/sale-articles/amoenus-sync' })

    it('al crear, cambiar o borrar un artículo lo envía a Amoenus', async () => {
      const created = await createArticle({ ...barra, code: '30001', name: 'Empanada de atún' })
      await asAdmin({
        method: 'PATCH',
        url: `/api/v1/sale-articles/${created.id}`,
        payload: { price: 2.1 },
      })
      await asAdmin({ method: 'DELETE', url: `/api/v1/sale-articles/${created.id}` })

      const article = { code: '30001', name: 'Empanada de atún', family: null }
      expect(amoenus.saleArticles).toEqual([
        { articles: [{ ...article, price: 1.45, active: true }] },
        { articles: [{ ...article, price: 2.1, active: true }] },
        // Fuera de Cocina Central no se borra: queda inactivo.
        { articles: [{ ...article, price: 2.1, active: false }] },
      ])
    })

    it('un fallo de Amoenus no impide guardar el artículo', async () => {
      amoenus.failing = true
      const response = await asAdmin({
        method: 'POST',
        url: '/api/v1/sale-articles',
        payload: { ...barra, code: '30001' },
      })
      expect(response.statusCode).toBe(201)
    })

    it('sincronizar envía todo el catálogo, también lo inactivo', async () => {
      await asAdmin({
        method: 'PATCH',
        url: `/api/v1/sale-articles/${articles.croissant.id}`,
        payload: { active: false },
      })
      amoenus.reset()

      const response = await syncCatalog()
      expect(response.statusCode).toBe(200)
      expect(response.json<AmoenusCatalogSyncResult>()).toEqual({ articles: 2, error: null })
      expect(amoenus.saleArticles).toEqual([
        {
          articles: [
            { code: '10001', name: barra.name, family: null, price: 1.45, active: true },
            { code: '20001', name: croissant.name, family: null, price: 0.85, active: false },
          ],
        },
      ])
    })

    it('si Amoenus no responde, el resultado lo dice', async () => {
      amoenus.failing = true
      expect((await syncCatalog()).json<AmoenusCatalogSyncResult>()).toEqual({
        articles: 0,
        error: 'Amoenus no está disponible',
      })
    })

    it('la tienda no puede sincronizar', async () => {
      const response = await asStore({ method: 'POST', url: '/api/v1/sale-articles/amoenus-sync' })
      expect(response.statusCode).toBe(403)
    })
  })
})

describe('Sin Amoenus configurado', () => {
  let ctx: TestContext

  beforeAll(async () => {
    ctx = await createTestApp({ amoenusClient: null })
  })
  afterAll(async () => {
    await ctx.close()
  })

  const asAdmin = (options: InjectOptions) =>
    ctx.app.inject({ ...options, headers: { ...ctx.authHeaders('kitchen_admin') } })

  it('los pedidos enviados no quedan con venta que enviar', async () => {
    const article = (
      await asAdmin({ method: 'POST', url: '/api/v1/sale-articles', payload: barra })
    ).json<SaleArticle>()
    const order = (
      await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/orders',
        payload: { notes: null, lines: [{ saleArticleId: article.id, quantity: 1 }] },
        headers: ctx.authHeaders('store'),
      })
    ).json<Order>()

    await asAdmin({ method: 'POST', url: `/api/v1/orders/${order.id}/approve`, payload: {} })
    const shipped = (
      await asAdmin({ method: 'POST', url: `/api/v1/orders/${order.id}/ship` })
    ).json<Order>()
    expect(shipped.status).toBe('shipped')
    expect(shipped.amoenusSale).toBeNull()
    expect(await ctx.app.amoenusSales.retryUnsent()).toBe(0)
  })

  it('sincronizar el catálogo avisa de que no está configurado', async () => {
    const response = await asAdmin({ method: 'POST', url: '/api/v1/sale-articles/amoenus-sync' })
    expect(response.statusCode).toBe(409)
    expect(response.json<ApiErrorBody>().message).toBe(
      'La integración con Amoenus no está configurada',
    )
  })
})
