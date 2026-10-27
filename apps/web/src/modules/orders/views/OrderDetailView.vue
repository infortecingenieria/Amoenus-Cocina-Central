<script setup lang="ts">
import {
  amoenusEventFor,
  calculateOrderTotal,
  formatPackage,
  isEditableByStore,
  isFromAmoenus,
  MAX_LOT_NUMBER_LENGTH,
  orderLineTotal,
  type AmoenusSync,
  type AmoenusSyncEvent,
  type Order,
} from '@cocina-central/shared'
import { ArrowLeftIcon, CheckIcon, CircleXIcon, RefreshCwIcon, XIcon } from '@lucide/vue'
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
import { Input } from '@/components/ui/input'
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
import { formatCalendarDate, formatCurrency, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/session'

import ApproveOrderDialog from '../components/ApproveOrderDialog.vue'
import OrderQuantityField from '../components/OrderQuantityField.vue'
import OrderStatusBadge from '../components/OrderStatusBadge.vue'
import RejectOrderDialog from '../components/RejectOrderDialog.vue'
import { useCancelOrder, useOrder, useResendToAmoenus } from '../composables/useOrders'
import { showOrderError } from '../order-errors'

const route = useRoute()
const session = useSessionStore()

const orderId = computed(() => String(route.params.id))
const { data: order, isPending, isError, error, refetch } = useOrder(orderId)

/**
 * El obrador valida los pedidos pendientes; la tienda puede cancelarlos mientras tanto, salvo los
 * que llegan de Amoenus (allí no se pueden cancelar).
 */
const canValidate = computed(() => session.isKitchenAdmin && order.value?.status === 'pending')
const canCancel = computed(
  () =>
    !session.isKitchenAdmin &&
    !!order.value &&
    !isFromAmoenus(order.value) &&
    isEditableByStore(order.value.status),
)

// Cantidades a servir, por artículo. Empiezan con lo pedido.
const confirmed = ref<Record<string, number>>({})
// Nº de lote y caducidad por artículo, opcionales, tal y como se escriben ('' = sin indicar).
type Traceability = { lotNumber: string; expiryDate: string }
const traceability = ref<Record<string, Traceability>>({})
watch(
  () => [order.value?.id, order.value?.status] as const,
  () => {
    const orderLines = order.value?.lines ?? []
    confirmed.value = Object.fromEntries(
      orderLines.map((line) => [line.saleArticleId, line.confirmedQty ?? line.requestedQty]),
    )
    traceability.value = Object.fromEntries(
      orderLines.map((line) => [
        line.saleArticleId,
        { lotNumber: line.lotNumber ?? '', expiryDate: line.expiryDate ?? '' },
      ]),
    )
  },
  { immediate: true },
)

function setTraceability(saleArticleId: string, field: keyof Traceability, value: string | number) {
  const current = traceability.value[saleArticleId] ?? { lotNumber: '', expiryDate: '' }
  traceability.value[saleArticleId] = { ...current, [field]: String(value) }
}

/** Líneas con lo que se mostrará: lo que se está ajustando o lo ya confirmado. */
const lines = computed(() =>
  (order.value?.lines ?? []).map((line) => {
    if (!canValidate.value) return line
    const confirmedQty = confirmed.value[line.saleArticleId] ?? line.requestedQty
    const tracked = traceability.value[line.saleArticleId]
    // Lo que no se sirve no lleva lote ni caducidad (la API tampoco los guarda).
    const served = confirmedQty > 0
    return {
      ...line,
      confirmedQty,
      lotNumber: (served && tracked?.lotNumber.trim()) || null,
      expiryDate: (served && tracked?.expiryDate) || null,
    }
  }),
)
const showConfirmedColumn = computed(
  () => canValidate.value || lines.value.some((line) => line.confirmedQty !== null),
)
const showTraceabilityColumns = computed(
  () => canValidate.value || lines.value.some((line) => line.lotNumber || line.expiryDate),
)
/** Columnas antes del importe, para que «Total» ocupe todas en el pie. */
const columnsBeforeAmount = computed(
  () => 5 + (showConfirmedColumn.value ? 1 : 0) + (showTraceabilityColumns.value ? 2 : 0),
)
const total = computed(() => calculateOrderTotal(lines.value))
const hasChanges = computed(() =>
  lines.value.some((line) => line.confirmedQty !== null && line.confirmedQty !== line.requestedQty),
)
const servesNothing = computed(() => lines.value.every((line) => line.confirmedQty === 0))

/** Motivo del rechazo o de los cambios del obrador, para que la tienda lo vea destacado. */
const statusNote = computed(() => {
  const status = order.value?.status
  if (status !== 'rejected' && status !== 'modified') return undefined
  const entry = order.value?.statusHistory.at(-1)
  if (!entry?.reason) return undefined
  return {
    title: `${status === 'rejected' ? 'Rechazado' : 'Modificado'} por ${entry.userName}`,
    reason: entry.reason,
    rejected: status === 'rejected',
  }
})

// Aprobar (con o sin cambios) y rechazar: siempre con diálogo de confirmación.
const approving = ref(false)
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

// Envío a Amoenus (pedidos que vienen de allí o de una tienda vinculada). Solo lo ve el obrador.
const AMOENUS_SYNC_EVENT_LABELS: Record<AmoenusSyncEvent, string> = {
  delivery_note: 'Albarán',
  rejection: 'Rechazo',
  store_order: 'Pedido y albarán',
}
const AMOENUS_SYNC_STATUS_LABELS: Record<AmoenusSync['status'] | 'pending', string> = {
  pending: 'pendiente de enviar',
  sent: 'enviado',
  failed: 'no se ha podido enviar',
}
/** Qué hay que comunicar a Amoenus y cómo va; null si nada. Sin intentos aún = pendiente. */
const amoenusSync = computed(() => {
  const current = order.value
  const event = current && session.isKitchenAdmin ? amoenusEventFor(current) : null
  if (!current || !event) return null
  const sync = current.amoenus?.sync
  return {
    event,
    status: sync?.status ?? ('pending' as const),
    sentAt: sync?.sentAt ?? null,
    lastError: sync?.lastError ?? null,
  }
})

const resendMutation = useResendToAmoenus()

async function resendToAmoenus(current: Order) {
  try {
    const sync = (await resendMutation.mutateAsync(current.id)).amoenus?.sync
    if (sync?.status === 'sent') {
      toast.success(`Pedido ${current.number} enviado a Amoenus`)
    } else {
      toast.error(`No se ha podido enviar a Amoenus: ${sync?.lastError ?? ''}`)
    }
  } catch (err) {
    showOrderError(err)
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
            <Badge v-if="isFromAmoenus(order)" variant="outline">Desde Amoenus</Badge>
          </div>
          <p class="text-muted-foreground">
            {{ order.storeName }} · enviado por {{ order.createdBy.displayName }} el
            {{ formatDateTime(order.createdAt) }}
          </p>
        </div>

        <div v-if="canValidate" class="flex flex-wrap gap-2">
          <Button variant="destructive" @click="rejecting = true">
            <XIcon />
            Rechazar
          </Button>
          <Button
            :disabled="servesNothing"
            :title="servesNothing ? 'Para no servir nada, rechaza el pedido' : undefined"
            @click="approving = true"
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
        v-if="statusNote"
        :class="
          cn(
            'rounded-xl border p-4 text-sm',
            statusNote.rejected
              ? 'border-destructive/30 bg-destructive/5'
              : 'border-teal-500/30 bg-teal-50 dark:bg-teal-500/10',
          )
        "
      >
        <p
          :class="
            cn(
              'font-medium',
              statusNote.rejected ? 'text-destructive' : 'text-teal-700 dark:text-teal-300',
            )
          "
        >
          {{ statusNote.title }}
        </p>
        <p class="whitespace-pre-line">{{ statusNote.reason }}</p>
      </div>

      <dl class="grid gap-4 sm:grid-cols-3">
        <div>
          <dt class="text-sm text-muted-foreground">Notas de la tienda</dt>
          <dd class="whitespace-pre-line">{{ order.notes ?? '—' }}</dd>
        </div>
        <div v-if="order.deliveryNote">
          <dt class="text-sm text-muted-foreground">Albarán</dt>
          <dd class="font-mono">{{ order.deliveryNote.number }}</dd>
        </div>
        <div v-if="amoenusSync">
          <dt class="text-sm text-muted-foreground">Envío a Amoenus</dt>
          <dd class="flex flex-wrap items-center gap-2">
            <span :class="cn(amoenusSync.status === 'failed' && 'text-destructive')">
              {{ AMOENUS_SYNC_EVENT_LABELS[amoenusSync.event] }}
              {{ AMOENUS_SYNC_STATUS_LABELS[amoenusSync.status] }}
              <template v-if="amoenusSync.sentAt">
                el {{ formatDateTime(amoenusSync.sentAt) }}
              </template>
            </span>
            <Button
              v-if="amoenusSync.status !== 'sent'"
              variant="outline"
              size="sm"
              :disabled="resendMutation.isPending.value"
              @click="resendToAmoenus(order)"
            >
              <RefreshCwIcon />
              Reenviar a Amoenus
            </Button>
          </dd>
          <dd v-if="amoenusSync.lastError" class="text-sm text-muted-foreground">
            {{ amoenusSync.lastError }} · se reintenta cada 5 minutos
          </dd>
        </div>
      </dl>

      <p v-if="canValidate" class="text-sm text-muted-foreground">
        Ajusta en «Servir» las cantidades si no se puede servir todo lo pedido (0 = no se sirve). El
        lote y la caducidad son opcionales.
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
              <template v-if="showTraceabilityColumns">
                <TableHead>Nº de lote</TableHead>
                <TableHead>Caducidad</TableHead>
              </template>
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
                  :class="
                    cn(line.confirmedQty !== line.requestedQty && '[&_input]:border-teal-500')
                  "
                />
                <span
                  v-else
                  :class="
                    cn(
                      'tabular-nums',
                      line.confirmedQty !== line.requestedQty && 'font-semibold text-teal-700',
                    )
                  "
                >
                  {{ line.confirmedQty }}
                </span>
              </TableCell>
              <template v-if="showTraceabilityColumns">
                <TableCell>
                  <Input
                    v-if="canValidate"
                    :model-value="traceability[line.saleArticleId]?.lotNumber ?? ''"
                    @update:model-value="
                      (value: string | number) =>
                        setTraceability(line.saleArticleId, 'lotNumber', value)
                    "
                    :maxlength="MAX_LOT_NUMBER_LENGTH"
                    :disabled="line.confirmedQty === 0"
                    :aria-label="`Nº de lote de ${line.name}`"
                    placeholder="Opcional"
                    class="h-8 w-32"
                  />
                  <span v-else class="font-mono text-sm">{{ line.lotNumber ?? '—' }}</span>
                </TableCell>
                <TableCell>
                  <Input
                    v-if="canValidate"
                    type="date"
                    :model-value="traceability[line.saleArticleId]?.expiryDate ?? ''"
                    @update:model-value="
                      (value: string | number) =>
                        setTraceability(line.saleArticleId, 'expiryDate', value)
                    "
                    :disabled="line.confirmedQty === 0"
                    :aria-label="`Fecha de caducidad de ${line.name}`"
                    class="h-8 w-40"
                  />
                  <span v-else class="tabular-nums">{{
                    line.expiryDate ? formatCalendarDate(line.expiryDate) : '—'
                  }}</span>
                </TableCell>
              </template>
              <TableCell class="text-right tabular-nums">{{
                formatCurrency(orderLineTotal(line))
              }}</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell :colspan="columnsBeforeAmount" class="text-right font-semibold">
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

      <ApproveOrderDialog v-model:open="approving" :order="order" :lines="lines" />
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
