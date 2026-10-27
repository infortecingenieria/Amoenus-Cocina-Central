import {
  INTEGRATION_API_KEY_HEADER,
  type AmoenusDeliveryNotePayload,
  type AmoenusRejectionPayload,
  type AmoenusStoreOrderPayload,
} from '@cocina-central/shared'

/** Lo que Cocina Central comunica a Amoenus. Se inyecta para poder sustituirlo en los tests. */
export interface AmoenusClient {
  sendDeliveryNote(payload: AmoenusDeliveryNotePayload): Promise<void>
  sendRejection(payload: AmoenusRejectionPayload): Promise<void>
  sendStoreOrder(payload: AmoenusStoreOrderPayload): Promise<void>
}

export interface HttpAmoenusClientOptions {
  /** URL del gateway de Amoenus, con `/api` («https://…/api»). null = no configurado. */
  baseUrl: string | null
  apiKey: string | null
  timeoutMs?: number
}

/** Cuerpo de error del gateway de Amoenus: `{ success: false, message }`. */
interface AmoenusResponseBody {
  success?: unknown
  message?: unknown
}

const errorMessage = (body: AmoenusResponseBody | null, status: number): string =>
  typeof body?.message === 'string' && body.message
    ? body.message
    : `Amoenus ha respondido ${status}`

const readErrorMessage = async (response: Response): Promise<string> =>
  errorMessage(
    (await response.json().catch(() => null)) as AmoenusResponseBody | null,
    response.status,
  )

/**
 * Envía a Amoenus por HTTP, con la misma clave de API que Amoenus usa para mandar pedidos
 * (`AMOENUS_API_KEY`). Cualquier respuesta que no sea 2xx (o `success: false`) es un error.
 */
export class HttpAmoenusClient implements AmoenusClient {
  private readonly baseUrl: string | null
  private readonly apiKey: string | null
  private readonly timeoutMs: number

  constructor({ baseUrl, apiKey, timeoutMs = 5000 }: HttpAmoenusClientOptions) {
    this.baseUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : null
    this.apiKey = apiKey
    this.timeoutMs = timeoutMs
  }

  sendDeliveryNote(payload: AmoenusDeliveryNotePayload): Promise<void> {
    return this.post('/warehouses/cocina-central/delivery-notes', payload)
  }

  sendRejection(payload: AmoenusRejectionPayload): Promise<void> {
    return this.post('/warehouses/cocina-central/rejections', payload)
  }

  sendStoreOrder(payload: AmoenusStoreOrderPayload): Promise<void> {
    return this.post('/warehouses/cocina-central/orders', payload)
  }

  private async post(path: string, payload: unknown): Promise<void> {
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('La integración con Amoenus no está configurada (AMOENUS_API_URL)')
    }

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [INTEGRATION_API_KEY_HEADER]: this.apiKey },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError'
      throw new Error(timedOut ? 'Amoenus no responde' : 'Amoenus no está disponible', {
        cause: error,
      })
    }

    if (!response.ok) throw new Error(await readErrorMessage(response))
    const body = (await response.json().catch(() => null)) as AmoenusResponseBody | null
    if (body?.success === false) throw new Error(errorMessage(body, response.status))
  }
}
