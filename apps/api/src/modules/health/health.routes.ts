import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { isDatabaseConnected } from '../../database/mongoose'

const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  database: z.enum(['up', 'down']),
  uptimeSeconds: z.number(),
})

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Estado del servicio',
        response: { 200: healthResponseSchema },
      },
    },
    async () => {
      const databaseUp = isDatabaseConnected()
      return {
        status: databaseUp ? 'ok' : 'degraded',
        database: databaseUp ? 'up' : 'down',
        uptimeSeconds: Math.round(process.uptime()),
      } as const
    },
  )
}
