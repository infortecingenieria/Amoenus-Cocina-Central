import type { FastifyBaseLogger } from 'fastify'
import mongoose from 'mongoose'

mongoose.set('strictQuery', true)

export async function connectDatabase(uri: string, logger: FastifyBaseLogger): Promise<void> {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 })
  logger.info({ database: mongoose.connection.name }, 'Conectado a MongoDB')
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect()
}

export const isDatabaseConnected = (): boolean =>
  mongoose.connection.readyState === mongoose.ConnectionStates.connected
