import type { ApiErrorBody, ApiErrorCode } from '@cocina-central/shared'

/** Error de negocio con código HTTP. El manejador global lo serializa como `ApiErrorBody`. */
export class AppError extends Error {
  readonly statusCode: number
  readonly code: ApiErrorCode
  readonly details?: unknown

  constructor(statusCode: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = new.target.name
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }

  toBody(): ApiErrorBody {
    return {
      statusCode: this.statusCode,
      code: this.code,
      message: this.message,
      ...(this.details === undefined ? {} : { details: this.details }),
    }
  }
}

/** Detalle de un campo no válido, con el mismo formato que los errores de validación de Zod. */
export interface ValidationIssue {
  path: string
  message: string
}

/** Datos sintácticamente correctos pero rechazados por una regla de negocio (p. ej. una referencia inexistente). */
export class ValidationError extends AppError {
  constructor(message: string, details?: ValidationIssue[]) {
    super(400, 'VALIDATION_ERROR', message, details)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(404, 'NOT_FOUND', message)
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, 'CONFLICT', message, details)
  }
}

/** La operación no está permitida en el estado actual del recurso (p. ej. editar un pedido aprobado). */
export class InvalidStateError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, 'INVALID_STATE', message, details)
  }
}
