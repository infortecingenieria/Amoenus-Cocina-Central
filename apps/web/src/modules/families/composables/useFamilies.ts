import {
  MAX_PAGE_SIZE,
  type CreateFamilyInput,
  type ListFamiliesParams,
  type UpdateFamilyInput,
} from '@cocina-central/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { saleArticleKeys } from '@/modules/sale-articles/composables/useSaleArticles'

import { familiesApi } from '../api/families.api'

export const familyKeys = {
  all: ['families'] as const,
  lists: () => [...familyKeys.all, 'list'] as const,
  list: (params: ListFamiliesParams) => [...familyKeys.lists(), params] as const,
  options: () => [...familyKeys.all, 'options'] as const,
  detail: (id: string) => [...familyKeys.all, 'detail', id] as const,
}

export function useFamilyList(params: MaybeRefOrGetter<ListFamiliesParams>) {
  return useQuery({
    queryKey: computed(() => familyKeys.list(toValue(params))),
    queryFn: ({ signal }) => familiesApi.list(toValue(params), signal),
    placeholderData: keepPreviousData,
  })
}

/**
 * Todas las familias, ordenadas por nombre, para selectores y filtros. Son pocas y cambian poco:
 * se piden en una sola página y se mantienen en caché hasta que alguna se modifica.
 */
export function useFamilyOptions() {
  return useQuery({
    queryKey: familyKeys.options(),
    queryFn: async ({ signal }) =>
      (await familiesApi.list({ pageSize: MAX_PAGE_SIZE }, signal)).items,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Tras cualquier escritura se invalidan las familias y también los artículos de venta, porque
 * sus listados muestran el nombre de la familia.
 */
function useInvalidateFamilies() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: familyKeys.all }),
      queryClient.invalidateQueries({ queryKey: saleArticleKeys.all }),
    ])
}

export function useCreateFamily() {
  const invalidate = useInvalidateFamilies()
  return useMutation({
    mutationFn: (input: CreateFamilyInput) => familiesApi.create(input),
    onSuccess: invalidate,
  })
}

export function useUpdateFamily() {
  const invalidate = useInvalidateFamilies()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateFamilyInput }) =>
      familiesApi.update(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteFamily() {
  const invalidate = useInvalidateFamilies()
  return useMutation({
    mutationFn: (id: string) => familiesApi.delete(id),
    onSuccess: invalidate,
  })
}
