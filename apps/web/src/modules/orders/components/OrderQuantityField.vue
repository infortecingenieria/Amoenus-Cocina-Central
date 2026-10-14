<script setup lang="ts">
import { MAX_ORDER_LINE_QUANTITY } from '@cocina-central/shared'

import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@/components/ui/number-field'

/** Selector compacto de cantidad (formatos) para catálogo, carrito y validación. */
withDefaults(defineProps<{ label: string; min?: number }>(), { min: 0 })
const quantity = defineModel<number>({ required: true })
</script>

<template>
  <NumberField
    v-model="quantity"
    :min="min"
    :max="MAX_ORDER_LINE_QUANTITY"
    :step="1"
    class="w-32"
    :aria-label="label"
  >
    <NumberFieldContent>
      <!-- p-2: con el p-3 por defecto los botones sobresalen del input compacto (h-8). -->
      <NumberFieldDecrement class="p-2" />
      <NumberFieldInput class="h-8 tabular-nums" />
      <NumberFieldIncrement class="p-2" />
    </NumberFieldContent>
  </NumberField>
</template>
