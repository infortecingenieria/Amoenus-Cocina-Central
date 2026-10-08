import { z } from 'zod'

/** Códigos de error estables que el front puede interpretar sin depender del mensaje. */
export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'INVALID_STATE',
  'INTERNAL_ERROR',
] as const
export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

/** Cuerpo de cualquier respuesta de error de la API. */
export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  code: z.enum(API_ERROR_CODES),
  message: z.string(),
  details: z.unknown().optional(),
})
export type ApiErrorBody = z.infer<typeof apiErrorSchema>
