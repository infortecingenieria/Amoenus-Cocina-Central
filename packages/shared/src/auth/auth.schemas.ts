import { z } from 'zod'

import { objectIdSchema } from '../common/primitives'
import { userRoleSchema } from './roles'

export const loginSchema = z.object({
  /** Sin distinguir mayúsculas: se guarda y se compara siempre en minúsculas. */
  username: z.string().trim().toLowerCase().min(1, 'El usuario es obligatorio').max(50),
  password: z.string().min(1, 'La contraseña es obligatoria').max(200),
})
export type LoginInput = z.input<typeof loginSchema>

/** Usuario autenticado, tal y como lo ven la web y el resto de la API. Nunca incluye la contraseña. */
export const authUserSchema = z.object({
  id: objectIdSchema,
  username: z.string(),
  displayName: z.string(),
  role: userRoleSchema,
  /** Tienda a la que pertenece el usuario (null para el obrador). */
  storeName: z.string().nullable(),
})
export type AuthUser = z.infer<typeof authUserSchema>

export const loginResponseSchema = z.object({
  /** JWT que hay que enviar en `Authorization: Bearer <token>`. */
  token: z.string(),
  user: authUserSchema,
})
export type LoginResponse = z.infer<typeof loginResponseSchema>
