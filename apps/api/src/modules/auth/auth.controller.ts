import type { ZodRequest } from '../../shared/http'
import type { loginRoute, meRoute } from './auth.schemas'
import type { AuthService } from './auth.service'

/** Adapta HTTP ⇄ servicio. Sin lógica de negocio: solo extrae datos de la petición. */
export class AuthController {
  private readonly service: AuthService

  constructor(service: AuthService) {
    this.service = service
  }

  login = async (request: ZodRequest<typeof loginRoute>) => this.service.login(request.body)

  me = async (request: ZodRequest<typeof meRoute>) => this.service.me(request.user.id)
}
