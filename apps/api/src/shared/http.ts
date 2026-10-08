import type {
  ContextConfigDefault,
  FastifyReply,
  FastifyRequest,
  FastifySchema,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
  RouteGenericInterface,
} from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

/**
 * Request/Reply tipados a partir del esquema Zod de la ruta. Permiten definir los controladores
 * fuera del fichero de rutas sin perder la inferencia de `params`, `query` y `body`.
 */
export type ZodRequest<Schema extends FastifySchema> = FastifyRequest<
  RouteGenericInterface,
  RawServerDefault,
  RawRequestDefaultExpression,
  Schema,
  ZodTypeProvider
>

export type ZodReply<Schema extends FastifySchema> = FastifyReply<
  RouteGenericInterface,
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  ContextConfigDefault,
  Schema,
  ZodTypeProvider
>

export const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Redondea importes a céntimos para evitar arrastrar errores de coma flotante. */
export const roundCurrency = (value: number): number => Math.round(value * 100) / 100
