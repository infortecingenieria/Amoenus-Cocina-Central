import {
  NO_FAMILY,
  type CreateSaleArticleData,
  type PaginationQuery,
  type SaleArticle,
  type UpdateSaleArticleInput,
} from '@cocina-central/shared'
import { isValidObjectId, type QueryFilter } from 'mongoose'

import { escapeRegExp } from '../../shared/http'
import { FamilyModel, type FamilyRecord } from '../families/family.model'
import { SaleArticleModel, type SaleArticleRecord } from './sale-article.model'

export interface SaleArticleFilter {
  search?: string
  active?: boolean
  /** `_id` de una familia, o `NO_FAMILY` para los artículos sin familia. */
  familyId?: string
}

/** Artículo con su familia cargada (`populate`), para devolver el nombre sin otra consulta por fila. */
type PopulatedSaleArticleRecord = Omit<SaleArticleRecord, 'familyId'> & {
  familyId?: Pick<FamilyRecord, '_id' | 'name'> | null
}

const POPULATE_FAMILY = { path: 'familyId', select: 'name', model: FamilyModel }

const toSaleArticle = (record: PopulatedSaleArticleRecord): SaleArticle => ({
  id: record._id.toString(),
  code: record.code,
  name: record.name,
  format: record.format,
  unitsPerFormat: record.unitsPerFormat,
  price: record.price,
  familyId: record.familyId?._id.toString() ?? null,
  familyName: record.familyId?.name ?? null,
  imageUrl: record.imageUrl,
  active: record.active,
  amoenusSaleItemId: record.amoenusSaleItemId,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
})

/** Acceso a datos de artículos de venta. Devuelve siempre DTOs planos, nunca documentos Mongoose. */
export class SaleArticleRepository {
  async findMany(
    filter: SaleArticleFilter,
    { page, pageSize }: PaginationQuery,
  ): Promise<{ items: SaleArticle[]; total: number }> {
    const query: QueryFilter<SaleArticleRecord> = {}
    if (filter.active !== undefined) query.active = filter.active
    if (filter.familyId) query.familyId = filter.familyId === NO_FAMILY ? null : filter.familyId
    if (filter.search) {
      const pattern = new RegExp(escapeRegExp(filter.search), 'i')
      query.$or = [{ code: pattern }, { name: pattern }]
    }

    const [records, total] = await Promise.all([
      SaleArticleModel.find(query)
        .sort({ name: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .populate(POPULATE_FAMILY)
        .lean<PopulatedSaleArticleRecord[]>(),
      SaleArticleModel.countDocuments(query),
    ])

    return { items: records.map(toSaleArticle), total }
  }

  async findById(id: string): Promise<SaleArticle | null> {
    if (!isValidObjectId(id)) return null
    const record = await SaleArticleModel.findById(id)
      .populate(POPULATE_FAMILY)
      .lean<PopulatedSaleArticleRecord>()
    return record ? toSaleArticle(record) : null
  }

  async findByCode(code: string): Promise<SaleArticle | null> {
    const record = await SaleArticleModel.findOne({ code })
      .populate(POPULATE_FAMILY)
      .lean<PopulatedSaleArticleRecord>()
    return record ? toSaleArticle(record) : null
  }

  async countByFamily(familyId: string): Promise<number> {
    if (!isValidObjectId(familyId)) return 0
    return SaleArticleModel.countDocuments({ familyId })
  }

  async create(data: CreateSaleArticleData): Promise<SaleArticle> {
    const document = await SaleArticleModel.create(data)
    await document.populate(POPULATE_FAMILY)
    return toSaleArticle(document.toObject<PopulatedSaleArticleRecord>())
  }

  async update(id: string, data: UpdateSaleArticleInput): Promise<SaleArticle | null> {
    if (!isValidObjectId(id)) return null
    const record = await SaleArticleModel.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: 'after', runValidators: true },
    )
      .populate(POPULATE_FAMILY)
      .lean<PopulatedSaleArticleRecord>()
    return record ? toSaleArticle(record) : null
  }

  async delete(id: string): Promise<boolean> {
    if (!isValidObjectId(id)) return false
    const result = await SaleArticleModel.deleteOne({ _id: id })
    return result.deletedCount === 1
  }
}
