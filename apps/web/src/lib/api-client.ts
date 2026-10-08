import type { ApiErrorBody } from '@cocina-central/shared'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

/** Error HTTP de la API. `body` sigue el contrato `ApiErrorBody` cuando la API lo devuelve. */
export class ApiError extends Error {
  readonly status: number
  readonly body: ApiErrorBody | null

  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.message ?? `Error ${status} al llamar a la API`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>

interface RequestOptions {
  query?: QueryParams
  body?: unknown
  signal?: AbortSignal
}

interface ApiClientConfig {
  /** Token de sesión a enviar en `Authorization`, o null si no hay sesión. */
  getToken: () => string | null
  /** Se llama cuando la API responde 401 (sesión caducada o no válida). */
  onUnauthorized: () => void
}

/** Rutas cuyo 401 es un resultado normal (credenciales incorrectas), no una sesión caducada. */
const AUTH_LOGIN_PATH = '/auth/login'

let config: ApiClientConfig = { getToken: () => null, onUnauthorized: () => {} }

/** Conecta el cliente con la sesión. Se hace en `main.ts` para no importar aquí el store. */
export function configureApiClient(next: ApiClientConfig): void {
  config = next
}

export function buildUrl(path: string, query: QueryParams = {}): string {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin)
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '')
      url.searchParams.set(key, String(value))
  }
  return url.toString()
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const hasBody = options.body !== undefined
  const token = config.getToken()
  const headers: Record<string, string> = {}
  if (hasBody) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(buildUrl(path, options.query), {
    method,
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null
    if (response.status === 401 && path !== AUTH_LOGIN_PATH) config.onUnauthorized()
    throw new ApiError(response.status, body)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('GET', path, options),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, { body }),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, { body }),
  delete: (path: string) => request<void>('DELETE', path),
}

/** Mensaje de error apto para mostrar al usuario. */
export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Se ha producido un error inesperado'
