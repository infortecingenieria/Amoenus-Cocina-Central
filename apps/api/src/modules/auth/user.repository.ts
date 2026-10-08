import type { AuthUser, UserRole } from '@cocina-central/shared'
import { isValidObjectId } from 'mongoose'

import { UserModel, type UserRecord } from './user.model'

/** Usuario con los datos que solo necesita el login: el hash y si está activo. */
export interface UserCredentials {
  user: AuthUser
  passwordHash: string
  active: boolean
}

export interface UpsertUserData {
  username: string
  passwordHash: string
  displayName: string
  role: UserRole
  storeName: string | null
  active?: boolean
}

const toAuthUser = (record: UserRecord): AuthUser => ({
  id: record._id.toString(),
  username: record.username,
  displayName: record.displayName,
  role: record.role,
  storeName: record.storeName,
})

/** Acceso a datos de usuarios. Devuelve siempre DTOs planos, nunca documentos Mongoose. */
export class UserRepository {
  async findCredentials(username: string): Promise<UserCredentials | null> {
    const record = await UserModel.findOne({ username: username.toLowerCase() }).lean<UserRecord>()
    return record
      ? { user: toAuthUser(record), passwordHash: record.passwordHash, active: record.active }
      : null
  }

  /** Solo usuarios activos: uno desactivado deja de poder usar la aplicación. */
  async findActiveById(id: string): Promise<AuthUser | null> {
    if (!isValidObjectId(id)) return null
    const record = await UserModel.findOne({ _id: id, active: true }).lean<UserRecord>()
    return record ? toAuthUser(record) : null
  }

  /** Crea o actualiza por `username`. Pensado para el seed y los tests. */
  async upsertByUsername(data: UpsertUserData): Promise<AuthUser> {
    const record = await UserModel.findOneAndUpdate(
      { username: data.username.toLowerCase() },
      { $set: { active: true, ...data } },
      { upsert: true, returnDocument: 'after', runValidators: true },
    ).lean<UserRecord>()
    return toAuthUser(record)
  }
}
