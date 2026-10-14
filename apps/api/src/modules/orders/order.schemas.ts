import {
  apiErrorSchema,
  approveOrderSchema,
  createOrderSchema,
  idParamsSchema,
  listOrdersQuerySchema,
  orderListSchema,
  orderSchema,
  rejectOrderSchema,
} from '@cocina-central/shared'

/** Contrato HTTP de cada ruta: validación de entrada, serialización de salida y OpenAPI. */
const tags = ['orders']

export const listOrdersRoute = {
  tags,
  summary: 'Lista paginada de pedidos (la tienda solo ve los suyos)',
  querystring: listOrdersQuerySchema,
  response: { 200: orderListSchema },
}

export const getOrderRoute = {
  tags,
  summary: 'Detalle de un pedido',
  params: idParamsSchema,
  response: { 200: orderSchema, 404: apiErrorSchema },
}

export const createOrderRoute = {
  tags,
  summary: 'Crea un pedido de la tienda al obrador (queda pendiente de validar)',
  body: createOrderSchema,
  response: { 201: orderSchema, 400: apiErrorSchema, 403: apiErrorSchema },
}

export const approveOrderRoute = {
  tags,
  summary: 'Aprueba un pedido pendiente, con las cantidades que servirá el obrador',
  params: idParamsSchema,
  body: approveOrderSchema,
  response: { 200: orderSchema, 400: apiErrorSchema, 404: apiErrorSchema, 409: apiErrorSchema },
}

export const rejectOrderRoute = {
  tags,
  summary: 'Rechaza un pedido pendiente indicando el motivo',
  params: idParamsSchema,
  body: rejectOrderSchema,
  response: { 200: orderSchema, 404: apiErrorSchema, 409: apiErrorSchema },
}

export const cancelOrderRoute = {
  tags,
  summary: 'La tienda cancela un pedido que aún no se ha tramitado',
  params: idParamsSchema,
  response: { 200: orderSchema, 404: apiErrorSchema, 409: apiErrorSchema },
}
