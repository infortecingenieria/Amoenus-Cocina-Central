import type { ApiErrorBody, Family, Paginated } from '@cocina-central/shared'
import type { InjectOptions } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { clearDatabase, createTestApp, type TestContext } from './helpers/test-app'

const baseUrl = '/api/v1/families'

describe('API /families', () => {
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

  // Peticiones como administrador del obrador (los permisos se prueban en auth.test.ts).
  const inject = (options: InjectOptions) =>
    ctx.app.inject({ ...options, headers: { ...ctx.authHeaders(), ...options.headers } })

  const create = (name: string) =>
    inject({ method: 'POST', url: baseUrl, payload: { name } })

  it('crea una familia', async () => {
    const response = await create('  Bollería  ')

    expect(response.statusCode).toBe(201)
    const family = response.json<Family>()
    expect(family.name).toBe('Bollería')
    expect(family.id).toMatch(/^[a-f\d]{24}$/)
  })

  it('rechaza un nombre vacío con VALIDATION_ERROR', async () => {
    const response = await create('   ')

    expect(response.statusCode).toBe(400)
    expect(response.json<ApiErrorBody>().code).toBe('VALIDATION_ERROR')
  })

  it('no permite nombres repetidos aunque cambien mayúsculas o tildes', async () => {
    await create('Bollería')

    for (const name of ['bollería', 'BOLLERIA']) {
      const response = await create(name)
      expect(response.statusCode).toBe(409)
      expect(response.json<ApiErrorBody>().code).toBe('CONFLICT')
    }
  })

  it('lista ordenada por nombre, con paginación y búsqueda', async () => {
    await create('Salados')
    await create('Bollería')
    await create('Panadería')

    const all = await inject({ url: `${baseUrl}?pageSize=2` })
    expect(all.json<Paginated<Family>>()).toMatchObject({ total: 3, page: 1, pageSize: 2 })
    expect(all.json<Paginated<Family>>().items.map((f) => f.name)).toEqual([
      'Bollería',
      'Panadería',
    ])

    const search = await inject({ url: `${baseUrl}?search=sal` })
    expect(search.json<Paginated<Family>>().items.map((f) => f.name)).toEqual(['Salados'])
  })

  it('renombra una familia y permite mantener el mismo nombre', async () => {
    const created = (await create('Boleria')).json<Family>()
    const rename = (name: string) =>
      inject({ method: 'PATCH', url: `${baseUrl}/${created.id}`, payload: { name } })

    expect((await rename('Bollería')).json<Family>().name).toBe('Bollería')
    expect((await rename('Bollería')).statusCode).toBe(200)

    await create('Salados')
    expect((await rename('salados')).statusCode).toBe(409)
  })

  it('devuelve 404 con una familia inexistente', async () => {
    const missingId = '64b7f0c2a1b2c3d4e5f60718'

    expect((await inject({ url: `${baseUrl}/${missingId}` })).statusCode).toBe(404)
    expect(
      (await inject({ method: 'DELETE', url: `${baseUrl}/${missingId}` })).statusCode,
    ).toBe(404)
  })

  it('elimina una familia sin artículos', async () => {
    const created = (await create('Salados')).json<Family>()

    const response = await inject({ method: 'DELETE', url: `${baseUrl}/${created.id}` })

    expect(response.statusCode).toBe(204)
    expect((await inject({ url: `${baseUrl}/${created.id}` })).statusCode).toBe(404)
  })

  it('no elimina una familia con artículos asignados', async () => {
    const family = (await create('Bollería')).json<Family>()
    await inject({
      method: 'POST',
      url: '/api/v1/sale-articles',
      payload: {
        code: '20001',
        name: 'Croissant Mantequilla',
        format: 'box',
        unitsPerFormat: 30,
        price: 0.85,
        familyId: family.id,
      },
    })

    const response = await inject({ method: 'DELETE', url: `${baseUrl}/${family.id}` })

    expect(response.statusCode).toBe(409)
    expect(response.json<ApiErrorBody>()).toMatchObject({
      code: 'CONFLICT',
      message: 'No se puede eliminar: la familia tiene 1 artículo asignado',
    })
  })

  it('aparece en la especificación OpenAPI', async () => {
    const response = await inject({ url: '/docs/json' })

    expect(Object.keys(response.json<{ paths: object }>().paths)).toContain('/api/v1/families/')
  })
})
