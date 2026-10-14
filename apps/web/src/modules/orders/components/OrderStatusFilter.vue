<script setup lang="ts">
import { ORDER_STATUS_LABELS, ORDER_STATUSES, type OrderStatus } from '@cocina-central/shared'
import { ChevronDownIcon, ListFilterIcon } from '@lucide/vue'
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** Estados seleccionados. Vacío = todos. */
const selected = defineModel<OrderStatus[]>({ required: true })

const label = computed(() => {
  const [first, ...rest] = selected.value
  if (!first) return 'Todos los estados'
  return rest.length ? `${ORDER_STATUS_LABELS[first]} +${rest.length}` : ORDER_STATUS_LABELS[first]
})

function toggle(status: OrderStatus, checked: boolean) {
  // Se mantiene el orden del ciclo de vida, no el de selección.
  selected.value = ORDER_STATUSES.filter((option) =>
    option === status ? checked : selected.value.includes(option),
  )
}

/** Evita que el menú se cierre al marcar una opción: así se pueden elegir varias seguidas. */
const keepOpen = (event: Event) => event.preventDefault()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="outline"
        class="w-56 justify-between font-normal"
        aria-label="Filtrar por estado"
      >
        <span class="flex min-w-0 items-center gap-2">
          <ListFilterIcon class="text-muted-foreground" />
          <span class="truncate">{{ label }}</span>
        </span>
        <ChevronDownIcon class="text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-56">
      <DropdownMenuCheckboxItem
        v-for="status in ORDER_STATUSES"
        :key="status"
        :model-value="selected.includes(status)"
        @update:model-value="
          (checked: boolean | 'indeterminate') => toggle(status, checked === true)
        "
        @select="keepOpen"
      >
        {{ ORDER_STATUS_LABELS[status] }}
      </DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem :disabled="selected.length === 0" @select="selected = []">
        Ver todos los estados
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
