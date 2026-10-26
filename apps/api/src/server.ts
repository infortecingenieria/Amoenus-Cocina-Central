import { buildApp } from './app'
import { loadConfig } from './config/env'
import { connectDatabase, disconnectDatabase } from './database/mongoose'

/** Cada cuánto se reintentan los albaranes y rechazos que no han llegado a Amoenus. */
const AMOENUS_RETRY_INTERVAL_MS = 5 * 60 * 1000

const config = loadConfig()
const app = await buildApp(config)

const amoenusRetry = setInterval(() => {
  app.amoenusSync
    .retryUnsent()
    .then((sent) => {
      if (sent > 0) app.log.info(`Reenviados a Amoenus: ${sent}`)
    })
    .catch((error: unknown) => app.log.error({ err: error }, 'Error reintentando envíos a Amoenus'))
}, AMOENUS_RETRY_INTERVAL_MS)
amoenusRetry.unref()

app.addHook('onClose', async () => {
  clearInterval(amoenusRetry)
  await disconnectDatabase()
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    app.log.info(`${signal} recibido, cerrando el servidor`)
    await app.close()
    process.exit(0)
  })
}

try {
  await connectDatabase(config.mongodbUri, app.log)
  await app.listen({ host: config.host, port: config.port })
} catch (error) {
  app.log.fatal({ err: error }, 'No se ha podido arrancar el servidor')
  await app.close()
  process.exit(1)
}
