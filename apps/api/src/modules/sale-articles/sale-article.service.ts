import type {
  CreateSaleArticleData,
  ListSaleArticlesQuery,
  Paginated,
  SaleArticle,
  UpdateSaleArticleInput,
} from '@cocina-central/shared'

import { ConflictError, NotFoundError } from '../../shared/errors'
import { roundCurrency } from '../../shared/http'
import type { SaleArticleRepository } from './sale-article.repository'

/** Reglas de negocio del mantenimiento de artículos de venta. */
export class SaleArticleService {
  private readonly repository: SaleArticleRepository

  constructor(repository: SaleArticleRepository) {
    this.repository = repository
  }

  async list({
    page,
    pageSize,
    search,
    active,
  }: ListSaleArticlesQuery): Promise<Paginated<SaleArticle>> {
    const { items, total } = await this.repository.findMany({ search, active }, { page, pageSize })
    return { items, total, page, pageSize }
  }

  async getById(id: string): Promise<SaleArticle> {
    const article = await this.repository.findById(id)
    if (!article) throw new NotFoundError('Artículo de venta no encontrado')
    return article
  }

  async create(data: CreateSaleArticleData): Promise<SaleArticle> {
    await this.ensureCodeIsAvailable(data.code)
    return this.repository.create({ ...data, price: roundCurrency(data.price) })
  }

  async update(id: string, data: UpdateSaleArticleInput): Promise<SaleArticle> {
    if (data.code !== undefined) await this.ensureCodeIsAvailable(data.code, id)
    const changes = data.price === undefined ? data : { ...data, price: roundCurrency(data.price) }

    const article = await this.repository.update(id, changes)
    if (!article) throw new NotFoundError('Artículo de venta no encontrado')
    return article
  }

  // TODO: cuando exista el módulo de pedidos, impedir el borrado de artículos ya pedidos
  // (en ese caso solo se podrán desactivar).
  async delete(id: string): Promise<void> {
    const deleted = await this.repository.delete(id)
    if (!deleted) throw new NotFoundError('Artículo de venta no encontrado')
  }

  private async ensureCodeIsAvailable(code: string, currentId?: string): Promise<void> {
    const existing = await this.repository.findByCode(code)
    if (existing && existing.id !== currentId) {
      throw new ConflictError(`Ya existe un artículo con el código ${code}`, { field: 'code' })
    }
  }
}
