import type { ZodReply, ZodRequest } from '../../shared/http'
import type {
  createFamilyRoute,
  deleteFamilyRoute,
  getFamilyRoute,
  listFamiliesRoute,
  updateFamilyRoute,
} from './family.schemas'
import type { FamilyService } from './family.service'

/** Adapta HTTP ⇄ servicio. Sin lógica de negocio: solo extrae datos de la petición y fija el status. */
export class FamilyController {
  private readonly service: FamilyService

  constructor(service: FamilyService) {
    this.service = service
  }

  list = async (request: ZodRequest<typeof listFamiliesRoute>) => this.service.list(request.query)

  getById = async (request: ZodRequest<typeof getFamilyRoute>) =>
    this.service.getById(request.params.id)

  create = async (
    request: ZodRequest<typeof createFamilyRoute>,
    reply: ZodReply<typeof createFamilyRoute>,
  ) => reply.code(201).send(await this.service.create(request.body))

  update = async (request: ZodRequest<typeof updateFamilyRoute>) =>
    this.service.update(request.params.id, request.body)

  delete = async (
    request: ZodRequest<typeof deleteFamilyRoute>,
    reply: ZodReply<typeof deleteFamilyRoute>,
  ) => {
    await this.service.delete(request.params.id)
    return reply.code(204).send()
  }
}
