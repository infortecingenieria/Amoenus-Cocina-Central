<script setup lang="ts">
import type { OrderSummary } from '@cocina-central/shared'
import { Loader2Icon, TruckIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { useShipOrder } from '../composables/useOrders'
import { showOrderError } from '../order-errors'

const props = defineProps<{ order: Pick<OrderSummary, 'id' | 'number' | 'storeName'> }>()
const open = defineModel<boolean>('open', { required: true })

const shipMutation = useShipOrder()

async function submit() {
  try {
    const shipped = await shipMutation.mutateAsync(props.order.id)
    // El ticket sale hacia Amoenus en segundo plano: la ficha muestra cómo acaba.
    toast.success(`Pedido ${props.order.number} enviado a ${props.order.storeName}`, {
      description: shipped.amoenusSale ? 'El ticket se está registrando en Amoenus.' : undefined,
    })
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
        <DialogTitle>¿Marcar el pedido {{ order.number }} como enviado?</DialogTitle>
        <DialogDescription>
          Confirma que ha salido hacia {{ order.storeName }} con lo aprobado. Se registrará la venta
          del obrador y no se puede deshacer.
        </DialogDescription>
      </DialogHeader>

      <DialogFooter>
        <Button variant="outline" :disabled="shipMutation.isPending.value" @click="open = false">
          Cancelar
        </Button>
        <Button :disabled="shipMutation.isPending.value" @click="submit">
          <Loader2Icon v-if="shipMutation.isPending.value" class="animate-spin" />
          <TruckIcon v-else />
          Marcar como enviado
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
