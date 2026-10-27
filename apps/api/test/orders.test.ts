import type {
  ApiErrorBody,
  AuthUser,
  CreateOrderInput,
  CreateSaleArticleInput,
  Order,
  OrderSummary,
  Paginated,
  SaleArticle,
} from '@cocina-central/shared'
import type { InjectOptions } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { DeliveryNoteModel } from '../src/modules/delivery-notes/delivery-note.model'
import { clearDatabase, createTestApp, type TestContext } from './helpers/test-app'

const baseUrl = '/api/v1/orders'

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

/** Usuario de otra tienda, para comprobar que cada tienda solo ve lo suyo. */
const otherStoreUser: AuthUser = {
  id: '64b7f0c2a1b2c3d4e5f60003',
  username: 'otra',
  displayName: 'Otra tienda',
  role: 'store',
  storeName: 'Otra tienda',
}

describe('API /orders', () => {
  let ctx: TestContext
  let articles: { barra: SaleArticle; croissant: SaleArticle }

  beforeAll(async () => {
    ctx = await createTestApp()
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
  })

  const asAdmin = (options: InjectOptions) =>
    ctx.app.inject({
      ...options,
      headers: { ...ctx.authHeaders('kitchen_admin'), ...options.headers },
    })
  const asStore = (options: InjectOptions) =>
    ctx.app.inject({ ...options, headers: { ...ctx.authHeaders('store'), ...options.headers } })
  const asOtherStore = (options: InjectOptions) =>
    ctx.app.inject({
      ...options,
      headers: { authorization: `Bearer ${ctx.app.signSessionToken(otherStoreUser)}` },
    })

  async function createArticle(input: CreateSaleArticleInput) {
    return (
      await asAdmin({ method: 'POST', url: '/api/v1/sale-articles', payload: input })
    ).json<SaleArticle>()
  }

  const orderInput = (overrides: Partial<CreateOrderInput> = {}): CreateOrderInput => ({
    notes: 'Dejar en la puerta de atrás',
    lines: [
      { saleArticleId: articles.barra.id, quantity: 3 },
      { saleArticleId: articles.croissant.id, quantity: 2 },
    ],
    ...overrides,
  })

  const createOrder = async (overrides?: Partial<CreateOrderInput>) => {
    const response = await asStore({ method: 'POST', url: baseUrl, payload: orderInput(overrides) })
    expect(response.statusCode).toBe(201)
    return response.json<Order>()
  }

  describe('alta', () => {
    it('crea el pedido pendiente con una copia de los artículos y su total', async () => {
      const order = await createOrder()

      expect(order).toMatchObject({
        number: expect.stringMatching(/^PED-\d{4}-0001$/),
        storeName: 'Tienda de pruebas',
        status: 'pending',
        notes: 'Dejar en la puerta de atrás',
        total: 6.05, // 3 × 1,45 + 2 × 0,85
        createdBy: { id: '64b7f0c2a1b2c3d4e5f60002', displayName: 'store' },
      })
      expect(order.lines).toEqual([
        {
          saleArticleId: articles.barra.id,
          code: '10001',
          name: 'Barra Rústica Tradicional',
          format: 'tray',
          unitsPerFormat: 12,
          unitPrice: 1.45,
          requestedQty: 3,
          confirmedQty: null,
          lotNumber: null,
          expiryDate: null,
        },
        expect.objectContaining({ saleArticleId: articles.croissant.id, requestedQty: 2 }),
      ])
      expect(order.statusHistory).toEqual([
        expect.objectContaining({ status: 'pending', userName: 'store', reason: null }),
      ])
    })

    it('numera los pedidos de forma correlativa', async () => {
      await createOrder()
      const second = await createOrder()
      expect(second.number).toMatch(/^PED-\d{4}-0002$/)
    })

    it('el pedido no cambia si después se modifica el artículo', async () => {
      const order = await createOrder()
      await asAdmin({
        method: 'PATCH',
        url: `/api/v1/sale-articles/${articles.barra.id}`,
        payload: { name: 'Barra nueva', price: 9.99 },
      })

      const stored = (await asStore({ url: `${baseUrl}/${order.id}` })).json<Order>()
      expect(stored.lines[0]).toMatchObject({ name: 'Barra Rústica Tradicional', unitPrice: 1.45 })
    })

    it.each([
      ['sin líneas', { lines: [] }],
      ['con cantidad 0', { lines: [{ saleArticleId: '64b7f0c2a1b2c3d4e5f6aaaa', quantity: 0 }] }],
      ['con notas demasiado largas', { notes: 'x'.repeat(501) }],
    ])('rechaza un pedido %s', async (_, overrides) => {
      const response = await asStore({
        method: 'POST',
        url: baseUrl,
        payload: orderInput(overrides as Partial<CreateOrderInput>),
      })
      expect(response.statusCode).toBe(400)
      expect(response.json<ApiErrorBody>().code).toBe('VALIDATION_ERROR')
    })

    it('rechaza artículos repetidos', async () => {
      const response = await asStore({
        method: 'POST',
        url: baseUrl,
        payload: orderInput({
          lines: [
            { saleArticleId: articles.barra.id, quantity: 1 },
            { saleArticleId: articles.barra.id, quantity: 2 },
          ],
        }),
      })
      expect(response.statusCode).toBe(400)
    })

    it('rechaza artículos inexistentes o desactivados', async () => {
      await asAdmin({
        method: 'PATCH',
        url: `/api/v1/sale-articles/${articles.croissant.id}`,
        payload: { active: false },
      })

      const response = await asStore({
        method: 'POST',
        url: baseUrl,
        payload: orderInput({
          lines: [
            { saleArticleId: '64b7f0c2a1b2c3d4e5f6aaaa', quantity: 1 },
            { saleArticleId: articles.croissant.id, quantity: 1 },
          ],
        }),
      })
      expect(response.statusCode).toBe(400)
      expect(response.json<ApiErrorBody>().details).toEqual([
        { path: '/lines/0/saleArticleId', message: 'El artículo no existe' },
        {
          path: '/lines/1/saleArticleId',
          message: '«Croissant Mantequilla» ya no está disponible',
        },
      ])
    })

    it('el obrador no puede hacer pedidos', async () => {
      const response = await asAdmin({ method: 'POST', url: baseUrl, payload: orderInput() })
      expect(response.statusCode).toBe(403)
    })
  })

  describe('consulta', () => {
    it('cada tienda solo ve sus pedidos y el obrador los ve todos', async () => {
      const own = await createOrder()
      await asOtherStore({ method: 'POST', url: baseUrl, payload: orderInput() })

      const storeList = (await asStore({ url: baseUrl })).json<Paginated<OrderSummary>>()
      expect(storeList.items.map((order) => order.id)).toEqual([own.id])
      expect(storeList.items[0]).toMatchObject({ lineCount: 2, totalQuantity: 5, total: 6.05 })

      const adminList = (await asAdmin({ url: baseUrl })).json<Paginated<OrderSummary>>()
      expect(adminList.total).toBe(2)

      expect((await asOtherStore({ url: `${baseUrl}/${own.id}` })).statusCode).toBe(404)
      expect((await asAdmin({ url: `${baseUrl}/${own.id}` })).statusCode).toBe(200)
    })

    it('una tienda sin tienda asignada no ve ningún pedido', async () => {
      const order = await createOrder()
      const token = ctx.app.signSessionToken({ ...otherStoreUser, storeName: null })
      const asStoreless = (options: InjectOptions) =>
        ctx.app.inject({ ...options, headers: { authorization: `Bearer ${token}` } })

      const list = (await asStoreless({ url: baseUrl })).json<Paginated<OrderSummary>>()
      expect(list.total).toBe(0)
      expect((await asStoreless({ url: `${baseUrl}/${order.id}` })).statusCode).toBe(404)
    })

    it('filtra por estado y busca por número o tienda', async () => {
      const first = await createOrder()
      await createOrder()
      await asAdmin({ method: 'POST', url: `${baseUrl}/${first.id}/approve`, payload: {} })

      const pending = (await asAdmin({ url: `${baseUrl}?status=pending` })).json<
        Paginated<OrderSummary>
      >()
      expect(pending.total).toBe(1)

      const byNumber = (await asAdmin({ url: `${baseUrl}?search=0001` })).json<
        Paginated<OrderSummary>
      >()
      expect(byNumber.items.map((order) => order.id)).toEqual([first.id])
    })

    it('filtra por varios estados a la vez', async () => {
      const approved = await createOrder()
      const rejected = await createOrder()
      await createOrder()
      await asAdmin({ method: 'POST', url: `${baseUrl}/${approved.id}/approve`, payload: {} })
      await asAdmin({
        method: 'POST',
        url: `${baseUrl}/${rejected.id}/reject`,
        payload: { reason: 'Sin existencias' },
      })

      const list = (await asAdmin({ url: `${baseUrl}?status=approved,rejected` })).json<
        Paginated<OrderSummary>
      >()
      expect(list.items.map((order) => order.status).sort()).toEqual(['approved', 'rejected'])

      const invalid = await asAdmin({ url: `${baseUrl}?status=pending,inventado` })
      expect(invalid.statusCode).toBe(400)
    })

    it('ordena por fecha de creación: por defecto los más nuevos primero', async () => {
      const first = await createOrder()
      const second = await createOrder()

      const ids = async (query: string) =>
        (await asAdmin({ url: `${baseUrl}${query}` }))
          .json<Paginated<OrderSummary>>()
          .items.map((order) => order.id)

      expect(await ids('')).toEqual([second.id, first.id])
      expect(await ids('?sort=createdAt')).toEqual([first.id, second.id])
    })

    it('el volumen cuenta las cantidades confirmadas tras aprobar', async () => {
      const order = await createOrder()
      await asAdmin({
        method: 'POST',
        url: `${baseUrl}/${order.id}/approve`,
        payload: {
          lines: [{ saleArticleId: articles.barra.id, confirmedQty: 1 }],
          reason: 'Rotura de stock',
        },
      })

      const [summary] = (await asAdmin({ url: baseUrl })).json<Paginated<OrderSummary>>().items
      expect(summary).toMatchObject({ lineCount: 2, totalQuantity: 3 })
    })
  })

  describe('validación del obrador', () => {
    it('aprueba con las cantidades pedidas', async () => {
      const order = await createOrder()

      const response = await asAdmin({
        method: 'POST',
        url: `${baseUrl}/${order.id}/approve`,
        payload: {},
      })
      expect(response.statusCode).toBe(200)
      const approved = response.json<Order>()
      expect(approved.status).toBe('approved')
      expect(approved.lines.map((line) => line.confirmedQty)).toEqual([3, 2])
      expect(approved.statusHistory.map((entry) => entry.status)).toEqual(['pending', 'approved'])
      expect(approved.statusHistory.at(-1)?.reason).toBeNull()
    })

    it('aprobar con otras cantidades deja el pedido modificado, con su motivo y el total recalculado', async () => {
      const order = await createOrder()

      const response = await asAdmin({
        method: 'POST',
        url: `${baseUrl}/${order.id}/approve`,
        payload: {
          lines: [{ saleArticleId: articles.croissant.id, confirmedQty: 0 }],
          reason: 'No quedan croissants',
        },
      })
      expect(response.statusCode).toBe(200)
      const modified = response.json<Order>()
      expect(modified.status).toBe('modified')
      expect(modified.lines.map((line) => line.confirmedQty)).toEqual([3, 0])
      expect(modified.total).toBe(4.35)
      expect(modified.statusHistory.at(-1)).toMatchObject({
        status: 'modified',
        reason: 'No quedan croissants',
      })
    })

    it('guarda el lote y la caducidad que indique el obrador, también en el albarán', async () => {
      const order = await createOrder()

      const response = await asAdmin({
        method: 'POST',
        url: `${baseUrl}/${order.id}/approve`,
        payload: {
          lines: [
            {
              saleArticleId: articles.barra.id,
              confirmedQty: 3,
              lotNumber: ' L-2410 ',
              expiryDate: '2026-11-03',
            },
            { saleArticleId: articles.croissant.id, confirmedQty: 2, lotNumber: '   ' },
          ],
        },
      })
      expect(response.statusCode).toBe(200)
      const approved = response.json<Order>()
      // Lote y caducidad no cuentan como cambios: sigue siendo una aprobación sin más.
      expect(approved.status).toBe('approved')
      expect(approved.lines.map(({ lotNumber, expiryDate }) => ({ lotNumber, expiryDate }))).toEqual([
        { lotNumber: 'L-2410', expiryDate: '2026-11-03' },
        { lotNumber: null, expiryDate: null },
      ])

      const deliveryNote = await DeliveryNoteModel.findOne({ orderId: order.id }).lean()
      expect(deliveryNote?.lines[0]).toMatchObject({ lotNumber: 'L-2410', expiryDate: '2026-11-03' })
    })

    it('lo que no se sirve no lleva lote ni caducidad', async () => {
      const order = await createOrder()
      const approved = (
        await asAdmin({
          method: 'POST',
          url: `${baseUrl}/${order.id}/approve`,
          payload: {
            lines: [
              {
                saleArticleId: articles.croissant.id,
                confirmedQty: 0,
                lotNumber: 'L-1',
                expiryDate: '2026-11-03',
              },
            ],
            reason: 'No quedan croissants',
          },
        })
      ).json<Order>()
      expect(approved.lines[1]).toMatchObject({ confirmedQty: 0, lotNumber: null, expiryDate: null })
    })

    it('rechaza una caducidad que no es una fecha', async () => {
      const order = await createOrder()
      const response = await asAdmin({
        method: 'POST',
        url: `${baseUrl}/${order.id}/approve`,
        payload: {
          lines: [{ saleArticleId: articles.barra.id, confirmedQty: 3, expiryDate: '2026-13-40' }],
        },
      })
      expect(response.statusCode).toBe(400)
    })

    it('aprobar con cambios exige motivo', async () => {
      const order = await createOrder()
      const url = `${baseUrl}/${order.id}/approve`
      const lines = [{ saleArticleId: articles.croissant.id, confirmedQty: 1 }]

      for (const payload of [{ lines }, { lines, reason: '   ' }]) {
        const response = await asAdmin({ method: 'POST', url, payload })
        expect(response.statusCode).toBe(400)
        expect(response.json<ApiErrorBody>().code).toBe('VALIDATION_ERROR')
      }

      const stored = (await asAdmin({ url: `${baseUrl}/${order.id}` })).json<Order>()
      expect(stored.status).toBe('pending')
    })

    it('no aprueba sin servir nada ni con líneas que no son del pedido', async () => {
      const order = await createOrder()

      const allZero = await asAdmin({
        method: 'POST',
        url: `${baseUrl}/${order.id}/approve`,
        payload: {
          lines: [
            { saleArticleId: articles.barra.id, confirmedQty: 0 },
            { saleArticleId: articles.croissant.id, confirmedQty: 0 },
          ],
        },
      })
      expect(allZero.statusCode).toBe(400)

      const unknown = await asAdmin({
        method: 'POST',
        url: `${baseUrl}/${order.id}/approve`,
        payload: { lines: [{ saleArticleId: '64b7f0c2a1b2c3d4e5f6aaaa', confirmedQty: 1 }] },
      })
      expect(unknown.statusCode).toBe(400)
    })

    it('rechaza con motivo obligatorio', async () => {
      const order = await createOrder()
      const url = `${baseUrl}/${order.id}/reject`

      expect((await asAdmin({ method: 'POST', url, payload: { reason: '  ' } })).statusCode).toBe(
        400,
      )

      const response = await asAdmin({
        method: 'POST',
        url,
        payload: { reason: 'Sin harina de centeno' },
      })
      expect(response.statusCode).toBe(200)
      const rejected = response.json<Order>()
      expect(rejected.status).toBe('rejected')
      expect(rejected.statusHistory.at(-1)).toMatchObject({
        status: 'rejected',
        reason: 'Sin harina de centeno',
        userName: 'kitchen_admin',
      })
    })

    it('un pedido ya tramitado no se puede volver a validar ni cancelar', async () => {
      const order = await createOrder()
      await asAdmin({ method: 'POST', url: `${baseUrl}/${order.id}/approve`, payload: {} })

      for (const response of [
        await asAdmin({ method: 'POST', url: `${baseUrl}/${order.id}/approve`, payload: {} }),
        await asAdmin({
          method: 'POST',
          url: `${baseUrl}/${order.id}/reject`,
          payload: { reason: 'Tarde' },
        }),
        await asStore({ method: 'POST', url: `${baseUrl}/${order.id}/cancel` }),
      ]) {
        expect(response.statusCode).toBe(409)
        expect(response.json<ApiErrorBody>().code).toBe('INVALID_STATE')
      }
    })

    it('la tienda no puede validar pedidos', async () => {
      const order = await createOrder()
      const response = await asStore({
        method: 'POST',
        url: `${baseUrl}/${order.id}/approve`,
        payload: {},
      })
      expect(response.statusCode).toBe(403)
    })
  })

  describe('cancelación', () => {
    it('la tienda cancela su pedido pendiente', async () => {
      const order = await createOrder()

      const response = await asStore({ method: 'POST', url: `${baseUrl}/${order.id}/cancel` })
      expect(response.statusCode).toBe(200)
      expect(response.json<Order>().status).toBe('cancelled')
    })

    it('otra tienda no puede cancelarlo', async () => {
      const order = await createOrder()
      const response = await asOtherStore({ method: 'POST', url: `${baseUrl}/${order.id}/cancel` })
      expect(response.statusCode).toBe(404)
    })
  })

  it('no se puede borrar un artículo que ya se ha pedido', async () => {
    await createOrder()

    const response = await asAdmin({
      method: 'DELETE',
      url: `/api/v1/sale-articles/${articles.barra.id}`,
    })
    expect(response.statusCode).toBe(409)
    expect(response.json<ApiErrorBody>().code).toBe('CONFLICT')
  })
})
