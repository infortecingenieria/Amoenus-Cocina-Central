import type { ZodReply, ZodRequest } from '../../shared/http'
import type {
  approveOrderRoute,
  cancelOrderRoute,
  createOrderRoute,
  getOrderRoute,
  listOrdersRoute,
  rejectOrderRoute,
} from './order.schemas'
import type { OrderService } from './order.service'

/** Adapta HTTP ⇄ servicio. Sin lógica de negocio: solo extrae datos de la petición y fija el status. */
export class OrderController {
  private readonly service: OrderService

  constructor(service: OrderService) {
    this.service = service
  }

  list = async (request: ZodRequest<typeof listOrdersRoute>) =>
    this.service.list(request.query, request.user)

  getById = async (request: ZodRequest<typeof getOrderRoute>) =>
    this.service.getById(request.params.id, request.user)

  create = async (
    request: ZodRequest<typeof createOrderRoute>,
    reply: ZodReply<typeof createOrderRoute>,
  ) => reply.code(201).send(await this.service.create(request.body, request.user))

  approve = async (request: ZodRequest<typeof approveOrderRoute>) =>
    this.service.approve(request.params.id, request.body, request.user)

  reject = async (request: ZodRequest<typeof rejectOrderRoute>) =>
    this.service.reject(request.params.id, request.body, request.user)

  cancel = async (request: ZodRequest<typeof cancelOrderRoute>) =>
    this.service.cancel(request.params.id, request.user)
}
