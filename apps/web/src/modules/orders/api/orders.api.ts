import type {
  ApproveOrderInput,
  CreateOrderInput,
  ListOrdersParams,
  Order,
  OrderSummary,
  Paginated,
  RejectOrderInput,
} from '@cocina-central/shared'

import { apiClient } from '@/lib/api-client'

const BASE_PATH = '/orders'

export const ordersApi = {
  /** Los estados viajan unidos por comas (`?status=pending,modified`); sin estados = todos. */
  list: ({ status, ...params }: ListOrdersParams, signal?: AbortSignal) =>
    apiClient.get<Paginated<OrderSummary>>(BASE_PATH, {
      query: { ...params, status: status?.join(',') },
      signal,
    }),

  getById: (id: string, signal?: AbortSignal) =>
    apiClient.get<Order>(`${BASE_PATH}/${id}`, { signal }),

  create: (input: CreateOrderInput) => apiClient.post<Order>(BASE_PATH, input),

  approve: (id: string, input: ApproveOrderInput) =>
    apiClient.post<Order>(`${BASE_PATH}/${id}/approve`, input),

  reject: (id: string, input: RejectOrderInput) =>
    apiClient.post<Order>(`${BASE_PATH}/${id}/reject`, input),

  cancel: (id: string) => apiClient.post<Order>(`${BASE_PATH}/${id}/cancel`, undefined),

  /** Reenvía a Amoenus el albarán o el rechazo de un pedido que viene de allí. */
  resendToAmoenus: (id: string) =>
    apiClient.post<Order>(`${BASE_PATH}/${id}/amoenus-sync`, undefined),
}
