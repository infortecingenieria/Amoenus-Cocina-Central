import type { ZodReply, ZodRequest } from '../../shared/http'
import type {
  createSaleArticleRoute,
  deleteSaleArticleRoute,
  getSaleArticleRoute,
  listSaleArticlesRoute,
  updateSaleArticleRoute,
} from './sale-article.schemas'
import type { SaleArticleService } from './sale-article.service'

/** Adapta HTTP ⇄ servicio. Sin lógica de negocio: solo extrae datos de la petición y fija el status. */
export class SaleArticleController {
  private readonly service: SaleArticleService

  constructor(service: SaleArticleService) {
    this.service = service
  }

  list = async (request: ZodRequest<typeof listSaleArticlesRoute>) =>
    this.service.list(request.query)

  getById = async (request: ZodRequest<typeof getSaleArticleRoute>) =>
    this.service.getById(request.params.id)

  create = async (
    request: ZodRequest<typeof createSaleArticleRoute>,
    reply: ZodReply<typeof createSaleArticleRoute>,
  ) => reply.code(201).send(await this.service.create(request.body))

  update = async (request: ZodRequest<typeof updateSaleArticleRoute>) =>
    this.service.update(request.params.id, request.body)

  delete = async (
    request: ZodRequest<typeof deleteSaleArticleRoute>,
    reply: ZodReply<typeof deleteSaleArticleRoute>,
  ) => {
    await this.service.delete(request.params.id)
    return reply.code(204).send()
  }
}
