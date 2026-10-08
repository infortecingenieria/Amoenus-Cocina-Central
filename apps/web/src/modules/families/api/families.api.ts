import type {
  CreateFamilyInput,
  Family,
  ListFamiliesParams,
  Paginated,
  UpdateFamilyInput,
} from '@cocina-central/shared'

import { apiClient } from '@/lib/api-client'

const BASE_PATH = '/families'

export const familiesApi = {
  list: (params: ListFamiliesParams, signal?: AbortSignal) =>
    apiClient.get<Paginated<Family>>(BASE_PATH, { query: { ...params }, signal }),

  getById: (id: string, signal?: AbortSignal) =>
    apiClient.get<Family>(`${BASE_PATH}/${id}`, { signal }),

  create: (input: CreateFamilyInput) => apiClient.post<Family>(BASE_PATH, input),

  update: (id: string, input: UpdateFamilyInput) =>
    apiClient.patch<Family>(`${BASE_PATH}/${id}`, input),

  delete: (id: string) => apiClient.delete(`${BASE_PATH}/${id}`),
}
