import { USER_ROLE_LABELS, type UserRole } from '@cocina-central/shared'
import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

export interface SessionUser {
  displayName: string
  role: UserRole
  /** Tienda a la que pertenece el usuario (null para el obrador). */
  storeName: string | null
}

// TODO(auth): usuarios fijos hasta decidir cómo se autentica contra Amoenus Central
// (ver docs/integracion-amoenus-central.md). Permiten revisar las pantallas de cada rol.
const DEV_USERS: Record<UserRole, SessionUser> = {
  store: { displayName: 'Tienda Mayor', role: 'store', storeName: 'Tienda Mayor' },
  kitchen_admin: { displayName: 'Admin', role: 'kitchen_admin', storeName: null },
}

export const useSessionStore = defineStore('session', () => {
  const role = useLocalStorage<UserRole>('cocina-central:dev-role', 'store')

  const user = computed(() => DEV_USERS[role.value] ?? DEV_USERS.store)
  const roleLabel = computed(() => USER_ROLE_LABELS[user.value.role])
  const isKitchenAdmin = computed(() => user.value.role === 'kitchen_admin')

  const hasRole = (roles?: readonly UserRole[]): boolean =>
    !roles || roles.includes(user.value.role)

  function switchRole(next: UserRole) {
    role.value = next
  }

  return { user, roleLabel, isKitchenAdmin, hasRole, switchRole }
})
