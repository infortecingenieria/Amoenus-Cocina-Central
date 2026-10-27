import type { ZodReply, ZodRequest } from '../../../shared/http'
import type { AmoenusSyncService } from './amoenus-sync.service'
import type { receiveAmoenusOrderRoute, resendToAmoenusRoute } from './amoenus.schemas'
import type { AmoenusIntegrationService } from './amoenus.service'

/** Adapta HTTP ⇄ servicio. Sin lógica de negocio: solo extrae datos de la petición y fija el status. */
export class AmoenusIntegrationController {
  private readonly service: AmoenusIntegrationService

  constructor(service: AmoenusIntegrationService) {
    this.service = service
  }

  receiveOrder = async (
    request: ZodRequest<typeof receiveAmoenusOrderRoute>,
    reply: ZodReply<typeof receiveAmoenusOrderRoute>,
  ) => {
    const { order, created } = await this.service.receiveOrder(request.body)
    return reply.code(created ? 201 : 200).send(order)
  }
}

/** Rutas de la aplicación (con sesión) sobre los envíos a Amoenus. */
export class AmoenusSyncController {
  private readonly service: AmoenusSyncService

  constructor(service: AmoenusSyncService) {
    this.service = service
  }

  resend = async (request: ZodRequest<typeof resendToAmoenusRoute>) =>
    this.service.resend(request.params.id)
}
