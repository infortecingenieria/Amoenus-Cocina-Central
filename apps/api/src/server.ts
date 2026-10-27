import { buildApp } from './app'
import { loadConfig } from './config/env'
import { connectDatabase, disconnectDatabase } from './database/mongoose'

/** Cada cuánto se reintentan los envíos que no han llegado a Amoenus. */
const AMOENUS_RETRY_INTERVAL_MS = 5 * 60 * 1000

const config = loadConfig()
const app = await buildApp(config)

// Cada ronda programa la siguiente al terminar (no `setInterval`), para que una lenta (Amoenus
// sin responder) no se solape con la siguiente.
let closing = false
let amoenusRetry: NodeJS.Timeout | undefined
const scheduleAmoenusRetry = () => {
  amoenusRetry = setTimeout(async () => {
    try {
      const sent = await app.amoenusSync.retryUnsent()
      if (sent > 0) app.log.info(`Reenviados a Amoenus: ${sent}`)
    } catch (error) {
      app.log.error({ err: error }, 'Error reintentando envíos a Amoenus')
    }
    if (!closing) scheduleAmoenusRetry()
  }, AMOENUS_RETRY_INTERVAL_MS)
  amoenusRetry.unref()
}
scheduleAmoenusRetry()

app.addHook('onClose', async () => {
  closing = true
  clearTimeout(amoenusRetry)
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
