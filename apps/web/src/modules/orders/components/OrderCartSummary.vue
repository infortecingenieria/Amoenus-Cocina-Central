<script setup lang="ts">
import { formatPackage } from '@cocina-central/shared'
import { SendIcon, ShoppingCartIcon, Trash2Icon } from '@lucide/vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
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
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/format'
import { useOrderCartStore } from '@/stores/order-cart'

import { useCreateOrder } from '../composables/useOrders'
import { showOrderError } from '../order-errors'
import OrderQuantityField from './OrderQuantityField.vue'

const cart = useOrderCartStore()
const router = useRouter()
const createMutation = useCreateOrder()

const confirming = ref(false)

async function submit() {
  try {
    const order = await createMutation.mutateAsync(cart.toOrderInput())
    confirming.value = false
    cart.clear()
    toast.success(`Pedido ${order.number} enviado al obrador`)
    await router.push({ name: 'request-detail', params: { id: order.id } })
  } catch (error) {
    confirming.value = false
    showOrderError(error)
  }
}
</script>

<template>
  <aside class="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
    <header class="flex items-center justify-between gap-2">
      <h2 class="text-lg font-semibold">Tu pedido</h2>
      <span class="text-sm text-muted-foreground">
        {{ cart.lineCount }} {{ cart.lineCount === 1 ? 'artículo' : 'artículos' }}
      </span>
    </header>

    <div
      v-if="cart.isEmpty"
      class="flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground"
    >
      <ShoppingCartIcon class="size-8" />
      Añade artículos del catálogo indicando cuántos formatos necesitas.
    </div>

    <ul v-else class="flex max-h-[45vh] flex-col gap-3 overflow-y-auto pr-1">
      <li v-for="line in cart.lines" :key="line.article.id" class="flex flex-col gap-2">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="truncate font-medium">{{ line.article.name }}</p>
            <p class="text-xs text-muted-foreground">
              {{ formatPackage(line.article.format, line.article.unitsPerFormat) }} ·
              {{ formatCurrency(line.article.price) }}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="`Quitar ${line.article.name}`"
            @click="cart.remove(line.article.id)"
          >
            <Trash2Icon />
          </Button>
        </div>
        <div class="flex items-center justify-between gap-2">
          <OrderQuantityField
            :model-value="line.quantity"
            :label="`Cantidad de ${line.article.name}`"
            @update:model-value="(value: number) => cart.setQuantity(line.article, value)"
          />
          <span class="text-sm font-medium tabular-nums">
            {{ formatCurrency(line.article.price * line.quantity) }}
          </span>
        </div>
      </li>
    </ul>

    <Separator />

    <div class="flex items-center justify-between text-base font-semibold">
      <span>Total estimado</span>
      <span class="tabular-nums">{{ formatCurrency(cart.total) }}</span>
    </div>

    <Field>
      <FieldLabel for="order-notes">Notas para el obrador</FieldLabel>
      <Textarea
        id="order-notes"
        v-model="cart.notes"
        maxlength="500"
        placeholder="Opcional: indicaciones de entrega, cambios de última hora…"
      />
    </Field>

    <Button
      size="lg"
      :disabled="cart.isEmpty || createMutation.isPending.value"
      @click="confirming = true"
    >
      <SendIcon />
      Enviar pedido
    </Button>

    <AlertDialog v-model:open="confirming">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Enviar el pedido al obrador?</AlertDialogTitle>
          <AlertDialogDescription>
            {{ cart.lineCount }} {{ cart.lineCount === 1 ? 'artículo' : 'artículos' }} por
            {{ formatCurrency(cart.total) }}. Quedará pendiente de validar y podrás cancelarlo
            mientras el obrador no lo haya tramitado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="createMutation.isPending.value">Revisar</AlertDialogCancel>
          <!-- Button y no AlertDialogAction: este cerraría el diálogo antes de terminar el envío. -->
          <Button :disabled="createMutation.isPending.value" @click="submit">Enviar pedido</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </aside>
</template>
