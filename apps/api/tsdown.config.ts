import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/server.ts'],
  platform: 'node',
  format: 'esm',
  sourcemap: true,
  // El paquete compartido se publica como código TypeScript: hay que incluirlo en el bundle.
  deps: {
    alwaysBundle: ['@cocina-central/shared'],
  },
})
