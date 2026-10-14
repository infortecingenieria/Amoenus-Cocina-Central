import { PACKAGE_FORMATS, type PackageFormat } from '@cocina-central/shared'
import { Schema, model, type Types } from 'mongoose'

export interface SaleArticleRecord {
  _id: Types.ObjectId
  code: string
  name: string
  format: PackageFormat
  unitsPerFormat: number
  price: number
  familyId: Types.ObjectId | null
  active: boolean
  createdAt: Date
  updatedAt: Date
}

const saleArticleSchema = new Schema<SaleArticleRecord>(
  {
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    format: { type: String, enum: PACKAGE_FORMATS, required: true },
    unitsPerFormat: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    familyId: { type: Schema.Types.ObjectId, ref: 'Family', default: null },
    active: { type: Boolean, default: true },
  },
  { collection: 'sale_articles', timestamps: true },
)

saleArticleSchema.index({ code: 1 }, { unique: true })
saleArticleSchema.index({ active: 1, name: 1 })
saleArticleSchema.index({ familyId: 1, name: 1 })

export const SaleArticleModel = model<SaleArticleRecord>('SaleArticle', saleArticleSchema)
