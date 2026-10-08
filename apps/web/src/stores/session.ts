import { USER_ROLE_LABELS, type AuthUser, type LoginInput, type UserRole } from '@cocina-central/shared'
import { StorageSerializers, useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

import { queryClient } from '@/lib/query-client'
import { authApi } from '@/modules/auth/api/auth.api'

const TOKEN_KEY = 'cocina-central:token'
const USER_KEY = 'cocina-central:user'

/**
 * Sesión del usuario: token JWT y datos del usuario, guardados en localStorage para mantener la
 * sesión al recargar. La API valida el token en cada petición; si caduca responde 401 y
 * `main.ts` cierra la sesión.
 */
export const useSessionStore = defineStore('session', () => {
  const token = useLocalStorage<string | null>(TOKEN_KEY, null)
  const storedUser = useLocalStorage<AuthUser | null>(USER_KEY, null, {
    serializer: StorageSerializers.object,
  })

  const isAuthenticated = computed(() => token.value !== null && storedUser.value !== null)

  const user = computed(() => storedUser.value)
  const roleLabel = computed(() => (storedUser.value ? USER_ROLE_LABELS[storedUser.value.role] : ''))
  const isKitchenAdmin = computed(() => storedUser.value?.role === 'kitchen_admin')

  const hasRole = (roles?: readonly UserRole[]): boolean =>
    !roles || (storedUser.value !== null && roles.includes(storedUser.value.role))

  async function login(input: LoginInput) {
    const response = await authApi.login(input)
    token.value = response.token
    storedUser.value = response.user
  }

  /** Actualiza los datos del usuario desde la API (p. ej. si ha cambiado su rol). */
  async function refreshUser() {
    if (!token.value) return
    storedUser.value = await authApi.me()
  }

  function logout() {
    token.value = null
    storedUser.value = null
    // Que el siguiente usuario no vea datos cacheados del anterior.
    queryClient.clear()
  }

  return {
    token,
    user,
    isAuthenticated,
    roleLabel,
    isKitchenAdmin,
    hasRole,
    login,
    refreshUser,
    logout,
  }
})
