import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

import { buildApp, type App } from '../../src/app'

export interface TestContext {
  app: App
  close: () => Promise<void>
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
  })
  await app.ready()

  return {
    app,
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
