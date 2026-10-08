<script setup lang="ts">
import { USER_ROLE_LABELS, USER_ROLES, type UserRole } from '@cocina-central/shared'
import { LogOutIcon } from '@lucide/vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import logoUrl from '@/assets/brand/logo-la-empanadera.svg'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { NAV_ITEMS } from '@/config/navigation'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
const route = useRoute()
const router = useRouter()
const isDev = import.meta.env.DEV

const items = computed(() =>
  NAV_ITEMS.filter((item) => session.hasRole(item.roles)).map((item) => {
    const path = router.resolve({ name: item.route }).path
    return { ...item, path, active: route.path === path || route.path.startsWith(`${path}/`) }
  }),
)

const initials = computed(() =>
  session.user.displayName
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
)

function onSwitchRole(role: unknown) {
  session.switchRole(role as UserRole)
  router.push({ name: 'home' })
}

function logout() {
  // TODO(auth): cerrar sesión cuando exista autenticación.
  toast.info('El cierre de sesión llegará con la integración de usuarios de Amoenus Central')
}
</script>

<template>
  <aside class="flex flex-col rounded-2xl bg-sidebar p-2 shadow-sm lg:p-3">
    <RouterLink :to="{ name: 'home' }" class="mb-4 flex justify-center pt-2 lg:mb-6">
      <img :src="logoUrl" alt="¡La Empanadera!" class="h-12 w-auto lg:h-28" />
    </RouterLink>

    <nav class="flex flex-col gap-1" aria-label="Navegación principal">
      <RouterLink
        v-for="item in items"
        :key="item.route"
        :to="item.path"
        :title="item.label"
        :aria-current="item.active ? 'page' : undefined"
        :class="
          cn(
            'flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors hover:bg-muted lg:justify-start',
            item.active &&
              'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent',
          )
        "
      >
        <component :is="item.icon" class="size-5 shrink-0" />
        <span class="hidden lg:inline">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <div class="mt-auto flex flex-col gap-2 rounded-xl border p-2 lg:p-3">
      <div class="flex items-center gap-3">
        <Avatar class="size-9">
          <AvatarFallback>{{ initials }}</AvatarFallback>
        </Avatar>
        <div class="hidden min-w-0 lg:block">
          <p class="truncate text-sm font-semibold">{{ session.user.displayName }}</p>
          <p v-if="session.isKitchenAdmin" class="truncate text-xs text-muted-foreground">
            {{ session.roleLabel }}
          </p>
          <p v-else class="text-xs text-primary">Conectado</p>
        </div>
      </div>

      <Select v-if="isDev" :model-value="session.user.role" @update:model-value="onSwitchRole">
        <SelectTrigger size="sm" class="hidden w-full lg:flex" title="Solo en desarrollo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="role in USER_ROLES" :key="role" :value="role">
            Ver como: {{ USER_ROLE_LABELS[role] }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" title="Cerrar sesión" @click="logout">
        <LogOutIcon />
        <span class="hidden lg:inline">Cerrar sesión</span>
      </Button>
    </div>
  </aside>
</template>
