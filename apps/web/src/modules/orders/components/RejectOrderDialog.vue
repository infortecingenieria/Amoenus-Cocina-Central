<script setup lang="ts">
import { rejectOrderSchema, type Order } from '@cocina-central/shared'
import { ref, watch } from 'vue'
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

import { useRejectOrder } from '../composables/useOrders'
import { showOrderError } from '../order-errors'

const props = defineProps<{ order: Order }>()
const open = defineModel<boolean>('open', { required: true })

const reason = ref('')
const errors = ref<string[] | undefined>()

watch(open, (isOpen) => {
  if (!isOpen) return
  reason.value = ''
  errors.value = undefined
})

const rejectMutation = useRejectOrder()

async function submit() {
  const parsed = rejectOrderSchema.safeParse({ reason: reason.value })
  if (!parsed.success) {
    errors.value = z.flattenError(parsed.error).fieldErrors.reason
    return
  }

  try {
    await rejectMutation.mutateAsync({ id: props.order.id, input: parsed.data })
    toast.success(`Pedido ${props.order.number} rechazado`)
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
        <DialogTitle>Rechazar {{ order.number }}</DialogTitle>
        <DialogDescription>
          {{ order.storeName }} verá el motivo en el detalle del pedido.
        </DialogDescription>
      </DialogHeader>

      <form id="reject-order-form" novalidate @submit.prevent="submit">
        <Field :data-invalid="!!errors">
          <FieldLabel for="reject-reason">Motivo</FieldLabel>
          <Textarea
            id="reject-reason"
            v-model="reason"
            :aria-invalid="!!errors"
            maxlength="500"
            placeholder="P. ej.: sin existencias de harina de centeno hasta el lunes"
          />
          <FieldError :errors="errors" />
        </Field>
      </form>

      <DialogFooter>
        <Button variant="outline" :disabled="rejectMutation.isPending.value" @click="open = false">
          Cancelar
        </Button>
        <Button
          type="submit"
          form="reject-order-form"
          variant="destructive"
          :disabled="rejectMutation.isPending.value"
        >
          Rechazar pedido
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
