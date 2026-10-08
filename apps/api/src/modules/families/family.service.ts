import type {
  CreateFamilyInput,
  Family,
  ListFamiliesQuery,
  Paginated,
  UpdateFamilyInput,
} from '@cocina-central/shared'

import { ConflictError, NotFoundError } from '../../shared/errors'
import type { SaleArticleRepository } from '../sale-articles/sale-article.repository'
import type { FamilyRepository } from './family.repository'

/** Reglas de negocio del mantenimiento de familias de artículos de venta. */
export class FamilyService {
  private readonly repository: FamilyRepository
  private readonly saleArticles: SaleArticleRepository

  constructor(repository: FamilyRepository, saleArticles: SaleArticleRepository) {
    this.repository = repository
    this.saleArticles = saleArticles
  }

  async list({ page, pageSize, search }: ListFamiliesQuery): Promise<Paginated<Family>> {
    const { items, total } = await this.repository.findMany({ search }, { page, pageSize })
    return { items, total, page, pageSize }
  }

  async getById(id: string): Promise<Family> {
    const family = await this.repository.findById(id)
    if (!family) throw new NotFoundError('Familia no encontrada')
    return family
  }

  async create(data: CreateFamilyInput): Promise<Family> {
    await this.ensureNameIsAvailable(data.name)
    return this.repository.create(data)
  }

  async update(id: string, data: UpdateFamilyInput): Promise<Family> {
    if (data.name !== undefined) await this.ensureNameIsAvailable(data.name, id)

    const family = await this.repository.update(id, data)
    if (!family) throw new NotFoundError('Familia no encontrada')
    return family
  }

  /** Solo se pueden borrar familias sin artículos: antes hay que reasignarlos o dejarlos sin familia. */
  async delete(id: string): Promise<void> {
    const articles = await this.saleArticles.countByFamily(id)
    if (articles > 0) {
      const label = articles === 1 ? '1 artículo asignado' : `${articles} artículos asignados`
      throw new ConflictError(`No se puede eliminar: la familia tiene ${label}`, { articles })
    }

    const deleted = await this.repository.delete(id)
    if (!deleted) throw new NotFoundError('Familia no encontrada')
  }

  private async ensureNameIsAvailable(name: string, currentId?: string): Promise<void> {
    const existing = await this.repository.findByName(name)
    if (existing && existing.id !== currentId) {
      throw new ConflictError(`Ya existe la familia ${existing.name}`, { field: 'name' })
    }
  }
}
