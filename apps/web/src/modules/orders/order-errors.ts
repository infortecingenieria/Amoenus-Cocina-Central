import { toast } from 'vue-sonner'

import { ApiError, getErrorMessage } from '@/lib/api-client'

/** Mensajes de detalle de un error de validación de la API (`details: [{ path, message }]`). */
const detailMessages = (error: unknown): string[] => {
  if (!(error instanceof ApiError) || !Array.isArray(error.body?.details)) return []
  return error.body.details
    .map((detail: unknown) =>
      typeof detail === 'object' && detail !== null && 'message' in detail
        ? String(detail.message)
        : '',
    )
    .filter(Boolean)
}

/**
 * Muestra un error al enviar o tramitar un pedido. Los de validación incluyen el detalle (p. ej.
 * qué artículo ya no está disponible).
 */
export function showOrderError(error: unknown): void {
  const details = [...new Set(detailMessages(error))]
  toast.error(getErrorMessage(error), details.length ? { description: details.join(' · ') } : {})
}
