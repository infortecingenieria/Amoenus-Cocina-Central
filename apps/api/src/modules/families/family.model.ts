import { Schema, model, type Types } from 'mongoose'

export interface FamilyRecord {
  _id: Types.ObjectId
  name: string
  createdAt: Date
  updatedAt: Date
}

/** Comparación de nombres sin distinguir mayúsculas ni tildes («Bollería» = «bolleria»). */
export const FAMILY_NAME_COLLATION = { locale: 'es', strength: 1 } as const

const familySchema = new Schema<FamilyRecord>(
  {
    name: { type: String, required: true, trim: true },
  },
  { collection: 'families', timestamps: true },
)

familySchema.index({ name: 1 }, { unique: true, collation: FAMILY_NAME_COLLATION })

export const FamilyModel = model<FamilyRecord>('Family', familySchema)
