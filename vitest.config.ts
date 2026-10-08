import { defineConfig } from 'vitest/config'

// Agrupa los tests de todo el monorepo (lo usa la extensión Vitest de VS Code y `npx vitest` en la raíz).
// Cada proyecto mantiene su propia configuración en su carpeta.
export default defineConfig({
  test: {
    projects: ['apps/api', 'apps/web'],
  },
})
