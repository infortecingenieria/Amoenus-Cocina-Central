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
  modified:
    'border-teal-500 bg-teal-50 text-teal-700 dark:border-teal-500/60 dark:bg-teal-500/15 dark:text-teal-300',
  in_preparation:
    'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-500/60 dark:bg-sky-500/15 dark:text-sky-300',
  delivered: 'border-border bg-secondary text-secondary-foreground',
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
