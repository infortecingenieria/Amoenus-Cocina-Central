import type { ZodReply, ZodRequest } from '../../../shared/http'
import type { AmoenusCatalogService } from './amoenus-catalog.service'
import type { AmoenusSaleService } from './amoenus-sale.service'
import type { AmoenusSyncService } from './amoenus-sync.service'
import type {
  receiveAmoenusOrderRoute,
  resendSaleToAmoenusRoute,
  resendToAmoenusRoute,
} from './amoenus.schemas'
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
  private readonly sync: AmoenusSyncService
  private readonly sales: AmoenusSaleService
  private readonly catalog: AmoenusCatalogService

  constructor(sync: AmoenusSyncService, sales: AmoenusSaleService, catalog: AmoenusCatalogService) {
    this.sync = sync
    this.sales = sales
    this.catalog = catalog
  }

  resend = async (request: ZodRequest<typeof resendToAmoenusRoute>) =>
    this.sync.resend(request.params.id)

  resendSale = async (request: ZodRequest<typeof resendSaleToAmoenusRoute>) =>
    this.sales.resend(request.params.id)

  syncCatalog = async () => this.catalog.syncAll()
}
