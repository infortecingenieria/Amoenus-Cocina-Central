import type {
  ApproveOrderInput,
  CreateOrderInput,
  ListOrdersParams,
  Order,
  RejectOrderInput,
} from '@cocina-central/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { ordersApi } from '../api/orders.api'

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (params: ListOrdersParams) => [...orderKeys.lists(), params] as const,
  detail: (id: string) => [...orderKeys.all, 'detail', id] as const,
}

export function useOrderList(params: MaybeRefOrGetter<ListOrdersParams>) {
  return useQuery({
    queryKey: computed(() => orderKeys.list(toValue(params))),
    queryFn: ({ signal }) => ordersApi.list(toValue(params), signal),
    placeholderData: keepPreviousData,
  })
}

/** Cuánto se espera, como mucho, a que el ticket del obrador llegue a Amoenus tras enviar el pedido. */
const SALE_SENDING_WINDOW_MS = 60_000
const SALE_POLL_INTERVAL_MS = 2_000

/**
 * El ticket se está enviando a Amoenus: el pedido se acaba de marcar como enviado y la venta aún
 * no tiene resultado (la API la envía en segundo plano). `now` permite evaluarlo con la hora de la
 * última consulta.
 */
export function isSendingSale(order: Order | undefined, now = Date.now()): boolean {
  if (!order?.amoenusSale || order.amoenusSale.sync !== null) return false
  const shipment = [...order.statusHistory].reverse().find((entry) => entry.status === 'shipped')
  return !!shipment && now - new Date(shipment.at).getTime() < SALE_SENDING_WINDOW_MS
}

export function useOrder(id: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => orderKeys.detail(toValue(id))),
    queryFn: ({ signal }) => ordersApi.getById(toValue(id), signal),
    // Mientras se envía el ticket, se consulta hasta ver cómo acaba (enviado o con error).
    refetchInterval: (query) => (isSendingSale(query.state.data) ? SALE_POLL_INTERVAL_MS : false),
  })
}

/**
 * Tras cualquier escritura se guarda el pedido devuelto como detalle (sin otra petición) y se
 * invalidan los listados.
 */
function useOnOrderSaved() {
  const queryClient = useQueryClient()
  return (order: Order) => {
    queryClient.setQueryData(orderKeys.detail(order.id), order)
    return queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
  }
}

export function useCreateOrder() {
  const onSaved = useOnOrderSaved()
  return useMutation({
    mutationFn: (input: CreateOrderInput) => ordersApi.create(input),
    onSuccess: onSaved,
  })
}

export function useApproveOrder() {
  const onSaved = useOnOrderSaved()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ApproveOrderInput }) =>
      ordersApi.approve(id, input),
    onSuccess: onSaved,
  })
}

export function useRejectOrder() {
  const onSaved = useOnOrderSaved()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RejectOrderInput }) =>
      ordersApi.reject(id, input),
    onSuccess: onSaved,
  })
}

export function useShipOrder() {
  const onSaved = useOnOrderSaved()
  return useMutation({
    mutationFn: (id: string) => ordersApi.ship(id),
    onSuccess: onSaved,
  })
}

export function useCancelOrder() {
  const onSaved = useOnOrderSaved()
  return useMutation({
    mutationFn: (id: string) => ordersApi.cancel(id),
    onSuccess: onSaved,
  })
}

export function useResendToAmoenus() {
  const onSaved = useOnOrderSaved()
  return useMutation({
    mutationFn: (id: string) => ordersApi.resendToAmoenus(id),
    onSuccess: onSaved,
  })
}

export function useResendSaleToAmoenus() {
  const onSaved = useOnOrderSaved()
  return useMutation({
    mutationFn: (id: string) => ordersApi.resendSaleToAmoenus(id),
    onSuccess: onSaved,
  })
}
