<script setup lang="ts">
import {
  calculateOrderTotal,
  formatPackage,
  isEditableByStore,
  ORDER_STATUS_LABELS,
  orderLineTotal,
  type Order,
} from '@cocina-central/shared'
import { ArrowLeftIcon, CheckIcon, CircleXIcon, XIcon } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getErrorMessage } from '@/lib/api-client'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/session'

import OrderQuantityField from '../components/OrderQuantityField.vue'
import OrderStatusBadge from '../components/OrderStatusBadge.vue'
import RejectOrderDialog from '../components/RejectOrderDialog.vue'
import { useApproveOrder, useCancelOrder, useOrder } from '../composables/useOrders'
import { showOrderError } from '../order-errors'

const route = useRoute()
const session = useSessionStore()

const orderId = computed(() => String(route.params.id))
const { data: order, isPending, isError, error, refetch } = useOrder(orderId)

/** El obrador valida los pedidos pendientes; la tienda puede cancelarlos mientras tanto. */
const canValidate = computed(() => session.isKitchenAdmin && order.value?.status === 'pending')
const canCancel = computed(
  () => !session.isKitchenAdmin && !!order.value && isEditableByStore(order.value.status),
)

// Cantidades a servir, por artículo. Empiezan con lo pedido.
const confirmed = ref<Record<string, number>>({})
watch(
  () => [order.value?.id, order.value?.status] as const,
  () => {
    confirmed.value = Object.fromEntries(
      (order.value?.lines ?? []).map((line) => [
        line.saleArticleId,
        line.confirmedQty ?? line.requestedQty,
      ]),
    )
  },
  { immediate: true },
)

/** Líneas con la cantidad que se mostrará: la que se está ajustando o la ya confirmada. */
const lines = computed(() =>
  (order.value?.lines ?? []).map((line) => ({
    ...line,
    confirmedQty: canValidate.value
      ? (confirmed.value[line.saleArticleId] ?? line.requestedQty)
      : line.confirmedQty,
  })),
)
const showConfirmedColumn = computed(
  () => canValidate.value || lines.value.some((line) => line.confirmedQty !== null),
)
const total = computed(() => calculateOrderTotal(lines.value))
const hasChanges = computed(() =>
  lines.value.some((line) => line.confirmedQty !== null && line.confirmedQty !== line.requestedQty),
)
const servesNothing = computed(() => lines.value.every((line) => line.confirmedQty === 0))

const rejection = computed(() =>
  order.value?.status === 'rejected' ? order.value.statusHistory.at(-1) : undefined,
)

// Aprobar
const approveMutation = useApproveOrder()

async function approve(current: Order) {
  try {
    const updated = await approveMutation.mutateAsync({
      id: current.id,
      input: {
        lines: lines.value.map((line) => ({
          saleArticleId: line.saleArticleId,
          confirmedQty: line.confirmedQty ?? line.requestedQty,
        })),
      },
    })
    toast.success(`Pedido ${updated.number}: ${ORDER_STATUS_LABELS[updated.status].toLowerCase()}`)
  } catch (err) {
    showOrderError(err)
  }
}

// Rechazar
const rejecting = ref(false)

// Cancelar (tienda)
const cancelMutation = useCancelOrder()
const cancelling = ref(false)

