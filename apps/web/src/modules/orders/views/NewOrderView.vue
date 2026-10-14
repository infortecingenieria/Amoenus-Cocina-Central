<script setup lang="ts">
import { formatPackage, NO_FAMILY, type ListSaleArticlesParams } from '@cocina-central/shared'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, SearchIcon } from '@lucide/vue'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/api-client'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useFamilyOptions } from '@/modules/families/composables/useFamilies'
import { useSaleArticleList } from '@/modules/sale-articles/composables/useSaleArticles'
import { useOrderCartStore } from '@/stores/order-cart'

import OrderCartSummary from '../components/OrderCartSummary.vue'
import OrderQuantityField from '../components/OrderQuantityField.vue'

const PAGE_SIZE = 24
const ALL_FAMILIES = 'all'

const cart = useOrderCartStore()

const search = ref('')
const debouncedSearch = refDebounced(search, 300)
/** `ALL_FAMILIES`, `NO_FAMILY` o el id de una familia. */
const family = ref<string>(ALL_FAMILIES)
const page = ref(1)

watch([debouncedSearch, family], () => {
  page.value = 1
})

const { data: families } = useFamilyOptions()

// La tienda solo puede pedir artículos activos.
const params = computed<ListSaleArticlesParams>(() => ({
  page: page.value,
  pageSize: PAGE_SIZE,
  active: true,
  search: debouncedSearch.value.trim() || undefined,
  familyId: family.value === ALL_FAMILIES ? undefined : family.value,
}))

const { data, isPending, isError, error, refetch } = useSaleArticleList(params)

// Si el obrador ha cambiado un precio o un nombre, el carrito se pone al día.
watch(data, (result) => result && cart.syncArticles(result.items), { immediate: true })

const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const rangeLabel = computed(() => {
  if (total.value === 0) return 'Sin resultados'
  const from = (page.value - 1) * PAGE_SIZE + 1
  const to = Math.min(page.value * PAGE_SIZE, total.value)
  return `${from}–${to} de ${total.value}`
})
</script>

<template>
  <div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
    <section class="flex flex-col gap-6 rounded-2xl bg-card p-6 shadow-sm">
      <header>
        <h1 class="text-2xl font-bold">Nuevo pedido</h1>
        <p class="text-muted-foreground">
          Elige los artículos y cuántos formatos necesitas. El obrador validará el pedido.
        </p>
      </header>

      <div class="flex flex-wrap items-center gap-3">
        <div class="relative w-full max-w-sm">
          <SearchIcon
            class="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input v-model="search" placeholder="Buscar por código o nombre" class="pl-8" />
        </div>
        <Select v-model="family">
          <SelectTrigger class="w-52" aria-label="Filtrar por familia">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL_FAMILIES">Todas las familias</SelectItem>
            <SelectItem :value="NO_FAMILY">Sin familia</SelectItem>
            <SelectItem v-for="option in families" :key="option.id" :value="option.id">
              {{ option.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div v-if="isPending" class="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        <Skeleton v-for="item in 6" :key="item" class="h-28 w-full rounded-xl" />
      </div>

      <div v-else-if="isError" class="flex flex-col items-center gap-2 py-10">
        <p class="text-destructive">{{ getErrorMessage(error) }}</p>
        <Button variant="outline" size="sm" @click="refetch()">Reintentar</Button>
      </div>

      <p v-else-if="data?.items.length === 0" class="py-10 text-center text-muted-foreground">
        No hay artículos que coincidan con la búsqueda.
      </p>

      <ul v-else class="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        <li
          v-for="article in data?.items"
          :key="article.id"
          :class="
            cn(
              'flex gap-3 rounded-xl border p-3 transition-colors',
              cart.quantityOf(article.id) > 0 && 'border-primary bg-primary/5',
            )
          "
        >
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <div class="min-w-0">
              <p class="truncate font-medium" :title="article.name">{{ article.name }}</p>
              <div
                class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
              >
                <span class="font-mono">{{ article.code }}</span>
                <Badge variant="secondary">{{
                  formatPackage(article.format, article.unitsPerFormat)
                }}</Badge>
                <span class="font-medium text-foreground tabular-nums">{{
                  formatCurrency(article.price)
                }}</span>
              </div>
            </div>

            <OrderQuantityField
              v-if="cart.quantityOf(article.id) > 0"
              :model-value="cart.quantityOf(article.id)"
              :label="`Cantidad de ${article.name}`"
              @update:model-value="(value: number) => cart.setQuantity(article, value)"
            />
            <Button
              v-else
              variant="outline"
              size="sm"
              class="w-32"
              @click="cart.setQuantity(article, 1)"
            >
              <PlusIcon />
              Añadir
            </Button>
          </div>
        </li>
      </ul>

      <footer class="flex items-center justify-end gap-3 text-sm text-muted-foreground">
        <span>{{ rangeLabel }}</span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Página anterior"
          :disabled="page <= 1"
          @click="page--"
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Página siguiente"
          :disabled="page >= totalPages"
          @click="page++"
        >
          <ChevronRightIcon />
        </Button>
      </footer>
    </section>

    <OrderCartSummary class="xl:sticky xl:top-4" />
  </div>
</template>
