import type { AuthUser, LoginInput, LoginResponse } from '@cocina-central/shared'

import { apiClient } from '@/lib/api-client'

export const authApi = {
  login: (input: LoginInput) => apiClient.post<LoginResponse>('/auth/login', input),

  me: (signal?: AbortSignal) => apiClient.get<AuthUser>('/auth/me', { signal }),
}
