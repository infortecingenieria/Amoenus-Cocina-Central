import type { ApiErrorBody } from '@cocina-central/shared'
import type { FastifyInstance } from 'fastify'
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod'
import mongoose from 'mongoose'

import { AppError } from '../shared/errors'

const isDuplicateKeyError = (error: unknown): error is { keyValue?: Record<string, unknown> } =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 11000

const isClientError = (error: unknown): error is Error & { statusCode: number } =>
  error instanceof Error &&
  'statusCode' in error &&
  typeof error.statusCode === 'number' &&
  error.statusCode >= 400 &&
  error.statusCode < 500

/** Traduce cualquier error a un `ApiErrorBody` homogéneo. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    const body: ApiErrorBody = {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: `Ruta ${request.method} ${request.url} no encontrada`,
    }
    return reply.code(404).send(body)
  })

  app.setErrorHandler((error, request, reply) => {
    const send = (body: ApiErrorBody) => reply.code(body.statusCode).send(body)

    if (hasZodFastifySchemaValidationErrors(error)) {
      return send({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'La petición contiene datos no válidos',
        details: error.validation.map((issue) => ({
          location: error.validationContext,
          path: issue.instancePath,
          message: issue.message,
        })),
      })
    }

    if (error instanceof AppError) {
      return send(error.toBody())
    }

    if (isDuplicateKeyError(error)) {
      return send({
        statusCode: 409,
        code: 'CONFLICT',
        message: 'Ya existe un registro con esos datos',
        details: error.keyValue,
      })
    }

    if (error instanceof mongoose.Error.CastError) {
      return send({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: `Valor no válido para ${error.path}`,
      })
    }

    if (isResponseSerializationError(error)) {
      request.log.error(
        { err: error, issues: error.cause.issues },
        'La respuesta no cumple su esquema',
      )
    } else if (isClientError(error)) {
      // Errores propios de Fastify (JSON mal formado, content-type no soportado...).
      return send({
        statusCode: error.statusCode,
        code: 'VALIDATION_ERROR',
        message: error.message,
      })
    } else {
      request.log.error({ err: error }, 'Error no controlado')
    }

    return send({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
  })
}
