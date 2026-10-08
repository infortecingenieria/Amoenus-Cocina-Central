import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import type { FastifyInstance } from 'fastify'
import { jsonSchemaTransform } from 'fastify-type-provider-zod'

/**
 * Documentación OpenAPI generada a partir de los esquemas Zod de las rutas.
 * Se registra en el contexto raíz antes que las rutas para que las vea todas.
 */
export async function registerSwagger(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Amoenus - Cocina Central API',
        description: 'Gestión de pedidos de tiendas al obrador central',
        version: '0.1.0',
      },
      tags: [
        { name: 'health', description: 'Estado del servicio' },
        { name: 'sale-articles', description: 'Artículos de venta del obrador' },
      ],
    },
    transform: jsonSchemaTransform,
  })

  await app.register(swaggerUi, { routePrefix: '/docs', staticCSP: true })
}
