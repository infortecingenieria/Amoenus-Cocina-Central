import { z } from 'zod'

/**
 * - `store`: tienda que hace pedidos al obrador.
 * - `kitchen_admin`: administrador de la cocina central / obrador, valida y aprueba pedidos.
 */
export const USER_ROLES = ['store', 'kitchen_admin'] as const
export const userRoleSchema = z.enum(USER_ROLES)
export type UserRole = z.infer<typeof userRoleSchema>

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  store: 'Tienda',
  kitchen_admin: 'Admin Central / Obrador',
}
