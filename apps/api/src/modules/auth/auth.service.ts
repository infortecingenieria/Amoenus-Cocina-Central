import type { AuthUser, LoginInput, LoginResponse } from '@cocina-central/shared'

import { UnauthorizedError } from '../../shared/errors'
import { verifyPassword } from './password'
import type { UserRepository } from './user.repository'

/** Firma el token de sesión de un usuario. Lo aporta la capa HTTP (`@fastify/jwt`). */
export type SignToken = (user: AuthUser) => string

/** Mismo mensaje en todos los fallos, para no revelar qué usuarios existen. */
const INVALID_CREDENTIALS = 'Usuario o contraseña incorrectos'

/** Reglas de negocio del inicio de sesión. */
export class AuthService {
  private readonly users: UserRepository
  private readonly signToken: SignToken

  constructor(users: UserRepository, signToken: SignToken) {
    this.users = users
    this.signToken = signToken
  }

  async login({ username, password }: LoginInput): Promise<LoginResponse> {
    const credentials = await this.users.findCredentials(username)
    const valid =
      credentials !== null &&
      credentials.active &&
      (await verifyPassword(password, credentials.passwordHash))
    if (!valid) throw new UnauthorizedError(INVALID_CREDENTIALS)

    return { token: this.signToken(credentials.user), user: credentials.user }
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.users.findActiveById(userId)
    if (!user) throw new UnauthorizedError('El usuario ya no está activo')
    return user
  }
}
