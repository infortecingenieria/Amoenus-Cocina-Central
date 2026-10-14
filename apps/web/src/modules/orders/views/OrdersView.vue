<script setup lang="ts">
import {
  type ListOrdersParams,
  type OrderSort,
  type OrderStatus,
  type OrderSummary,
} from '@cocina-central/shared'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
} from '@lucide/vue'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getErrorMessage } from '@/lib/api-client'
import { formatDate, formatTime } from '@/lib/format'
import { useSessionStore } from '@/stores/session'

import ApproveOrderDialog from '../components/ApproveOrderDialog.vue'
import OrderStatusBadge from '../components/OrderStatusBadge.vue'
import OrderStatusFilter from '../components/OrderStatusFilter.vue'
import { useOrderList } from '../composables/useOrders'

const PAGE_SIZE = 20

const session = useSessionStore()
const isKitchenAdmin = computed(() => session.isKitchenAdmin)
const columns = computed(() => (isKitchenAdmin.value ? 6 : 5))

const search = ref('')
const debouncedSearch = refDebounced(search, 300)
// El obrador entra directamente a lo que tiene pendiente de validar; la tienda ve todo.
const statuses = ref<OrderStatus[]>(session.isKitchenAdmin ? ['pending'] : [])
const sort = ref<OrderSort>('-createdAt')
const page = ref(1)

watch([debouncedSearch, statuses, sort], () => {
  page.value = 1
})

const params = computed<ListOrdersParams>(() => ({
  page: page.value,
  pageSize: PAGE_SIZE,
  search: debouncedSearch.value.trim() || undefined,
  status: statuses.value.length ? statuses.value : undefined,
  sort: sort.value,
}))

const { data, isPending, isError, error, refetch } = useOrderList(params)

const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const rangeLabel = computed(() => {
  if (total.value === 0) return 'Sin resultados'
  const from = (page.value - 1) * PAGE_SIZE + 1
  const to = Math.min(page.value * PAGE_SIZE, total.value)
  return `${from}–${to} de ${total.value}`
})

const newestFirst = computed(() => sort.value === '-createdAt')
function toggleSort() {
  sort.value = newestFirst.value ? 'createdAt' : '-createdAt'
}

/** «3 productos • 5 uds en total» */
const volumeLabel = (order: OrderSummary) =>
  `${order.lineCount} ${order.lineCount === 1 ? 'producto' : 'productos'} • ` +
  `${order.totalQuantity} ${order.totalQuantity === 1 ? 'ud' : 'uds'} en total`

// Aprobar desde la fila (con confirmación): con las cantidades pedidas. Para ajustarlas, «Editar».
const approvingOrder = ref<OrderSummary | null>(null)
const approveOpen = ref(false)

function openApprove(order: OrderSummary) {
  approvingOrder.value = order
  approveOpen.value = true
}
</script>

<template>
  <section class="flex flex-col gap-6 rounded-2xl bg-card p-6 shadow-sm">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">Gestión de Solicitudes y Pedidos</h1>
        <p class="text-muted-foreground">
          Histórico y estado de pedidos enviados al obrador central
        </p>
      </div>
      <Button v-if="!isKitchenAdmin" as-child>
        <RouterLink :to="{ name: 'new-order' }">
          <PlusIcon />
          Nuevo pedido
        </RouterLink>
      </Button>
    </header>

    <div class="flex flex-wrap items-center gap-3">
      <div class="relative w-full max-w-sm">
        <SearchIcon
          class="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          v-model="search"
          :placeholder="
            isKitchenAdmin ? 'Buscar por N.º de pedido o tienda…' : 'Buscar por N.º de pedido…'
          "
          class="pl-8"
        />
      </div>
      <OrderStatusFilter v-model="statuses" />
    </div>

    <div class="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow class="bg-muted/50 hover:bg-muted/50">
            <TableHead>N.º Pedido</TableHead>
            <TableHead v-if="isKitchenAdmin">Tienda</TableHead>
            <TableHead :aria-sort="newestFirst ? 'descending' : 'ascending'">
              <button
                type="button"
                class="inline-flex items-center gap-1 hover:text-foreground"
                :title="newestFirst ? 'Más nuevos primero' : 'Más antiguos primero'"
                @click="toggleSort"
              >
                Fecha y Hora
                <ArrowDownIcon v-if="newestFirst" class="size-4" />
                <ArrowUpIcon v-else class="size-4" />
              </button>
            </TableHead>
            <TableHead>Artículos / Volumen</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <template v-if="isPending">
            <TableRow v-for="row in 5" :key="row">
              <TableCell v-for="col in columns" :key="col"
                ><Skeleton class="h-8 w-full"
              /></TableCell>
            </TableRow>
          </template>

          <TableEmpty v-else-if="isError" :colspan="columns">
            <div class="flex flex-col items-center gap-2">
              <p class="text-destructive">{{ getErrorMessage(error) }}</p>
              <Button variant="outline" size="sm" @click="refetch()">Reintentar</Button>
            </div>
          </TableEmpty>

          <TableEmpty v-else-if="data?.items.length === 0" :colspan="columns">
            No hay solicitudes que coincidan con los filtros.
          </TableEmpty>

          <TableRow
            v-for="order in data?.items"
            v-else
            :key="order.id"
            class="odd:bg-primary/5 hover:bg-primary/10"
          >
            <TableCell class="font-bold">
              <RouterLink
                :to="{ name: 'request-detail', params: { id: order.id } }"
                class="hover:underline"
              >
                #{{ order.number }}
              </RouterLink>
            </TableCell>
            <TableCell v-if="isKitchenAdmin">{{ order.storeName }}</TableCell>
            <TableCell>
              <div class="leading-tight">
                <p>{{ formatDate(order.createdAt) }}</p>
                <p class="text-muted-foreground">{{ formatTime(order.createdAt) }}</p>
              </div>
            </TableCell>
            <TableCell>{{ volumeLabel(order) }}</TableCell>
            <TableCell><OrderStatusBadge :status="order.status" /></TableCell>
            <TableCell>
              <div class="flex gap-2">
                <!-- Aprobar y Editar solo tienen sentido mientras el pedido está pendiente; una
                     vez tramitado, el obrador solo puede consultarlo (igual que la tienda). -->
                <template v-if="isKitchenAdmin && order.status === 'pending'">
                  <Button
                    size="sm"
                    variant="outline"
                    class="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                    title="Aprobar con las cantidades pedidas"
                    @click="openApprove(order)"
                  >
                    <CheckIcon />
                    Aprobar
                  </Button>
                  <Button size="sm" variant="outline" as-child>
                    <RouterLink :to="{ name: 'request-detail', params: { id: order.id } }">
                      <PencilIcon />
                      Editar
                    </RouterLink>
                  </Button>
                </template>
                <Button v-else size="sm" variant="outline" as-child>
                  <RouterLink :to="{ name: 'request-detail', params: { id: order.id } }">
                    <EyeIcon />
                    Ver
                  </RouterLink>
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <footer class="flex items-center justify-end gap-3 text-sm text-muted-foreground">
      <span>{{ rangeLabel }}</span>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Página anterior"
        :disabled="page <= 1"
        @click="page--"
      >
        <ChevronLeftIcon />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Página siguiente"
        :disabled="page >= totalPages"
        @click="page++"
      >
        <ChevronRightIcon />
      </Button>
    </footer>

    <ApproveOrderDialog v-if="approvingOrder" v-model:open="approveOpen" :order="approvingOrder" />
  </section>
</template>
