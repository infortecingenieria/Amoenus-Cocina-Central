<script setup lang="ts">
import AppSidebar from '@/components/layout/AppSidebar.vue'
</script>

<template>
  <div class="flex min-h-svh gap-4 p-4">
    <AppSidebar class="sticky top-4 h-[calc(100svh-2rem)] w-16 shrink-0 lg:w-60" />
    <main class="min-w-0 flex-1">
      <RouterView />
    </main>
  </div>
</template>
