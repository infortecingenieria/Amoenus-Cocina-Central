<script setup lang="ts">
import {
  formatPackage,
  type ListSaleArticlesParams,
  type SaleArticle,
} from '@cocina-central/shared'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CroissantIcon,
  Link2Icon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from '@lucide/vue'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getErrorMessage } from '@/lib/api-client'
import { formatCurrency } from '@/lib/format'

import SaleArticleFormDialog from '../components/SaleArticleFormDialog.vue'
import {
  useDeleteSaleArticle,
  useSaleArticleList,
  useUpdateSaleArticle,
} from '../composables/useSaleArticles'

const PAGE_SIZE = 20
const COLUMNS = 7

type StatusFilter = 'all' | 'active' | 'inactive'

const search = ref('')
const debouncedSearch = refDebounced(search, 300)
const status = ref<StatusFilter>('all')
const page = ref(1)

watch([debouncedSearch, status], () => {
  page.value = 1
})

const params = computed<ListSaleArticlesParams>(() => ({
  page: page.value,
  pageSize: PAGE_SIZE,
  search: debouncedSearch.value.trim() || undefined,
  active: status.value === 'all' ? undefined : status.value === 'active',
}))

const { data, isPending, isError, error, refetch } = useSaleArticleList(params)

const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const rangeLabel = computed(() => {
  if (total.value === 0) return 'Sin resultados'
  const from = (page.value - 1) * PAGE_SIZE + 1
  const to = Math.min(page.value * PAGE_SIZE, total.value)
  return `${from}–${to} de ${total.value}`
})

// Alta / edición
const formOpen = ref(false)
const editing = ref<SaleArticle | null>(null)

function openCreate() {
  editing.value = null
  formOpen.value = true
}

function openEdit(article: SaleArticle) {
  editing.value = article
  formOpen.value = true
}

// Activar / desactivar desde la tabla
const updateMutation = useUpdateSaleArticle()

function toggleActive(article: SaleArticle, active: boolean) {
  updateMutation.mutate(
    { id: article.id, input: { active } },
    {
      onSuccess: () => toast.success(`${article.name} ${active ? 'activado' : 'desactivado'}`),
      onError: (err) => toast.error(getErrorMessage(err)),
    },
  )
}

// Borrado con confirmación
const deleteMutation = useDeleteSaleArticle()
const deleting = ref<SaleArticle | null>(null)

async function confirmDelete() {
  if (!deleting.value) return
  const article = deleting.value
  try {
    await deleteMutation.mutateAsync(article.id)
    toast.success(`${article.name} eliminado`)
    deleting.value = null
  } catch (err) {
    toast.error(getErrorMessage(err))
  }
}
</script>

<template>
  <section class="flex flex-col gap-6 rounded-2xl bg-card p-6 shadow-sm">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">Artículos de venta</h1>
        <p class="text-muted-foreground">Catálogo que ven las tiendas al hacer un pedido.</p>
      </div>
      <Button @click="openCreate">
        <PlusIcon />
        Nuevo artículo
      </Button>
    </header>

    <div class="flex flex-wrap items-center gap-3">
      <div class="relative w-full max-w-sm">
        <SearchIcon
          class="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input v-model="search" placeholder="Buscar por código o nombre" class="pl-8" />
      </div>
      <Select v-model="status">
        <SelectTrigger class="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="active">Activos</SelectItem>
          <SelectItem value="inactive">Inactivos</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow class="bg-muted/50">
            <TableHead class="w-16" />
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Formato</TableHead>
            <TableHead class="text-right">Precio</TableHead>
            <TableHead>Activo</TableHead>
            <TableHead class="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <template v-if="isPending">
            <TableRow v-for="row in 5" :key="row">
              <TableCell v-for="col in COLUMNS" :key="col"
                ><Skeleton class="h-6 w-full"
              /></TableCell>
            </TableRow>
          </template>

          <TableEmpty v-else-if="isError" :colspan="COLUMNS">
            <div class="flex flex-col items-center gap-2">
              <p class="text-destructive">{{ getErrorMessage(error) }}</p>
              <Button variant="outline" size="sm" @click="refetch()">Reintentar</Button>
            </div>
          </TableEmpty>

          <TableEmpty v-else-if="data?.items.length === 0" :colspan="COLUMNS">
            No hay artículos que coincidan con la búsqueda.
          </TableEmpty>

          <TableRow v-for="article in data?.items" v-else :key="article.id">
            <TableCell>
              <img
                v-if="article.imageUrl"
                :src="article.imageUrl"
                :alt="article.name"
                class="size-10 rounded-md object-cover"
              />
              <div v-else class="flex size-10 items-center justify-center rounded-md bg-muted">
                <CroissantIcon class="size-5 text-muted-foreground" />
              </div>
            </TableCell>
            <TableCell class="font-mono text-sm">{{ article.code }}</TableCell>
            <TableCell>
              <div class="flex items-center gap-2 font-medium">
                {{ article.name }}
                <Link2Icon
                  v-if="article.amoenusSaleItemId"
                  class="size-4 text-muted-foreground"
                  aria-label="Vinculado con Amoenus Central"
                />
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{{
                formatPackage(article.format, article.unitsPerFormat)
              }}</Badge>
            </TableCell>
            <TableCell class="text-right tabular-nums">{{
              formatCurrency(article.price)
            }}</TableCell>
            <TableCell>
              <Switch
                :model-value="article.active"
                :aria-label="`Activar ${article.name}`"
                @update:model-value="(value: boolean) => toggleActive(article, value)"
              />
            </TableCell>
            <TableCell class="text-right">
              <div class="flex justify-end gap-2">
                <Button variant="outline" size="sm" @click="openEdit(article)">
                  <PencilIcon />
                  Editar
                </Button>
                <Button variant="destructive" size="sm" @click="deleting = article">
                  <Trash2Icon />
                  Eliminar
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

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

    <SaleArticleFormDialog v-model:open="formOpen" :article="editing" />

    <AlertDialog
      :open="deleting !== null"
      @update:open="(value: boolean) => !value && (deleting = null)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar «{{ deleting?.name }}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. Si solo quieres que las tiendas dejen de verlo,
            desactívalo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleteMutation.isPending.value">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-white hover:bg-destructive/90"
            :disabled="deleteMutation.isPending.value"
            @click.prevent="confirmDelete"
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>
