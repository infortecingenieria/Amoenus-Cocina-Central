# Amoenus - Cocina Central

Gestor de pedidos de las tiendas al obrador central (primer cliente: **¡La Empanadera!**).
Las tiendas hacen su pedido diario, el obrador lo valida (ajustando cantidades si hace falta),
lo aprueba o lo rechaza y genera el albarán de entrega.

## Stack

| Capa                          | Tecnología                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Front (`apps/web`)            | Vue 3.5 + TypeScript, Vite 8, Pinia 4, Vue Router 5, TanStack Query 5, Tailwind CSS 4, shadcn-vue (reka-ui), Lucide (`@lucide/vue`) |
| API (`apps/api`)              | Node 24 LTS, Fastify 5, Mongoose 9, Zod 4 (`fastify-type-provider-zod`), OpenAPI en `/docs`                                         |
| Contratos (`packages/shared`) | Esquemas Zod, tipos y enumerados compartidos entre API y front                                                                      |
| Base de datos                 | MongoDB 9.0                                                                                                                         |
| Calidad                       | TypeScript 6, ESLint 10 (+ oxlint en web), Prettier, Vitest 4, mongodb-memory-server                                                |

> TypeScript 7 (compilador nativo) aún no es compatible con `vue-tsc` ni `typescript-eslint`;
> se usa la rama 6.0, que es la que fija `create-vue`.

## Estructura

```
apps/
  api/                 API Fastify
    src/
      config/          variables de entorno validadas con Zod
      database/        conexión a MongoDB
      plugins/         manejador de errores, OpenAPI
      shared/          errores de negocio y utilidades HTTP
      modules/<modulo>/  model · repository · service · schemas · controller · routes
    test/              tests de integración (Fastify inject + Mongo en memoria)
  web/                 SPA Vue
    src/
      components/ui/   componentes generados por shadcn-vue (no editar a mano)
      components/layout/, layouts/, views/
      modules/<modulo>/  api · composables (TanStack Query) · components · views
      stores/          Pinia (sesión)
      lib/             cliente HTTP, QueryClient, formateo
packages/
  shared/              contratos compartidos (@cocina-central/shared)
docs/                  arquitectura e integración con Amoenus Central
```

## Puesta en marcha

Requisitos: **Node 24 LTS** (`.node-version`) y Docker para MongoDB.

```bash
fnm use                         # o nvm use: Node 24
npm install
cp apps/api/.env.example apps/api/.env
npm run db:up                   # MongoDB 9 en localhost:27017
npm run dev                     # API en :3000 y web en :5173
```

- Web: http://localhost:5173 (Vite reenvía `/api` a la API).
- API: http://localhost:3000/api/v1 · salud en `/health` · OpenAPI en http://localhost:3000/docs

Mientras no haya autenticación, en desarrollo el pie del menú permite cambiar entre el rol
**Tienda** y **Admin Central / Obrador** para revisar las pantallas de cada uno.

## Scripts (raíz)

| Script                      | Qué hace                                                               |
| --------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`               | API y web en paralelo con recarga en caliente                          |
| `npm run build`             | Compila la API (`apps/api/dist/server.mjs`) y la web (`apps/web/dist`) |
| `npm run type-check`        | Comprobación de tipos en los tres paquetes                             |
| `npm run lint`              | ESLint (y oxlint en web) con autofix                                   |
| `npm test`                  | Tests de API (Mongo en memoria) y web                                  |
| `npm run format`            | Prettier en todo el repo                                               |
| `npm run db:up` / `db:down` | Arranca / para MongoDB en Docker                                       |

Para un paquete concreto: `npm run <script> -w @cocina-central/api` (o `web`, `shared`).

## Documentación

- [Arquitectura y modelo de datos](docs/arquitectura.md)
- [Integración con Amoenus Central](docs/integracion-amoenus-central.md) (decisiones pendientes)
