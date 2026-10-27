<script setup lang="ts">
import {
  approveOrderSchema,
  ORDER_STATUS_LABELS,
  type OrderLine,
  type OrderSummary,
} from '@cocina-central/shared'
import { ArrowRightIcon } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'

import { useApproveOrder } from '../composables/useOrders'
import { showOrderError } from '../order-errors'

type ApprovalLine = Pick<
  OrderLine,
  'saleArticleId' | 'name' | 'requestedQty' | 'confirmedQty' | 'lotNumber' | 'expiryDate'
>

const props = defineProps<{
  order: Pick<OrderSummary, 'id' | 'number' | 'storeName'>
  /** Cantidades que se van a servir. Sin ellas se aprueba con lo pedido. */
  lines?: readonly ApprovalLine[]
}>()
const open = defineModel<boolean>('open', { required: true })

/** Líneas cuya cantidad a servir no coincide con la pedida. */
const changes = computed(() =>
  (props.lines ?? []).filter(
    (line) => line.confirmedQty !== null && line.confirmedQty !== line.requestedQty,
  ),
)
const hasChanges = computed(() => changes.value.length > 0)

const reason = ref('')
const errors = ref<string[] | undefined>()

watch(open, (isOpen) => {
  if (!isOpen) return
  reason.value = ''
  errors.value = undefined
})

const approveMutation = useApproveOrder()

async function submit() {
  const parsed = approveOrderSchema.safeParse({
    lines: props.lines?.map((line) => ({
      saleArticleId: line.saleArticleId,
      confirmedQty: line.confirmedQty ?? line.requestedQty,
      lotNumber: line.lotNumber,
      expiryDate: line.expiryDate,
    })),
    // Sin cambios no hay motivo; con cambios es obligatorio (la API también lo exige).
    reason: hasChanges.value ? reason.value : undefined,
  })
  if (!parsed.success) {
    errors.value = z.flattenError(parsed.error).fieldErrors.reason
    if (!errors.value) toast.error('Revisa las cantidades, lotes y caducidades a servir')
    return
  }

  try {
    const updated = await approveMutation.mutateAsync({ id: props.order.id, input: parsed.data })
    toast.success(`Pedido ${updated.number}: ${ORDER_STATUS_LABELS[updated.status].toLowerCase()}`)
    open.value = false
  } catch (error) {
    showOrderError(error)
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {{
            hasChanges
              ? `Aprobar ${order.number} con cambios`
              : `¿Aprobar el pedido ${order.number}?`
          }}
        </DialogTitle>
        <DialogDescription>
          {{
            hasChanges
              ? `${order.storeName} recibirá las cantidades ajustadas y verá el motivo en el detalle del pedido.`
              : `Se servirán a ${order.storeName} las cantidades pedidas.`
          }}
        </DialogDescription>
      </DialogHeader>

      <!-- Solo con cambios: sin ellos el diálogo es una simple confirmación. -->
      <form v-if="hasChanges" novalidate class="flex flex-col gap-4" @submit.prevent="submit">
        <ul class="flex flex-col gap-1 rounded-lg border bg-muted/40 p-3 text-sm">
          <li
            v-for="line in changes"
            :key="line.saleArticleId"
            class="flex items-center justify-between gap-3"
          >
            <span class="truncate">{{ line.name }}</span>
            <span class="flex shrink-0 items-center gap-1 tabular-nums">
              <span class="text-muted-foreground line-through">{{ line.requestedQty }}</span>
              <ArrowRightIcon class="size-3.5 text-muted-foreground" />
              <span class="font-semibold">{{ line.confirmedQty }}</span>
            </span>
          </li>
        </ul>

        <Field :data-invalid="!!errors">
          <FieldLabel for="approve-reason">Motivo de los cambios</FieldLabel>
          <Textarea
            id="approve-reason"
            v-model="reason"
            :aria-invalid="!!errors"
            maxlength="500"
            placeholder="P. ej.: rotura de stock de croissants, se sirve lo disponible"
          />
          <FieldError :errors="errors" />
        </Field>
      </form>

      <DialogFooter>
        <Button variant="outline" :disabled="approveMutation.isPending.value" @click="open = false">
          Cancelar
        </Button>
        <Button :disabled="approveMutation.isPending.value" @click="submit">
          {{ hasChanges ? 'Aprobar con cambios' : 'Aprobar' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
