import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiClient, buildUrl } from '../api-client'

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('api-client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('construye la URL omitiendo los parámetros vacíos', () => {
    const url = new URL(
      buildUrl('/sale-articles', { page: 2, search: '', active: false, other: undefined }),
    )

    expect(url.pathname).toBe('/api/v1/sale-articles')
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '2', active: 'false' })
  })

  it('envía JSON y devuelve el cuerpo de la respuesta', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(201, { id: '1' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiClient.post('/sale-articles', { code: 'A' })).resolves.toEqual({ id: '1' })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/sale-articles'),
      expect.objectContaining({ method: 'POST', body: '{"code":"A"}' }),
    )
  })

  it('lanza ApiError con el cuerpo de error de la API', async () => {
    const body = {
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Ya existe un artículo con el código A',
    }
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(409, body)))

    const error = await apiClient.get('/sale-articles/1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, body, message: body.message })
  })

  it('resuelve sin cuerpo en las respuestas 204', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })),
    )

    await expect(apiClient.delete('/sale-articles/1')).resolves.toBeUndefined()
  })
})
