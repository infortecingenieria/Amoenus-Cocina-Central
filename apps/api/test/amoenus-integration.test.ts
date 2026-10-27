import type {
  AmoenusOrderInput,
  ApiErrorBody,
  CreateSaleArticleInput,
  Order,
  SaleArticle,
} from '@cocina-central/shared'
import type { InjectOptions } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  clearDatabase,
  createTestApp,
  TEST_AMOENUS_API_KEY,
  type TestContext,
} from './helpers/test-app'

const baseUrl = '/api/v1/integrations/amoenus/orders'

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

const amoenusOrder = (overrides: Partial<AmoenusOrderInput> = {}): AmoenusOrderInput => ({
  externalOrderId: '6ad900000000000000000001',
  clientId: '6ad0e888633d003bc06d96e2',
  localId: '6ad2118ea308181751f12e16',
  localName: 'La Empanadera Gran Via',
  createdByName: 'amoenuslaempanadera',
  notes: 'Entregar antes de las 9',
  lines: [
    { code: '10001', quantity: 3 },
    { code: '20001', quantity: 2 },
  ],
  ...overrides,
})

describe('API /integrations/amoenus', () => {
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

  const send = (payload: AmoenusOrderInput, apiKey: string | null = TEST_AMOENUS_API_KEY) =>
    ctx.app.inject({
      method: 'POST',
      url: baseUrl,
      payload,
      headers: apiKey === null ? {} : { 'x-api-key': apiKey },
    })

  async function createArticle(input: CreateSaleArticleInput) {
    return (
      await asAdmin({ method: 'POST', url: '/api/v1/sale-articles', payload: input })
    ).json<SaleArticle>()
  }

  describe('autenticación', () => {
    it.each([
      ['sin clave', null],
      ['con una clave incorrecta', 'clave-incorrecta'],
    ])('rechaza la petición %s', async (_, apiKey) => {
      const response = await send(amoenusOrder(), apiKey)
      expect(response.statusCode).toBe(401)
      expect(response.json<ApiErrorBody>().code).toBe('UNAUTHORIZED')
    })

    it('no acepta el token de sesión de un usuario en lugar de la clave', async () => {
      const response = await ctx.app.inject({
        method: 'POST',
        url: baseUrl,
        payload: amoenusOrder(),
        headers: ctx.authHeaders('store'),
      })
      expect(response.statusCode).toBe(401)
    })
  })

  describe('alta', () => {
    it('crea la solicitud pendiente de la tienda con los artículos del catálogo', async () => {
      const response = await send(amoenusOrder())
      expect(response.statusCode).toBe(201)

      const order = response.json<Order>()
      expect(order).toMatchObject({
        number: expect.stringMatching(/^PED-\d{4}-0001$/),
        storeName: 'La Empanadera Gran Via',
        status: 'pending',
        notes: 'Entregar antes de las 9',
        total: 6.05, // 3 × 1,45 + 2 × 0,85
        amoenus: {
          origin: 'amoenus_order',
          externalOrderId: '6ad900000000000000000001',
          clientId: '6ad0e888633d003bc06d96e2',
          localId: '6ad2118ea308181751f12e16',
          sync: null,
        },
        createdBy: { displayName: 'amoenuslaempanadera (Amoenus)' },
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
        },
        expect.objectContaining({ saleArticleId: articles.croissant.id, requestedQty: 2 }),
      ])
      expect(order.statusHistory).toEqual([
        expect.objectContaining({ status: 'pending', userName: 'amoenuslaempanadera (Amoenus)' }),
      ])

      // El obrador la ve en sus solicitudes como cualquier otra.
      const stored = await asAdmin({ url: `/api/v1/orders/${order.id}` })
      expect(stored.json<Order>().amoenus?.origin).toBe('amoenus_order')
    })

    it('comparte la numeración con los pedidos hechos desde la aplicación', async () => {
      await send(amoenusOrder())
      const second = await send(amoenusOrder({ externalOrderId: '6ad900000000000000000002' }))
      expect(second.json<Order>().number).toMatch(/^PED-\d{4}-0002$/)
    })

    it('un reenvío del mismo pedido devuelve el que ya existe sin duplicarlo', async () => {
      const first = (await send(amoenusOrder())).json<Order>()

      const again = await send(amoenusOrder())
      expect(again.statusCode).toBe(200)
      expect(again.json<Order>().id).toBe(first.id)

      const list = await asAdmin({ url: '/api/v1/orders' })
      expect(list.json<{ total: number }>().total).toBe(1)
    })

    it('rechaza códigos que no existen en Cocina Central', async () => {
      const response = await send(
        amoenusOrder({
          lines: [
            { code: '10001', quantity: 1 },
            { code: '99999', quantity: 1 },
          ],
        }),
      )
      expect(response.statusCode).toBe(400)
      expect(response.json<ApiErrorBody>().details).toEqual([
        { path: '/lines/1/code', message: 'No hay ningún artículo con el código 99999' },
      ])
    })

    it('rechaza artículos desactivados', async () => {
      await asAdmin({
        method: 'PATCH',
        url: `/api/v1/sale-articles/${articles.croissant.id}`,
        payload: { active: false },
      })

      const response = await send(amoenusOrder())
      expect(response.statusCode).toBe(400)
      expect(response.json<ApiErrorBody>().code).toBe('VALIDATION_ERROR')
    })

    it.each([
      ['sin líneas', { lines: [] }],
      ['con cantidades decimales', { lines: [{ code: '10001', quantity: 1.5 }] }],
      ['con un código que no es de 5 dígitos', { lines: [{ code: '123', quantity: 1 }] }],
      [
        'con artículos repetidos',
        {
          lines: [
            { code: '10001', quantity: 1 },
            { code: '10001', quantity: 2 },
          ],
        },
      ],
      ['sin local', { localName: '' }],
    ])('rechaza un pedido %s', async (_, overrides) => {
      const response = await send(amoenusOrder(overrides as Partial<AmoenusOrderInput>))
      expect(response.statusCode).toBe(400)
      expect(response.json<ApiErrorBody>().code).toBe('VALIDATION_ERROR')
    })

    it('la tienda del local ve la solicitud pero no puede cancelarla', async () => {
      const order = (await send(amoenusOrder())).json<Order>()
      const token = ctx.app.signSessionToken({
        id: '64b7f0c2a1b2c3d4e5f60003',
        username: 'granvia',
        displayName: 'Gran Vía',
        role: 'store',
        storeName: 'La Empanadera Gran Via',
      })
      const headers = { authorization: `Bearer ${token}` }
      const url = `/api/v1/orders/${order.id}`

      expect((await ctx.app.inject({ url, headers })).statusCode).toBe(200)
      const response = await ctx.app.inject({ method: 'POST', url: `${url}/cancel`, headers })
      expect(response.statusCode).toBe(409)
      expect(response.json<ApiErrorBody>().code).toBe('INVALID_STATE')

      const stored = await asAdmin({ url })
      expect(stored.json<Order>().status).toBe('pending')
    })

    it('el usuario técnico de Amoenus no puede iniciar sesión', async () => {
      await send(amoenusOrder())
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: 'amoenus', password: 'cualquiera' },
      })
      expect(response.statusCode).toBe(401)
    })
  })
})
