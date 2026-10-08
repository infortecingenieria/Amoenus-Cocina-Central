import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

import { AuthController } from './auth.controller'
import { loginRoute, meRoute } from './auth.schemas'
import { AuthService } from './auth.service'
import { UserRepository } from './user.repository'

/** `POST /login` es público; `GET /me` exige sesión. */
export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  const controller = new AuthController(
    new AuthService(new UserRepository(), (user) => app.signSessionToken(user)),
  )

  app.post('/login', { schema: loginRoute }, controller.login)
  app.get('/me', { schema: meRoute, onRequest: app.authenticate }, controller.me)
}
