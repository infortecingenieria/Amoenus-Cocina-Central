import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionStore } from '../session'

const base64Url = (value: unknown) =>
  btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const tokenExpiringAt = (date: Date) =>
  `${base64Url({ alg: 'HS256' })}.${base64Url({ sub: '1', exp: date.getTime() / 1000 })}.firma`

const NOW = new Date('2026-11-11T10:00:00.000Z')

describe('sesión: caducidad del token', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('no está caducada mientras no llega el exp del token', () => {
    const session = useSessionStore()
    session.token = tokenExpiringAt(new Date('2026-11-11T22:00:00.000Z'))

    expect(session.expiresAt).toBe(new Date('2026-11-11T22:00:00.000Z').getTime())
    expect(session.isExpired()).toBe(false)
  })

  it('está caducada al llegar el exp del token', () => {
    const session = useSessionStore()
    session.token = tokenExpiringAt(new Date('2026-11-11T10:30:00.000Z'))

    vi.setSystemTime(new Date('2026-11-11T10:30:00.000Z'))

    expect(session.isExpired()).toBe(true)
  })

  it('trata como caducado un token ilegible o ausente', () => {
    const session = useSessionStore()
    expect(session.isExpired()).toBe(true)

    session.token = 'no-es-un-jwt'
    expect(session.expiresAt).toBeNull()
    expect(session.isExpired()).toBe(true)
  })
})
