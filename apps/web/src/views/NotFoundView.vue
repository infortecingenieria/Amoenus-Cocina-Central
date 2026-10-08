<script setup lang="ts">
import { Button } from '@/components/ui/button'
</script>

<template>
  <main class="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
    <p class="text-6xl font-bold text-muted-foreground">404</p>
    <h1 class="text-xl font-semibold">Página no encontrada</h1>
    <Button as-child>
      <RouterLink :to="{ name: 'home' }">Volver al inicio</RouterLink>
    </Button>
  </main>
</template>
