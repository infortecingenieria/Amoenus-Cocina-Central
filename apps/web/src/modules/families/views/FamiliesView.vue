<script setup lang="ts">
import type { Family, ListFamiliesParams } from '@cocina-central/shared'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
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
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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

import FamilyFormDialog from '../components/FamilyFormDialog.vue'
import { useDeleteFamily, useFamilyList } from '../composables/useFamilies'

const PAGE_SIZE = 20
const COLUMNS = 2

const search = ref('')
const debouncedSearch = refDebounced(search, 300)
const page = ref(1)

watch(debouncedSearch, () => {
  page.value = 1
})

const params = computed<ListFamiliesParams>(() => ({
  page: page.value,
  pageSize: PAGE_SIZE,
  search: debouncedSearch.value.trim() || undefined,
}))

const { data, isPending, isError, error, refetch } = useFamilyList(params)

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
const editing = ref<Family | null>(null)

function openCreate() {
  editing.value = null
  formOpen.value = true
}

function openEdit(family: Family) {
  editing.value = family
  formOpen.value = true
}

// Borrado con confirmación (la API lo rechaza si la familia tiene artículos)
const deleteMutation = useDeleteFamily()
const deleting = ref<Family | null>(null)

async function confirmDelete() {
  if (!deleting.value) return
  const family = deleting.value
  try {
    await deleteMutation.mutateAsync(family.id)
    toast.success(`${family.name} eliminada`)
  } catch (err) {
    toast.error(getErrorMessage(err))
  } finally {
    deleting.value = null
  }
}
</script>

<template>
  <section class="flex flex-col gap-6 rounded-2xl bg-card p-6 shadow-sm">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">Familias</h1>
        <p class="text-muted-foreground">Agrupación de los artículos de venta del obrador.</p>
      </div>
      <Button @click="openCreate">
        <PlusIcon />
        Nueva familia
      </Button>
    </header>

    <div class="relative w-full max-w-sm">
      <SearchIcon class="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input v-model="search" placeholder="Buscar por nombre" class="pl-8" />
    </div>

    <div class="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow class="bg-muted/50">
            <TableHead>Nombre</TableHead>
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
            No hay familias que coincidan con la búsqueda.
          </TableEmpty>

          <TableRow v-for="family in data?.items" v-else :key="family.id">
            <TableCell class="font-medium">{{ family.name }}</TableCell>
            <TableCell class="text-right">
              <div class="flex justify-end gap-2">
                <Button variant="outline" size="sm" @click="openEdit(family)">
                  <PencilIcon />
                  Editar
                </Button>
                <Button variant="destructive" size="sm" @click="deleting = family">
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

    <FamilyFormDialog v-model:open="formOpen" :family="editing" />

    <AlertDialog
      :open="deleting !== null"
      @update:open="(value: boolean) => !value && (deleting = null)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar la familia «{{ deleting?.name }}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Solo se pueden eliminar familias sin artículos. Si tiene alguno, cámbialo antes de
            familia o déjalo sin familia.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleteMutation.isPending.value">Cancelar</AlertDialogCancel>
          <!-- Button y no AlertDialogAction: este cierra el diálogo (y limpia `deleting`) antes de
               que se ejecute `confirmDelete`. -->
          <Button
            class="bg-destructive text-white hover:bg-destructive/90"
            :disabled="deleteMutation.isPending.value"
            @click="confirmDelete"
          >
            Eliminar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>