async function cancel(current: Order) {
  try {
    await cancelMutation.mutateAsync(current.id)
    toast.success(`Pedido ${current.number} cancelado`)
  } catch (err) {
    showOrderError(err)
  } finally {
    cancelling.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-6 rounded-2xl bg-card p-6 shadow-sm">
    <Button variant="ghost" size="sm" class="-ml-2 self-start" as-child>
      <RouterLink :to="{ name: 'requests' }">
        <ArrowLeftIcon />
        Solicitudes
      </RouterLink>
    </Button>

    <div v-if="isPending" class="flex flex-col gap-4">
      <Skeleton class="h-10 w-72" />
      <Skeleton class="h-64 w-full" />
    </div>

    <div v-else-if="isError || !order" class="flex flex-col items-center gap-2 py-10">
      <p class="text-destructive">{{ getErrorMessage(error) }}</p>
      <Button variant="outline" size="sm" @click="refetch()">Reintentar</Button>
    </div>

    <template v-else>
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="font-mono text-2xl font-bold">{{ order.number }}</h1>
            <OrderStatusBadge :status="order.status" />
          </div>
          <p class="text-muted-foreground">
            {{ order.storeName }} · enviado por {{ order.createdBy.displayName }} el
            {{ formatDateTime(order.createdAt) }}
          </p>
        </div>

        <div v-if="canValidate" class="flex flex-wrap gap-2">
          <Button
            variant="destructive"
            :disabled="approveMutation.isPending.value"
            @click="rejecting = true"
          >
            <XIcon />
            Rechazar
          </Button>
          <Button
            :disabled="approveMutation.isPending.value || servesNothing"
            :title="servesNothing ? 'Para no servir nada, rechaza el pedido' : undefined"
            @click="approve(order)"
          >
            <CheckIcon />
            {{ hasChanges ? 'Aprobar con cambios' : 'Aprobar' }}
          </Button>
        </div>
        <Button
          v-else-if="canCancel"
          variant="outline"
          :disabled="cancelMutation.isPending.value"
          @click="cancelling = true"
        >
          <CircleXIcon />
          Cancelar pedido
        </Button>
      </header>

      <div
        v-if="rejection"
        class="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
      >
        <p class="font-medium text-destructive">Rechazado por {{ rejection.userName }}</p>
        <p>{{ rejection.reason }}</p>
      </div>

      <dl>
        <dt class="text-sm text-muted-foreground">Notas de la tienda</dt>
        <dd class="whitespace-pre-line">{{ order.notes ?? '—' }}</dd>
      </dl>

      <p v-if="canValidate" class="text-sm text-muted-foreground">
        Ajusta en «Servir» las cantidades si no se puede servir todo lo pedido (0 = no se sirve).
      </p>

      <div class="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/50">
              <TableHead>Código</TableHead>
              <TableHead>Artículo</TableHead>
              <TableHead>Formato</TableHead>
              <TableHead class="text-right">Precio</TableHead>
              <TableHead class="text-right">Pedido</TableHead>
              <TableHead v-if="showConfirmedColumn" :class="cn(!canValidate && 'text-right')">
                {{ canValidate ? 'Servir' : 'Servido' }}
              </TableHead>
              <TableHead class="text-right">Importe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="line in lines" :key="line.saleArticleId">
              <TableCell class="font-mono text-sm">{{ line.code }}</TableCell>
              <TableCell class="font-medium">{{ line.name }}</TableCell>
              <TableCell>
                <Badge variant="secondary">{{
                  formatPackage(line.format, line.unitsPerFormat)
                }}</Badge>
              </TableCell>
              <TableCell class="text-right tabular-nums">{{
                formatCurrency(line.unitPrice)
              }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ line.requestedQty }}</TableCell>
              <TableCell v-if="showConfirmedColumn" :class="cn(!canValidate && 'text-right')">
                <OrderQuantityField
                  v-if="canValidate"
                  :model-value="line.confirmedQty ?? line.requestedQty"
                  @update:model-value="(value: number) => (confirmed[line.saleArticleId] = value)"
                  :label="`Cantidad a servir de ${line.name}`"
                  :class="cn(line.confirmedQty !== line.requestedQty && '[&_input]:border-sky-500')"
                />
                <span
                  v-else
                  :class="
                    cn(
                      'tabular-nums',
                      line.confirmedQty !== line.requestedQty && 'font-semibold text-sky-700',
                    )
                  "
                >
                  {{ line.confirmedQty }}
                </span>
              </TableCell>
              <TableCell class="text-right tabular-nums">{{
                formatCurrency(orderLineTotal(line))
              }}</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell :colspan="showConfirmedColumn ? 6 : 5" class="text-right font-semibold">
                Total
              </TableCell>
              <TableCell class="text-right font-semibold tabular-nums">{{
                formatCurrency(total)
              }}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <div class="flex flex-col gap-3">
        <h2 class="text-lg font-semibold">Historial</h2>
        <ol class="flex flex-col gap-2 border-l pl-4">
          <li
            v-for="(entry, index) in order.statusHistory"
            :key="index"
            class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
          >
            <OrderStatusBadge :status="entry.status" />
            <span>{{ entry.userName }}</span>
            <span class="text-muted-foreground">{{ formatDateTime(entry.at) }}</span>
            <span v-if="entry.reason" class="w-full text-muted-foreground">
              «{{ entry.reason }}»
            </span>
          </li>
        </ol>
      </div>

      <RejectOrderDialog v-model:open="rejecting" :order="order" />

      <AlertDialog v-model:open="cancelling">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar el pedido {{ order.number }}?</AlertDialogTitle>
            <AlertDialogDescription>
              El obrador dejará de verlo como pendiente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel :disabled="cancelMutation.isPending.value">Volver</AlertDialogCancel>
            <!-- Button y no AlertDialogAction: este cerraría el diálogo antes de cancelar. -->
            <Button
              class="bg-destructive text-white hover:bg-destructive/90"
              :disabled="cancelMutation.isPending.value"
              @click="cancel(order)"
            >
              Cancelar pedido
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </template>
  </section>
</template>
