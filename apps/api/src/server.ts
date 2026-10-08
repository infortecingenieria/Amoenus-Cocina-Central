import { buildApp } from './app'
import { loadConfig } from './config/env'
import { connectDatabase, disconnectDatabase } from './database/mongoose'

const config = loadConfig()
const app = await buildApp(config)

app.addHook('onClose', async () => {
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
