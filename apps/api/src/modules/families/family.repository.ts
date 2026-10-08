import type {
  CreateFamilyInput,
  Family,
  PaginationQuery,
  UpdateFamilyInput,
} from '@cocina-central/shared'
import { isValidObjectId, type QueryFilter } from 'mongoose'

import { escapeRegExp } from '../../shared/http'
import { FAMILY_NAME_COLLATION, FamilyModel, type FamilyRecord } from './family.model'

export interface FamilyFilter {
  search?: string
}

const toFamily = (record: FamilyRecord): Family => ({
  id: record._id.toString(),
  name: record.name,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
})

/** Acceso a datos de familias. Devuelve siempre DTOs planos, nunca documentos Mongoose. */
export class FamilyRepository {
  async findMany(
    filter: FamilyFilter,
    { page, pageSize }: PaginationQuery,
  ): Promise<{ items: Family[]; total: number }> {
    const query: QueryFilter<FamilyRecord> = {}
    if (filter.search) query.name = new RegExp(escapeRegExp(filter.search), 'i')

    const [records, total] = await Promise.all([
      FamilyModel.find(query)
        .collation(FAMILY_NAME_COLLATION)
        .sort({ name: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean<FamilyRecord[]>(),
      FamilyModel.countDocuments(query),
    ])

    return { items: records.map(toFamily), total }
  }

  async findById(id: string): Promise<Family | null> {
    if (!isValidObjectId(id)) return null
    const record = await FamilyModel.findById(id).lean<FamilyRecord>()
    return record ? toFamily(record) : null
  }

  /** Búsqueda exacta sin distinguir mayúsculas ni tildes. */
  async findByName(name: string): Promise<Family | null> {
    const record = await FamilyModel.findOne({ name })
      .collation(FAMILY_NAME_COLLATION)
      .lean<FamilyRecord>()
    return record ? toFamily(record) : null
  }

  async create(data: CreateFamilyInput): Promise<Family> {
    const document = await FamilyModel.create(data)
    return toFamily(document.toObject())
  }

  async update(id: string, data: UpdateFamilyInput): Promise<Family | null> {
    if (!isValidObjectId(id)) return null
    const record = await FamilyModel.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: 'after', runValidators: true },
    ).lean<FamilyRecord>()
    return record ? toFamily(record) : null
  }

  async delete(id: string): Promise<boolean> {
    if (!isValidObjectId(id)) return false
    const result = await FamilyModel.deleteOne({ _id: id })
    return result.deletedCount === 1
  }
}
