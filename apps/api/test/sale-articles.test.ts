import type {
  ApiErrorBody,
  CreateSaleArticleInput,
  Paginated,
  SaleArticle,
} from '@cocina-central/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { clearDatabase, createTestApp, type TestContext } from './helpers/test-app'

const baseUrl = '/api/v1/sale-articles'

const barra: CreateSaleArticleInput = {
  code: 'BAR-001',
  name: 'Barra Rústica Tradicional',
  format: 'tray',
  unitsPerFormat: 12,
  price: 1.45,
}

describe('API /sale-articles', () => {
  let ctx: TestContext

  beforeAll(async () => {
    ctx = await createTestApp()
  })
  afterAll(async () => {
    await ctx.close()
  })
  beforeEach(async () => {
    await clearDatabase()
  })

  const create = (payload: CreateSaleArticleInput) =>
    ctx.app.inject({ method: 'POST', url: baseUrl, payload })

  it('crea un artículo aplicando los valores por defecto', async () => {
    const response = await create(barra)

    expect(response.statusCode).toBe(201)
    const article = response.json<SaleArticle>()
    expect(article).toMatchObject({
      ...barra,
      active: true,
      imageUrl: null,
      amoenusSaleItemId: null,
    })
    expect(article.id).toMatch(/^[a-f\d]{24}$/)
  })

  it('rechaza un cuerpo no válido con VALIDATION_ERROR', async () => {
    const response = await create({ ...barra, code: '', unitsPerFormat: 0 })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiErrorBody>()
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/code' }),
        expect.objectContaining({ path: '/unitsPerFormat' }),
      ]),
    )
  })

  it('no permite códigos duplicados', async () => {
    await create(barra)
    const response = await create({ ...barra, name: 'Otra barra' })

    expect(response.statusCode).toBe(409)
    expect(response.json<ApiErrorBody>().code).toBe('CONFLICT')
  })

  it('lista con paginación, búsqueda y filtro por activo', async () => {
    await create(barra)
    await create({
      code: 'CRO-001',
      name: 'Croissant Mantequilla',
      format: 'box',
      unitsPerFormat: 30,
      price: 0.9,
    })
    await create({
      code: 'HOG-001',
      name: 'Hogaza Centeno',
      format: 'tray',
      unitsPerFormat: 12,
      price: 2.1,
      active: false,
    })

    const all = await ctx.app.inject({ url: `${baseUrl}?pageSize=2` })
    expect(all.json<Paginated<SaleArticle>>()).toMatchObject({ total: 3, page: 1, pageSize: 2 })
    expect(all.json<Paginated<SaleArticle>>().items).toHaveLength(2)

    const search = await ctx.app.inject({ url: `${baseUrl}?search=croiss` })
    expect(search.json<Paginated<SaleArticle>>().items.map((a) => a.code)).toEqual(['CRO-001'])

    const active = await ctx.app.inject({ url: `${baseUrl}?active=true` })
    expect(active.json<Paginated<SaleArticle>>().total).toBe(2)
  })

  it('actualiza parcialmente sin tocar los campos no enviados', async () => {
    const created = (await create({ ...barra, active: false })).json<SaleArticle>()

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `${baseUrl}/${created.id}`,
      payload: { price: 1.555 },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json<SaleArticle>()).toMatchObject({
      price: 1.56,
      active: false,
      name: barra.name,
    })
  })

  it('devuelve 404 al consultar o borrar un artículo inexistente', async () => {
    const missingId = '64b7f0c2a1b2c3d4e5f60718'

    expect((await ctx.app.inject({ url: `${baseUrl}/${missingId}` })).statusCode).toBe(404)
    expect(
      (await ctx.app.inject({ method: 'DELETE', url: `${baseUrl}/${missingId}` })).statusCode,
    ).toBe(404)
  })

  it('elimina un artículo', async () => {
    const created = (await create(barra)).json<SaleArticle>()

    const response = await ctx.app.inject({ method: 'DELETE', url: `${baseUrl}/${created.id}` })

    expect(response.statusCode).toBe(204)
    expect((await ctx.app.inject({ url: `${baseUrl}/${created.id}` })).statusCode).toBe(404)
  })

  it('genera la especificación OpenAPI', async () => {
    const response = await ctx.app.inject({ url: '/docs/json' })

    expect(response.statusCode).toBe(200)
    expect(Object.keys(response.json<{ paths: object }>().paths)).toContain(
      '/api/v1/sale-articles/',
    )
  })
})
