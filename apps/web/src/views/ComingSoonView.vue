<script setup lang="ts">
import { HardHatIcon } from '@lucide/vue'
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <section
    class="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 rounded-2xl bg-card p-10 text-center shadow-sm"
  >
    <HardHatIcon class="size-10 text-muted-foreground" />
    <h1 class="text-2xl font-bold">{{ route.meta.title }}</h1>
    <p class="max-w-md text-muted-foreground">
      {{ route.meta.description ?? 'Sección pendiente de desarrollo.' }}
    </p>
  </section>
</template>
