<script setup lang="ts">
import { ORDER_STATUS_LABELS, type OrderStatus } from '@cocina-central/shared'

import { Badge } from '@/components/ui/badge'

defineProps<{ status: OrderStatus }>()

/** Pastilla con borde y fondo suave del mismo color, como en el diseño de Solicitudes. */
const STATUS_CLASSES: Record<OrderStatus, string> = {
  pending:
    'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-300',
  approved:
    'border-green-500 bg-green-50 text-green-700 dark:border-green-500/60 dark:bg-green-500/15 dark:text-green-300',
  shipped:
    'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500/60 dark:bg-indigo-500/15 dark:text-indigo-300',
  rejected:
    'border-red-400 bg-red-50 text-red-700 dark:border-red-500/60 dark:bg-red-500/15 dark:text-red-300',
  cancelled: 'border-border bg-muted text-muted-foreground line-through',
}
</script>

<template>
  <Badge :class="['h-6 rounded-full px-2.5 text-xs', STATUS_CLASSES[status]]">
    {{ ORDER_STATUS_LABELS[status] }}
  </Badge>
</template>
