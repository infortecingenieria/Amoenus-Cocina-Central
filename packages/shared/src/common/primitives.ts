import { z } from 'zod'

/** Identificador de documento de MongoDB serializado como string hexadecimal. */
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador no válido')

/** Fechas en las respuestas de la API: siempre ISO 8601 en UTC. */
export const isoDateTimeSchema = z.iso.datetime()

/** Parámetro de ruta `/:id`. */
export const idParamsSchema = z.object({ id: objectIdSchema })
export type IdParams = z.infer<typeof idParamsSchema>
