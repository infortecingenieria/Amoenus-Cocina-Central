import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // La primera ejecución descarga el binario de MongoDB para mongodb-memory-server.
    hookTimeout: 120_000,
  },
})
