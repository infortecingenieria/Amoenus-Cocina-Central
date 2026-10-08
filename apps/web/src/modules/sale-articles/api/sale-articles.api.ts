import type {
  CreateSaleArticleInput,
  ListSaleArticlesParams,
  Paginated,
  SaleArticle,
  UpdateSaleArticleInput,
} from '@cocina-central/shared'

import { apiClient } from '@/lib/api-client'

const BASE_PATH = '/sale-articles'

export const saleArticlesApi = {
  list: (params: ListSaleArticlesParams, signal?: AbortSignal) =>
    apiClient.get<Paginated<SaleArticle>>(BASE_PATH, { query: { ...params }, signal }),

  getById: (id: string, signal?: AbortSignal) =>
    apiClient.get<SaleArticle>(`${BASE_PATH}/${id}`, { signal }),

  create: (input: CreateSaleArticleInput) => apiClient.post<SaleArticle>(BASE_PATH, input),

  update: (id: string, input: UpdateSaleArticleInput) =>
    apiClient.patch<SaleArticle>(`${BASE_PATH}/${id}`, input),

  delete: (id: string) => apiClient.delete(`${BASE_PATH}/${id}`),
}
