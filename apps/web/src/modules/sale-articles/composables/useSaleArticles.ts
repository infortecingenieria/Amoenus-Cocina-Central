import type {
  CreateSaleArticleInput,
  ListSaleArticlesParams,
  UpdateSaleArticleInput,
} from '@cocina-central/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { saleArticlesApi } from '../api/sale-articles.api'

export const saleArticleKeys = {
  all: ['sale-articles'] as const,
  lists: () => [...saleArticleKeys.all, 'list'] as const,
  list: (params: ListSaleArticlesParams) => [...saleArticleKeys.lists(), params] as const,
  detail: (id: string) => [...saleArticleKeys.all, 'detail', id] as const,
}

export function useSaleArticleList(params: MaybeRefOrGetter<ListSaleArticlesParams>) {
  return useQuery({
    queryKey: computed(() => saleArticleKeys.list(toValue(params))),
    queryFn: ({ signal }) => saleArticlesApi.list(toValue(params), signal),
    placeholderData: keepPreviousData,
  })
}

/** Tras cualquier escritura se invalidan listados y detalles de artículos. */
function useInvalidateSaleArticles() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: saleArticleKeys.all })
}

export function useCreateSaleArticle() {
  const invalidate = useInvalidateSaleArticles()
  return useMutation({
    mutationFn: (input: CreateSaleArticleInput) => saleArticlesApi.create(input),
    onSuccess: invalidate,
  })
}

export function useUpdateSaleArticle() {
  const invalidate = useInvalidateSaleArticles()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSaleArticleInput }) =>
      saleArticlesApi.update(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteSaleArticle() {
  const invalidate = useInvalidateSaleArticles()
  return useMutation({
    mutationFn: (id: string) => saleArticlesApi.delete(id),
    onSuccess: invalidate,
  })
}
