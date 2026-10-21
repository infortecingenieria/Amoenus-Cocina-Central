import type { ZodReply, ZodRequest } from '../../../shared/http'
import type { receiveAmoenusOrderRoute } from './amoenus.schemas'
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
