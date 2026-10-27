import type {
  AmoenusOrderInput,
  ApiErrorBody,
  CreateSaleArticleInput,
  Order,
  SaleArticle,
} from '@cocina-central/shared'
import type { InjectOptions } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { UserModel } from '../src/modules/auth/user.model'
import { DeliveryNoteModel } from '../src/modules/delivery-notes/delivery-note.model'
import { OrderModel } from '../src/modules/orders/order.model'
import {
  clearDatabase,
  createTestApp,
  FakeAmoenusClient,
  TEST_AMOENUS_API_KEY,
  TEST_USER_IDS,
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

const EXTERNAL_ORDER_ID = '6ad900000000000000000001'

const amoenusOrder = (externalOrderId = EXTERNAL_ORDER_ID): AmoenusOrderInput => ({
  externalOrderId,
  clientId: '6ad0e888633d003bc06d96e2',
  localId: '6ad2118ea308181751f12e16',
  localName: 'La Empanadera Gran Via',
  createdByName: 'amoenuslaempanadera',
  notes: null,
  lines: [
    { code: '10001', quantity: 3 },
    { code: '20001', quantity: 2 },
  ],
})

describe('Albaranes y envíos a Amoenus', () => {
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
    amoenus.reset()
    articles = {
      barra: await createArticle(barra),
      croissant: await createArticle(croissant),
    }
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

  async function receiveFromAmoenus(externalOrderId?: string) {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/integrations/amoenus/orders',
      payload: amoenusOrder(externalOrderId),
      headers: { 'x-api-key': TEST_AMOENUS_API_KEY },
    })
    expect(response.statusCode).toBe(201)
    return response.json<Order>()
  }

  const approve = (id: string, payload: object = {}) =>
    asAdmin({ method: 'POST', url: `/api/v1/orders/${id}/approve`, payload })

  describe('albarán', () => {
    it('se genera al aprobar, con lo que sirve el obrador', async () => {
      const order = await receiveFromAmoenus()
      const response = await approve(order.id, {
        lines: [{ saleArticleId: articles.croissant.id, confirmedQty: 0 }],
        reason: 'Sin existencias de croissant',
      })

      expect(response.statusCode).toBe(200)
      const approved = response.json<Order>()
      expect(approved.status).toBe('modified')
      expect(approved.deliveryNote?.number).toMatch(/^ALB-\d{4}-0001$/)
    })

    it('numera los albaranes de forma correlativa', async () => {
      await approve((await receiveFromAmoenus()).id)
      const second = await approve((await receiveFromAmoenus('6ad900000000000000000002')).id)
      expect(second.json<Order>().deliveryNote?.number).toMatch(/^ALB-\d{4}-0002$/)
    })

    it('un pedido de la tienda también tiene albarán, pero no se envía a Amoenus', async () => {
      const created = await asStore({
        method: 'POST',
        url: '/api/v1/orders',
        payload: { notes: null, lines: [{ saleArticleId: articles.barra.id, quantity: 1 }] },
      })
      const approved = (await approve(created.json<Order>().id)).json<Order>()

      expect(approved.deliveryNote).not.toBeNull()
      expect(approved.amoenus).toBeNull()
      expect(amoenus.deliveryNotes).toHaveLength(0)
    })

    it('al rechazar no se genera albarán', async () => {
      const order = await receiveFromAmoenus()
      const rejected = await asAdmin({
        method: 'POST',
        url: `/api/v1/orders/${order.id}/reject`,
        payload: { reason: 'Fuera de plazo' },
      })
      expect(rejected.json<Order>().deliveryNote).toBeNull()
    })
  })

  describe('envío a Amoenus', () => {
    it('envía el albarán del pedido aprobado con lo pedido y lo servido', async () => {
      const order = await receiveFromAmoenus()
      const approved = (
        await approve(order.id, {
          lines: [{ saleArticleId: articles.croissant.id, confirmedQty: 0 }],
          reason: 'Sin existencias de croissant',
        })
      ).json<Order>()

      expect(approved.amoenus?.sync).toMatchObject({ status: 'sent', attempts: 1, lastError: null })
      expect(amoenus.deliveryNotes).toEqual([
        {
          externalOrderId: EXTERNAL_ORDER_ID,
          orderNumber: order.number,
          deliveryNote: {
            number: approved.deliveryNote?.number,
            issuedAt: expect.any(String),
            lines: [
              {
                code: '10001',
                name: 'Barra Rústica Tradicional',
                requestedQty: 3,
                deliveredQty: 3,
                unitPrice: 1.45,
              },
              {
                code: '20001',
                name: 'Croissant Mantequilla',
                requestedQty: 2,
                deliveredQty: 0,
                unitPrice: 0.85,
              },
            ],
          },
        },
      ])
    })

    it('envía el rechazo con el motivo', async () => {
      const order = await receiveFromAmoenus()
      const rejected = (
        await asAdmin({
          method: 'POST',
          url: `/api/v1/orders/${order.id}/reject`,
          payload: { reason: 'Fuera de plazo' },
        })
      ).json<Order>()

      expect(rejected.amoenus?.sync).toMatchObject({ status: 'sent' })
      expect(amoenus.rejections).toEqual([
        {
          externalOrderId: EXTERNAL_ORDER_ID,
          orderNumber: order.number,
          reason: 'Fuera de plazo',
          rejectedAt: expect.any(String),
          rejectedBy: 'kitchen_admin',
        },
      ])
    })

    it('si Amoenus no responde, el pedido queda aprobado y el envío se reintenta', async () => {
      const order = await receiveFromAmoenus()
      amoenus.failing = true

      const response = await approve(order.id)
      expect(response.statusCode).toBe(200)
      expect(response.json<Order>()).toMatchObject({
        status: 'approved',
        amoenus: {
          sync: { status: 'failed', attempts: 1, lastError: 'Amoenus no está disponible' },
        },
      })

      amoenus.failing = false
      expect(await ctx.app.amoenusSync.retryUnsent()).toBe(1)

      const stored = (await asAdmin({ url: `/api/v1/orders/${order.id}` })).json<Order>()
      expect(stored.amoenus?.sync).toMatchObject({ status: 'sent', attempts: 2, lastError: null })
      expect(amoenus.deliveryNotes).toHaveLength(1)
      // Lo ya enviado no se vuelve a reintentar.
      expect(await ctx.app.amoenusSync.retryUnsent()).toBe(0)
    })

    it('si la aprobación se interrumpe tras guardarla, el reintento genera el albarán y lo envía', async () => {
      const order = await receiveFromAmoenus()
      const approved = (await approve(order.id)).json<Order>()
      // Estado en que queda si el proceso cae justo después de guardar la aprobación: el pedido ya
      // tiene el número de albarán, pero ni el documento ni el envío existen.
      await DeliveryNoteModel.deleteMany({})
      await OrderModel.updateOne({ _id: order.id }, { $set: { 'amoenus.sync': null } })
      amoenus.reset()

      expect(await ctx.app.amoenusSync.retryUnsent()).toBe(1)
      expect(amoenus.deliveryNotes).toEqual([
        expect.objectContaining({
          deliveryNote: expect.objectContaining({ number: approved.deliveryNote?.number }),
        }),
      ])
      expect(await DeliveryNoteModel.countDocuments({ number: approved.deliveryNote?.number })).toBe(
        1,
      )
    })

    it('no envía dos veces el mismo pedido aunque coincidan varios envíos', async () => {
      const order = await receiveFromAmoenus()
      amoenus.failing = true
      await approve(order.id)
      amoenus.failing = false

      await Promise.all([
        ctx.app.amoenusSync.retryUnsent(),
        ctx.app.amoenusSync.retryUnsent(),
        asAdmin({ method: 'POST', url: `/api/v1/orders/${order.id}/amoenus-sync` }),
      ])

      expect(amoenus.deliveryNotes).toHaveLength(1)
      const stored = (await asAdmin({ url: `/api/v1/orders/${order.id}` })).json<Order>()
      expect(stored.amoenus?.sync).toMatchObject({ status: 'sent', attempts: 2 })
    })

    it('el obrador puede reenviarlo a mano', async () => {
      const order = await receiveFromAmoenus()
      amoenus.failing = true
      await approve(order.id)
      amoenus.failing = false

      const response = await asAdmin({
        method: 'POST',
        url: `/api/v1/orders/${order.id}/amoenus-sync`,
      })
      expect(response.statusCode).toBe(200)
      expect(response.json<Order>().amoenus?.sync?.status).toBe('sent')
    })

    it('no hay nada que reenviar en un pedido sin resolver', async () => {
      const order = await receiveFromAmoenus()
      const response = await asAdmin({
        method: 'POST',
        url: `/api/v1/orders/${order.id}/amoenus-sync`,
      })
      expect(response.statusCode).toBe(409)
      expect(response.json<ApiErrorBody>().code).toBe('INVALID_STATE')
    })

    it('la tienda no puede reenviar', async () => {
      const order = await receiveFromAmoenus()
      await approve(order.id)
      const response = await asStore({
        method: 'POST',
        url: `/api/v1/orders/${order.id}/amoenus-sync`,
      })
      expect(response.statusCode).toBe(403)
    })
  })

  describe('pedidos de una tienda vinculada a un local de Amoenus', () => {
    const LOCAL_ID = '6ad2118ea308181751f12e16'

    /** El usuario de tienda de los tests, guardado con el vínculo a su local de Amoenus. */
    async function linkStoreToAmoenus() {
      await UserModel.create({
        _id: TEST_USER_IDS.store,
        username: 'store',
        passwordHash: 'sin-uso',
        displayName: 'store',
        role: 'store',
        storeName: 'Tienda de pruebas',
        amoenusLocalId: LOCAL_ID,
      })
    }

    async function storeOrder() {
      const response = await asStore({
        method: 'POST',
        url: '/api/v1/orders',
        payload: {
          notes: 'Para el sábado',
          lines: [
            { saleArticleId: articles.barra.id, quantity: 3 },
            { saleArticleId: articles.croissant.id, quantity: 2 },
          ],
        },
      })
      expect(response.statusCode).toBe(201)
      return response.json<Order>()
    }

    it('el pedido guarda el local de Amoenus de la tienda', async () => {
      await linkStoreToAmoenus()
      expect((await storeOrder()).amoenus).toEqual({
        origin: 'linked_store',
        localId: LOCAL_ID,
        sync: null,
      })
    })

    it('al aprobarlo envía a Amoenus el pedido con su albarán', async () => {
      await linkStoreToAmoenus()
      const order = await storeOrder()
      const approved = (
        await approve(order.id, {
          lines: [{ saleArticleId: articles.croissant.id, confirmedQty: 1 }],
          reason: 'Solo queda una caja',
        })
      ).json<Order>()

      expect(approved.amoenus?.sync).toMatchObject({ status: 'sent' })
      expect(amoenus.storeOrders).toEqual([
        {
          orderId: order.id,
          orderNumber: order.number,
          localId: LOCAL_ID,
          storeName: 'Tienda de pruebas',
          createdByName: 'store',
          createdAt: order.createdAt,
          notes: 'Para el sábado',
          deliveryNote: {
            number: approved.deliveryNote?.number,
            issuedAt: expect.any(String),
            lines: [
              {
                code: '10001',
                name: 'Barra Rústica Tradicional',
                requestedQty: 3,
                deliveredQty: 3,
                unitPrice: 1.45,
              },
              {
                code: '20001',
                name: 'Croissant Mantequilla',
                requestedQty: 2,
                deliveredQty: 1,
                unitPrice: 0.85,
              },
            ],
          },
        },
      ])
      expect(amoenus.deliveryNotes).toHaveLength(0)
    })

    it('si la tienda no está vinculada no se envía nada', async () => {
      const order = await storeOrder()
      expect(order.amoenus).toBeNull()
      const approved = (await approve(order.id)).json<Order>()
      expect(approved.amoenus).toBeNull()
      expect(amoenus.storeOrders).toHaveLength(0)
    })

    it('al rechazarlo no se envía nada: en Amoenus no existe', async () => {
      await linkStoreToAmoenus()
      const order = await storeOrder()
      const rejected = (
        await asAdmin({
          method: 'POST',
          url: `/api/v1/orders/${order.id}/reject`,
          payload: { reason: 'Fuera de plazo' },
        })
      ).json<Order>()
      expect(rejected.amoenus?.sync).toBeNull()
      expect(amoenus.rejections).toHaveLength(0)
      expect(await ctx.app.amoenusSync.retryUnsent()).toBe(0)
    })

    it('la tienda puede cancelarlo: en Amoenus aún no existe', async () => {
      await linkStoreToAmoenus()
      const order = await storeOrder()
      const response = await asStore({ method: 'POST', url: `/api/v1/orders/${order.id}/cancel` })
      expect(response.json<Order>().status).toBe('cancelled')
    })

    it('si Amoenus no responde, se reintenta como el resto de envíos', async () => {
      await linkStoreToAmoenus()
      const order = await storeOrder()
      amoenus.failing = true
      expect((await approve(order.id)).json<Order>().amoenus?.sync).toMatchObject({
        status: 'failed',
      })

      amoenus.failing = false
      expect(await ctx.app.amoenusSync.retryUnsent()).toBe(1)
      expect(amoenus.storeOrders).toHaveLength(1)
    })
  })
})
