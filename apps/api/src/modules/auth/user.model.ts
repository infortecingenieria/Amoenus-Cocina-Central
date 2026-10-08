import { USER_ROLES, type UserRole } from '@cocina-central/shared'
import { Schema, model, type Types } from 'mongoose'

export interface UserRecord {
  _id: Types.ObjectId
  /** Siempre en minúsculas: el login no distingue mayúsculas. */
  username: string
  /** Ver `password.ts`. Nunca sale de este módulo. */
  passwordHash: string
  displayName: string
  role: UserRole
  storeName: string | null
  active: boolean
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<UserRecord>(
  {
    username: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    role: { type: String, enum: USER_ROLES, required: true },
    storeName: { type: String, default: null },
    active: { type: Boolean, default: true },
  },
  { collection: 'users', timestamps: true },
)

userSchema.index({ username: 1 }, { unique: true })

export const UserModel = model<UserRecord>('User', userSchema)
