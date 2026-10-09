<script setup lang="ts">
import { ChevronDownIcon, LogOutIcon } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import logoUrl from '@/assets/brand/logo-la-empanadera.svg'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { NAV_SECTIONS } from '@/config/navigation'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
const route = useRoute()
const router = useRouter()

const displayName = computed(() => session.user?.displayName ?? '')

const sections = computed(() =>
  NAV_SECTIONS.map((section, index) => {
    const items = section.items
      .filter((item) => session.hasRole(item.roles))
      .map((item) => {
        const path = router.resolve({ name: item.route }).path
        return { ...item, path, active: route.path === path || route.path.startsWith(`${path}/`) }
      })
    return {
      ...section,
      id: `nav-section-${index}`,
      items,
      hasActiveItem: items.some((item) => item.active),
    }
  }).filter((section) => section.items.length > 0),
)

// Desplegables con título: plegados por defecto. Al entrar en una de sus opciones (también al
// recargar en ella) se abren, para que la opción actual no quede escondida.
const openSections = ref(new Set<string>())

watch(
  () => sections.value.filter((section) => section.hasActiveItem).map((section) => section.id),
  (activeIds) => activeIds.forEach((id) => openSections.value.add(id)),
  { immediate: true },
)

const isOpen = (id: string) => openSections.value.has(id)

function toggleSection(id: string) {
  if (!openSections.value.delete(id)) openSections.value.add(id)
}

const linkClass = (active: boolean) =>
  cn(
    'flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors hover:bg-muted lg:justify-start',
    active && 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent',
  )

const initials = computed(() =>
  displayName.value
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
)

async function logout() {
  session.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <aside class="flex flex-col rounded-2xl bg-sidebar p-2 shadow-sm lg:p-3">
    <RouterLink :to="{ name: 'home' }" class="mb-4 flex justify-center pt-2 lg:mb-6">
      <img :src="logoUrl" alt="¡La Empanadera!" class="h-12 w-auto lg:h-28" />
    </RouterLink>

    <nav class="flex flex-col gap-1" aria-label="Navegación principal">
      <template v-for="section in sections" :key="section.id">
        <!-- Sección sin título: opciones siempre visibles. -->
        <template v-if="!section.label">
          <RouterLink
            v-for="item in section.items"
            :key="item.route"
            :to="item.path"
            :title="item.label"
            :aria-current="item.active ? 'page' : undefined"
            :class="linkClass(item.active)"
          >
            <component :is="item.icon" class="size-5 shrink-0" />
            <span class="hidden lg:inline">{{ item.label }}</span>
          </RouterLink>
        </template>

        <!-- Sección con título: desplegable. -->
        <div v-else class="flex flex-col gap-1">
          <button
            type="button"
            :title="section.label"
            :aria-expanded="isOpen(section.id)"
            :aria-controls="section.id"
            :class="
              cn(
                linkClass(false),
                // Plegada con la opción actual dentro: se marca la cabecera para no perder el contexto.
                !isOpen(section.id) && section.hasActiveItem && 'text-sidebar-accent-foreground',
              )
            "
            @click="toggleSection(section.id)"
          >
            <component :is="section.icon" v-if="section.icon" class="size-5 shrink-0" />
            <span class="hidden flex-1 text-left lg:inline">{{ section.label }}</span>
            <ChevronDownIcon
              :class="
                cn(
                  'hidden size-4 shrink-0 text-muted-foreground transition-transform lg:block',
                  isOpen(section.id) && 'rotate-180',
                )
              "
            />
          </button>

          <div
            v-show="isOpen(section.id)"
            :id="section.id"
            role="group"
            :aria-label="section.label"
            class="flex flex-col gap-1 lg:ml-4 lg:border-l lg:pl-2"
          >
            <RouterLink
              v-for="item in section.items"
              :key="item.route"
              :to="item.path"
              :title="item.label"
              :aria-current="item.active ? 'page' : undefined"
              :class="linkClass(item.active)"
            >
              <component :is="item.icon" class="size-5 shrink-0" />
              <span class="hidden lg:inline">{{ item.label }}</span>
            </RouterLink>
          </div>
        </div>
      </template>
    </nav>

    <div class="mt-auto flex flex-col gap-2 rounded-xl border p-2 lg:p-3">
      <div class="flex items-center gap-3">
        <Avatar class="size-9">
          <AvatarFallback>{{ initials }}</AvatarFallback>
        </Avatar>
        <div class="hidden min-w-0 lg:block">
          <p class="truncate text-sm font-semibold">{{ displayName }}</p>
          <p v-if="session.isKitchenAdmin" class="truncate text-xs text-muted-foreground">
            {{ session.roleLabel }}
          </p>
          <p v-else class="text-xs text-primary">Conectado</p>
        </div>
      </div>

      <Button variant="outline" size="sm" title="Cerrar sesión" @click="logout">
        <LogOutIcon />
        <span class="hidden lg:inline">Cerrar sesión</span>
      </Button>
    </div>
  </aside>
</template>
