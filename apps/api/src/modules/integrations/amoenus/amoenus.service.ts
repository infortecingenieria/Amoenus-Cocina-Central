import { randomBytes } from 'node:crypto'

import type { AmoenusOrderData, AuthUser, Order } from '@cocina-central/shared'

import { ValidationError, type ValidationIssue } from '../../../shared/errors'
import { hashPassword } from '../../auth/password'
import type { UserRepository } from '../../auth/user.repository'
import type { OrderRepository } from '../../orders/order.repository'
import type { OrderService } from '../../orders/order.service'
import type { SaleArticleRepository } from '../../sale-articles/sale-article.repository'

/** Usuario técnico que figura como autor de los pedidos que llegan de Amoenus. */
const SYSTEM_USERNAME = 'amoenus'
const SYSTEM_DISPLAY_NAME = 'Amoenus Central'

export interface ReceivedOrder {
  order: Order
  /** false si el pedido ya se había recibido antes (reenvío). */
  created: boolean
}

/** Pedidos que Amoenus Central envía al obrador cuando una tienda pide a Cocina Central. */
export class AmoenusIntegrationService {
  private readonly orders: OrderService
  private readonly orderRepository: OrderRepository
  private readonly saleArticles: SaleArticleRepository
  private readonly users: UserRepository
  private systemUser: Promise<AuthUser> | null = null

  constructor(
    orders: OrderService,
    orderRepository: OrderRepository,
    saleArticles: SaleArticleRepository,
    users: UserRepository,
  ) {
    this.orders = orders
    this.orderRepository = orderRepository
    this.saleArticles = saleArticles
    this.users = users
  }

  /**
   * Da de alta el pedido como solicitud pendiente de la tienda (el local de Amoenus). Los
   * artículos se identifican por su código; si el pedido ya se recibió, se devuelve tal cual.
   */
  async receiveOrder(data: AmoenusOrderData): Promise<ReceivedOrder> {
    const existing = await this.orderRepository.findBySource('amoenus', data.externalOrderId)
    if (existing) return { order: existing, created: false }

    const articles = await this.saleArticles.findByCodes(data.lines.map((line) => line.code))
    const idsByCode = new Map(articles.map((article) => [article.code, article.id]))

    const issues: ValidationIssue[] = []
    data.lines.forEach((line, index) => {
      if (!idsByCode.has(line.code)) {
        issues.push({
          path: `/lines/${index}/code`,
          message: `No hay ningún artículo con el código ${line.code}`,
        })
      }
    })
    if (issues.length > 0) {
      throw new ValidationError('Hay artículos del pedido que no existen en Cocina Central', issues)
    }

    const author = await this.getSystemUser()
    const order = await this.orders.createFor({
      storeName: data.localName,
      notes: data.notes,
      lines: data.lines.map((line) => ({
        saleArticleId: idsByCode.get(line.code) as string,
        quantity: line.quantity,
      })),
      author: { id: author.id, displayName: `${data.createdByName} (Amoenus)` },
      source: {
        system: 'amoenus',
        externalOrderId: data.externalOrderId,
        clientId: data.clientId,
        localId: data.localId,
      },
    })
    return { order, created: true }
  }

  /** Se crea la primera vez que llega un pedido y se reutiliza mientras viva el proceso. */
  private getSystemUser(): Promise<AuthUser> {
    this.systemUser ??= this.createSystemUser().catch((error: unknown) => {
      this.systemUser = null
      throw error
    })
    return this.systemUser
  }

  private async createSystemUser(): Promise<AuthUser> {
    return this.users.findOrCreateSystemUser({
      username: SYSTEM_USERNAME,
      displayName: SYSTEM_DISPLAY_NAME,
      role: 'store',
      // Contraseña aleatoria que nadie conoce: además el usuario está desactivado.
      passwordHash: await hashPassword(randomBytes(32).toString('base64')),
    })
  }
}
