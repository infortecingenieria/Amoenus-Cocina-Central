import { PACKAGE_FORMATS, type PackageFormat } from '@cocina-central/shared'
import { Schema, model, type Types } from 'mongoose'

export interface SaleArticleRecord {
  _id: Types.ObjectId
  code: string
  name: string
  format: PackageFormat
  unitsPerFormat: number
  price: number
  imageUrl: string | null
  active: boolean
  amoenusSaleItemId: string | null
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
    imageUrl: { type: String, default: null },
    active: { type: Boolean, default: true },
    amoenusSaleItemId: { type: String, default: null },
  },
  { collection: 'sale_articles', timestamps: true },
)

saleArticleSchema.index({ code: 1 }, { unique: true })
saleArticleSchema.index({ active: 1, name: 1 })
// Un artículo de Amoenus Central solo puede estar vinculado a un artículo del obrador.
saleArticleSchema.index(
  { amoenusSaleItemId: 1 },
  { unique: true, partialFilterExpression: { amoenusSaleItemId: { $type: 'string' } } },
)

export const SaleArticleModel = model<SaleArticleRecord>('SaleArticle', saleArticleSchema)
