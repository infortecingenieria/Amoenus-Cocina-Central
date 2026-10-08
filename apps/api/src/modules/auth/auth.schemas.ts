import { apiErrorSchema, authUserSchema, loginResponseSchema, loginSchema } from '@cocina-central/shared'

/** Contrato HTTP de cada ruta: validación de entrada, serialización de salida y OpenAPI. */
const tags = ['auth']

export const loginRoute = {
  tags,
  summary: 'Inicia sesión con usuario y contraseña',
  security: [],
  body: loginSchema,
  response: { 200: loginResponseSchema, 401: apiErrorSchema },
}

export const meRoute = {
  tags,
  summary: 'Usuario de la sesión actual',
  response: { 200: authUserSchema, 401: apiErrorSchema },
}
