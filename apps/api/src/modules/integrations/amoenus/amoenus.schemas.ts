import {
  amoenusOrderSchema,
  apiErrorSchema,
  idParamsSchema,
  orderSchema,
} from '@cocina-central/shared'

/** Contrato HTTP de las rutas que usa Amoenus Central. */
const tags = ['integrations']

export const receiveAmoenusOrderRoute = {
  tags,
  summary:
    'Recibe un pedido a proveedor de Amoenus y lo da de alta como solicitud pendiente (201). Si ya se recibió, devuelve el mismo pedido (200)',
  body: amoenusOrderSchema,
  response: {
    200: orderSchema,
    201: orderSchema,
    400: apiErrorSchema,
    401: apiErrorSchema,
  },
}

export const resendToAmoenusRoute = {
  tags: ['orders'],
  summary: 'Reenvía a Amoenus lo que esté pendiente del pedido (albarán, rechazo o pedido de tienda)',
  params: idParamsSchema,
  response: { 200: orderSchema, 404: apiErrorSchema, 409: apiErrorSchema },
}
