import type { ApiErrorBody, AuthUser, LoginResponse } from '@cocina-central/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { hashPassword } from '../src/modules/auth/password'
import { UserRepository } from '../src/modules/auth/user.repository'
import { clearDatabase, createTestApp, type TestContext } from './helpers/test-app'

const PASSWORD = 'contraseña-de-pruebas'

describe('API /auth y permisos', () => {
  let ctx: TestContext
  const users = new UserRepository()

  beforeAll(async () => {
    ctx = await createTestApp()
  })
  afterAll(async () => {
    await ctx.close()
  })
  beforeEach(async () => {
    await clearDatabase()
    await users.upsertByUsername({
      username: 'admin',
      passwordHash: await hashPassword(PASSWORD),
      displayName: 'Admin',
      role: 'kitchen_admin',
      storeName: null,
    })
  })

  const login = (username: string, password: string) =>
    ctx.app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username, password } })

  it('inicia sesión y devuelve el token y el usuario, sin la contraseña', async () => {
    const response = await login('  ADMIN ', PASSWORD)

    expect(response.statusCode).toBe(200)
    const body = response.json<LoginResponse>()
    expect(body.user).toEqual({
      id: expect.stringMatching(/^[a-f\d]{24}$/),
      username: 'admin',
      displayName: 'Admin',
      role: 'kitchen_admin',
      storeName: null,
    })
    expect(body.token).toEqual(expect.any(String))
    expect(JSON.stringify(body)).not.toContain('passwordHash')
  })

  it('responde igual con contraseña incorrecta, usuario inexistente o usuario inactivo', async () => {
    await users.upsertByUsername({
      username: 'baja',
      passwordHash: await hashPassword(PASSWORD),
      displayName: 'De baja',
      role: 'store',
      storeName: 'Tienda cerrada',
      active: false,
    })

    for (const [username, password] of [
      ['admin', 'otra'],
      ['nadie', PASSWORD],
      ['baja', PASSWORD],
    ] as const) {
      const response = await login(username, password)
      expect(response.statusCode, username).toBe(401)
      expect(response.json<ApiErrorBody>()).toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Usuario o contraseña incorrectos',
      })
    }
  })

  it('devuelve el usuario de la sesión con el token del login', async () => {
    const { token, user } = (await login('admin', PASSWORD)).json<LoginResponse>()

    const response = await ctx.app.inject({
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json<AuthUser>()).toEqual(user)
  })

  it('rechaza peticiones sin token o con un token manipulado', async () => {
    const { token } = (await login('admin', PASSWORD)).json<LoginResponse>()
    const tampered = `${token.slice(0, -2)}xx`

    for (const headers of [{}, { authorization: `Bearer ${tampered}` }]) {
      for (const url of ['/api/v1/auth/me', '/api/v1/sale-articles', '/api/v1/families']) {
        const response = await ctx.app.inject({ url, headers })
        expect(response.statusCode, url).toBe(401)
        expect(response.json<ApiErrorBody>().code).toBe('UNAUTHORIZED')
      }
    }
  })

  it('deja consultar a las tiendas pero no modificar artículos ni familias', async () => {
    const headers = ctx.authHeaders('store')

    for (const url of ['/api/v1/sale-articles', '/api/v1/families']) {
      expect((await ctx.app.inject({ url, headers })).statusCode, url).toBe(200)
    }

    const forbidden = [
      {
        url: '/api/v1/sale-articles',
        payload: { code: '10001', name: 'Barra', format: 'tray', unitsPerFormat: 12, price: 1 },
      },
      { url: '/api/v1/families', payload: { name: 'Bollería' } },
    ]
    for (const { url, payload } of forbidden) {
      const response = await ctx.app.inject({ method: 'POST', url, payload, headers })
      expect(response.statusCode, url).toBe(403)
      expect(response.json<ApiErrorBody>().code).toBe('FORBIDDEN')
    }
  })

  it('mantiene /health público', async () => {
    expect((await ctx.app.inject({ url: '/health' })).statusCode).toBe(200)
  })
})
