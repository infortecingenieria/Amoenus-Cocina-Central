import { describe, expect, it } from 'vitest'

import { getTokenExpiry } from '../jwt'

// Codifica como un JWT real: JSON en UTF-8 y base64url sin relleno.
const base64Url = (value: unknown) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const fakeToken = (payload: Record<string, unknown>) =>
  `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url(payload)}.firma`

describe('getTokenExpiry', () => {
  it('devuelve la caducidad del token en milisegundos', () => {
    expect(getTokenExpiry(fakeToken({ sub: '1', exp: 1_800_000_000 }))).toBe(1_800_000_000_000)
  })

  it('lee payloads en base64url con caracteres especiales', () => {
    expect(getTokenExpiry(fakeToken({ displayName: 'Ñoño ¿?>>', exp: 1_800_000_000 }))).toBe(
      1_800_000_000_000,
    )
  })

  it('devuelve null si no hay token, está mal formado o no lleva exp', () => {
    expect(getTokenExpiry(null)).toBeNull()
    expect(getTokenExpiry('')).toBeNull()
    expect(getTokenExpiry('no-es-un-jwt')).toBeNull()
    expect(getTokenExpiry('a.%%%.c')).toBeNull()
    expect(getTokenExpiry(fakeToken({ sub: '1' }))).toBeNull()
    expect(getTokenExpiry(fakeToken({ exp: 'mañana' }))).toBeNull()
  })
})
