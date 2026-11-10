import type {
  CreateSaleArticleData,
  ListSaleArticlesQuery,
  Paginated,
  SaleArticle,
  UpdateSaleArticleInput,
} from '@cocina-central/shared'

import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors'
import { roundCurrency } from '../../shared/http'
import type { FamilyRepository } from '../families/family.repository'
import type { OrderRepository } from '../orders/order.repository'
import type { SaleArticleRepository } from './sale-article.repository'

/**
 * Lo que tiene que pasar fuera de este módulo cuando cambia el catálogo (p. ej. enviarlo a Amoenus).
 * No debe lanzar ni hacer esperar: el cambio ya está guardado.
 */
export interface SaleArticlesChangedListener {
  saleArticlesChanged(articles: SaleArticle[]): void
}

/** Reglas de negocio del mantenimiento de artículos de venta. */
export class SaleArticleService {
  private readonly repository: SaleArticleRepository
  private readonly families: FamilyRepository
  private readonly orders: OrderRepository
  private readonly changedListener: SaleArticlesChangedListener | undefined

  constructor(
    repository: SaleArticleRepository,
    families: FamilyRepository,
    orders: OrderRepository,
    changedListener?: SaleArticlesChangedListener,
  ) {
    this.repository = repository
    this.families = families
    this.orders = orders
    this.changedListener = changedListener
  }

  async list({
    page,
    pageSize,
    search,
    active,
    familyId,
  }: ListSaleArticlesQuery): Promise<Paginated<SaleArticle>> {
    const { items, total } = await this.repository.findMany(
      { search, active, familyId },
      { page, pageSize },
    )
    return { items, total, page, pageSize }
  }

  async getById(id: string): Promise<SaleArticle> {
    const article = await this.repository.findById(id)
    if (!article) throw new NotFoundError('Artículo de venta no encontrado')
    return article
  }

  async create(data: CreateSaleArticleData): Promise<SaleArticle> {
    await this.ensureCodeIsAvailable(data.code)
    await this.ensureFamilyExists(data.familyId)
    const article = await this.repository.create({ ...data, price: roundCurrency(data.price) })
    this.changedListener?.saleArticlesChanged([article])
    return article
  }

  // TODO: cambiar el código de un artículo ya usado crea otro artículo en Amoenus (sin escandallo,
  // y el antiguo sigue activo) y rompe el código de proveedor de las tiendas; cambiar el formato o
  // las unidades por formato deja mal su escandallo y los consumos salen mal sin avisar. De momento
  // no se bloquea: valorar impedir el cambio de código en artículos ya pedidos y avisar del formato.
  async update(id: string, data: UpdateSaleArticleInput): Promise<SaleArticle> {
    if (data.code !== undefined) await this.ensureCodeIsAvailable(data.code, id)
    await this.ensureFamilyExists(data.familyId)
    const changes = data.price === undefined ? data : { ...data, price: roundCurrency(data.price) }

    const article = await this.repository.update(id, changes)
    if (!article) throw new NotFoundError('Artículo de venta no encontrado')
    this.changedListener?.saleArticlesChanged([article])
    return article
  }

  /** Un artículo que ya se ha pedido no se borra (solo se puede desactivar). */
  async delete(id: string): Promise<void> {
    if (await this.orders.existsWithArticle(id)) {
      throw new ConflictError(
        'El artículo ya se ha pedido y no se puede eliminar. Desactívalo para que no aparezca en los pedidos',
      )
    }
    const article = await this.repository.findById(id)
    if (!article || !(await this.repository.delete(id))) {
      throw new NotFoundError('Artículo de venta no encontrado')
    }
    // Fuera de Cocina Central no se borra: queda inactivo.
    this.changedListener?.saleArticlesChanged([{ ...article, active: false }])
  }

  private async ensureCodeIsAvailable(code: string, currentId?: string): Promise<void> {
    const existing = await this.repository.findByCode(code)
    if (existing && existing.id !== currentId) {
      throw new ConflictError(`Ya existe un artículo con el código ${code}`, { field: 'code' })
    }
  }

  /** `null` o `undefined` (sin familia o campo no enviado) no necesitan comprobación. */
  private async ensureFamilyExists(familyId: string | null | undefined): Promise<void> {
    if (!familyId) return
    const family = await this.families.findById(familyId)
    if (!family) {
      throw new ValidationError('La familia no existe', [
        { path: '/familyId', message: 'La familia no existe' },
      ])
    }
  }
}
