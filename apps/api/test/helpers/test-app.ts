import type { UserRole } from '@cocina-central/shared'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

import { buildApp, type App } from '../../src/app'

export interface TestContext {
  app: App
  /** Cabecera `Authorization` con un token válido para un usuario del rol indicado. */
  authHeaders: (role?: UserRole) => { authorization: string }
  close: () => Promise<void>
}

/** Ids fijos de los usuarios ficticios: el token no exige que existan en la base de datos. */
const TEST_USER_IDS: Record<UserRole, string> = {
  kitchen_admin: '64b7f0c2a1b2c3d4e5f60001',
  store: '64b7f0c2a1b2c3d4e5f60002',
}

/** Levanta la app contra un MongoDB en memoria, aislado por fichero de test. */
export async function createTestApp(): Promise<TestContext> {
  const mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
  await mongoose.connection.syncIndexes()

  const app = await buildApp({
    nodeEnv: 'test',
    logLevel: 'silent',
    corsOrigins: [],
    docsEnabled: true,
    jwtSecret: 'clave-de-pruebas-de-al-menos-32-caracteres',
    jwtExpiresIn: '1h',
  })
  await app.ready()

  const authHeaders = (role: UserRole = 'kitchen_admin') => ({
    authorization: `Bearer ${app.signSessionToken({
      id: TEST_USER_IDS[role],
      username: role,
      displayName: role,
      role,
      storeName: role === 'store' ? 'Tienda de pruebas' : null,
    })}`,
  })

  return {
    app,
    authHeaders,
    close: async () => {
      await app.close()
      await mongoose.disconnect()
      await mongo.stop()
    },
  }
}

export async function clearDatabase(): Promise<void> {
  const collections = await mongoose.connection.db?.collections()
  await Promise.all((collections ?? []).map((collection) => collection.deleteMany({})))
}
