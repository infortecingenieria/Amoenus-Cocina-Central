import type {
  CreateSaleArticleData,
  PaginationQuery,
  SaleArticle,
  UpdateSaleArticleInput,
} from '@cocina-central/shared'
import { isValidObjectId, type QueryFilter } from 'mongoose'

import { escapeRegExp } from '../../shared/http'
import { SaleArticleModel, type SaleArticleRecord } from './sale-article.model'

export interface SaleArticleFilter {
  search?: string
  active?: boolean
}

const toSaleArticle = (record: SaleArticleRecord): SaleArticle => ({
  id: record._id.toString(),
  code: record.code,
  name: record.name,
  format: record.format,
  unitsPerFormat: record.unitsPerFormat,
  price: record.price,
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
    if (filter.search) {
      const pattern = new RegExp(escapeRegExp(filter.search), 'i')
      query.$or = [{ code: pattern }, { name: pattern }]
    }

    const [records, total] = await Promise.all([
      SaleArticleModel.find(query)
        .sort({ name: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean<SaleArticleRecord[]>(),
      SaleArticleModel.countDocuments(query),
    ])

    return { items: records.map(toSaleArticle), total }
  }

  async findById(id: string): Promise<SaleArticle | null> {
    if (!isValidObjectId(id)) return null
    const record = await SaleArticleModel.findById(id).lean<SaleArticleRecord>()
    return record ? toSaleArticle(record) : null
  }

  async findByCode(code: string): Promise<SaleArticle | null> {
    const record = await SaleArticleModel.findOne({ code }).lean<SaleArticleRecord>()
    return record ? toSaleArticle(record) : null
  }

  async create(data: CreateSaleArticleData): Promise<SaleArticle> {
    const document = await SaleArticleModel.create(data)
    return toSaleArticle(document.toObject())
  }

  async update(id: string, data: UpdateSaleArticleInput): Promise<SaleArticle | null> {
    if (!isValidObjectId(id)) return null
    const record = await SaleArticleModel.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: 'after', runValidators: true },
    ).lean<SaleArticleRecord>()
    return record ? toSaleArticle(record) : null
  }

  async delete(id: string): Promise<boolean> {
    if (!isValidObjectId(id)) return false
    const result = await SaleArticleModel.deleteOne({ _id: id })
    return result.deletedCount === 1
  }
}
