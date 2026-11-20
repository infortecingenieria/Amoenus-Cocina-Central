<script setup lang="ts">
import {
  formatPackage,
  NO_FAMILY,
  type ListSaleArticlesParams,
  type SaleArticle,
} from '@cocina-central/shared'
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from '@lucide/vue'
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

/**
 * Catálogo de artículos activos para pedir: búsqueda, familia, tarjetas y paginación. Qué se hace
 * con cada artículo lo decide quien lo usa, en el slot `action`.
 */
const props = withDefaults(
  defineProps<{
    /** Artículos ya elegidos: su tarjeta se destaca. */
    selectedIds?: readonly string[]
    pageSize?: number
    /** Clases de la rejilla de tarjetas (columnas según el espacio disponible). */
    gridClass?: string
  }>(),
  { selectedIds: () => [], pageSize: 24, gridClass: 'sm:grid-cols-2 2xl:grid-cols-3' },
)
const emit = defineEmits<{
  /** Artículos de la página cargada (p. ej. para poner al día precios y nombres del carrito). */
  loaded: [articles: SaleArticle[]]
}>()
defineSlots<{ action(props: { article: SaleArticle; selected: boolean }): unknown }>()

const ALL_FAMILIES = 'all'

const search = ref('')
const debouncedSearch = refDebounced(search, 300)
/** `ALL_FAMILIES`, `NO_FAMILY` o el id de una familia. */
const family = ref<string>(ALL_FAMILIES)
const page = ref(1)

watch([debouncedSearch, family], () => {
  page.value = 1
})

const { data: families } = useFamilyOptions()

// Solo se pueden pedir artículos activos.
const params = computed<ListSaleArticlesParams>(() => ({
  page: page.value,
  pageSize: props.pageSize,
  active: true,
  search: debouncedSearch.value.trim() || undefined,
  familyId: family.value === ALL_FAMILIES ? undefined : family.value,
}))

const { data, isPending, isError, error, refetch } = useSaleArticleList(params)

watch(data, (result) => result && emit('loaded', result.items), { immediate: true })

const isSelected = (id: string) => props.selectedIds.includes(id)

const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / props.pageSize)))
const rangeLabel = computed(() => {
  if (total.value === 0) return 'Sin resultados'
  const from = (page.value - 1) * props.pageSize + 1
  const to = Math.min(page.value * props.pageSize, total.value)
  return `${from}–${to} de ${total.value}`
})
</script>

<template>
  <div class="flex flex-col gap-6">
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

    <div v-if="isPending" :class="cn('grid gap-3', gridClass)">
      <Skeleton v-for="item in 6" :key="item" class="h-28 w-full rounded-xl" />
    </div>

    <div v-else-if="isError" class="flex flex-col items-center gap-2 py-10">
      <p class="text-destructive">{{ getErrorMessage(error) }}</p>
      <Button variant="outline" size="sm" @click="refetch()">Reintentar</Button>
    </div>

    <p v-else-if="data?.items.length === 0" class="py-10 text-center text-muted-foreground">
      No hay artículos que coincidan con la búsqueda.
    </p>

    <ul v-else :class="cn('grid gap-3', gridClass)">
      <li
        v-for="article in data?.items"
        :key="article.id"
        :class="
          cn(
            'flex gap-3 rounded-xl border p-3 transition-colors',
            isSelected(article.id) && 'border-primary bg-primary/5',
          )
        "
      >
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <div class="min-w-0">
            <p class="truncate font-medium" :title="article.name">{{ article.name }}</p>
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span class="font-mono">{{ article.code }}</span>
              <Badge variant="secondary">{{
                formatPackage(article.format, article.unitsPerFormat)
              }}</Badge>
              <span class="font-medium text-foreground tabular-nums">{{
                formatCurrency(article.price)
              }}</span>
            </div>
          </div>

          <slot name="action" :article="article" :selected="isSelected(article.id)" />
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
  </div>
</template>
