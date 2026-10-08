import type { AuthUser, UserRole } from '@cocina-central/shared'
import jwt from '@fastify/jwt'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

import type { AppConfig } from '../config/env'
import { ForbiddenError, UnauthorizedError } from '../shared/errors'

/** Contenido del JWT. `sub` es el `_id` del usuario. */
interface SessionTokenPayload {
  sub: string
  username: string
  displayName: string
  role: UserRole
  storeName: string | null
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: SessionTokenPayload
    user: AuthUser
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Hook `onRequest`: exige un token válido y deja el usuario en `request.user`. */
    authenticate: (request: FastifyRequest) => Promise<void>
    /** `preHandler` que solo deja pasar a los roles indicados (requiere `authenticate` antes). */
    requireRole: (...roles: UserRole[]) => (request: FastifyRequest) => Promise<void>
    signSessionToken: (user: AuthUser) => string
  }
}

export type AuthOptions = Pick<AppConfig, 'jwtSecret' | 'jwtExpiresIn'>

/**
 * Autenticación por JWT en la cabecera `Authorization: Bearer <token>`. Con `fastify-plugin` los
 * decoradores quedan disponibles en toda la app, no solo dentro de este plugin.
 */
export const authPlugin = fp<AuthOptions>(async (app: FastifyInstance, options) => {
  await app.register(jwt, {
    secret: options.jwtSecret,
    sign: { expiresIn: options.jwtExpiresIn },
    formatUser: ({ sub, username, displayName, role, storeName }) => ({
      id: sub,
      username,
      displayName,
      role,
      storeName,
    }),
  })

  app.decorate('signSessionToken', (user: AuthUser) =>
    app.jwt.sign({
      sub: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      storeName: user.storeName,
    }),
  )

  app.decorate('authenticate', async (request: FastifyRequest) => {
    try {
      await request.jwtVerify()
    } catch {
      throw new UnauthorizedError('La sesión no es válida o ha caducado')
    }
  })

  app.decorate('requireRole', (...roles: UserRole[]) => async (request: FastifyRequest) => {
    if (!roles.includes(request.user.role)) throw new ForbiddenError()
  })
})
