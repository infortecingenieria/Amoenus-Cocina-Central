import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'api',
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Misma versión que producción también cuando los tests se lanzan desde la raíz del monorepo.
    env: { MONGOMS_VERSION: '9.0.2' },
    // La primera ejecución descarga el binario de MongoDB para mongodb-memory-server.
    hookTimeout: 120_000,
  },
})
