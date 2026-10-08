import type {
  ApiErrorBody,
  CreateSaleArticleInput,
  Family,
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

  const createFamily = async (name: string) =>
    (
      await ctx.app.inject({ method: 'POST', url: '/api/v1/families', payload: { name } })
    ).json<Family>()

  it('crea un artículo aplicando los valores por defecto', async () => {
    const response = await create(barra)

    expect(response.statusCode).toBe(201)
    const article = response.json<SaleArticle>()
    expect(article).toMatchObject({
      ...barra,
      active: true,
      familyId: null,
      familyName: null,
      imageUrl: null,
      amoenusSaleItemId: null,
    })
    expect(article.id).toMatch(/^[a-f\d]{24}$/)
  })

  it('devuelve el nombre de la familia asignada', async () => {
    const panaderia = await createFamily('Panadería')

    const created = await create({ ...barra, familyId: panaderia.id })
    expect(created.statusCode).toBe(201)
    expect(created.json<SaleArticle>()).toMatchObject({
      familyId: panaderia.id,
      familyName: 'Panadería',
    })

    const fetched = await ctx.app.inject({ url: `${baseUrl}/${created.json<SaleArticle>().id}` })
    expect(fetched.json<SaleArticle>().familyName).toBe('Panadería')
  })

  it('rechaza una familia inexistente con VALIDATION_ERROR', async () => {
    const response = await create({ ...barra, familyId: '64b7f0c2a1b2c3d4e5f60718' })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiErrorBody>()
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(body.details).toEqual([expect.objectContaining({ path: '/familyId' })])
  })

  it('permite cambiar y quitar la familia de un artículo', async () => {
    const panaderia = await createFamily('Panadería')
    const bolleria = await createFamily('Bollería')
    const created = (await create({ ...barra, familyId: panaderia.id })).json<SaleArticle>()
    const patch = (payload: object) =>
      ctx.app.inject({ method: 'PATCH', url: `${baseUrl}/${created.id}`, payload })

    expect((await patch({ familyId: bolleria.id })).json<SaleArticle>()).toMatchObject({
      familyId: bolleria.id,
      familyName: 'Bollería',
    })
    expect((await patch({ familyId: null })).json<SaleArticle>()).toMatchObject({
      familyId: null,
      familyName: null,
    })
  })

  it('filtra por familia y por artículos sin familia', async () => {
    const panaderia = await createFamily('Panadería')
    await create({ ...barra, familyId: panaderia.id })
    await create({ ...barra, code: 'HOG-001', name: 'Hogaza Centeno', familyId: panaderia.id })
    await create({
      code: 'CRO-001',
      name: 'Croissant Mantequilla',
      format: 'box',
      unitsPerFormat: 30,
      price: 0.9,
    })

    const byFamily = await ctx.app.inject({ url: `${baseUrl}?familyId=${panaderia.id}` })
    expect(byFamily.json<Paginated<SaleArticle>>().items.map((a) => a.code)).toEqual([
      'BAR-001',
      'HOG-001',
    ])

    const withoutFamily = await ctx.app.inject({ url: `${baseUrl}?familyId=none` })
    expect(withoutFamily.json<Paginated<SaleArticle>>().items.map((a) => a.code)).toEqual([
      'CRO-001',
    ])

    const invalid = await ctx.app.inject({ url: `${baseUrl}?familyId=otra` })
    expect(invalid.statusCode).toBe(400)
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
