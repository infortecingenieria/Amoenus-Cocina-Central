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
| Calidad                       | TypeScript 6, ESLint 10 (+ oxlint en web), Prettier, Vitest 4, pnpm 11 (workspaces), mongodb-memory-server                          |

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

Requisitos: **Node 24 LTS** (`.node-version`), **pnpm 11** y Docker para MongoDB.
pnpm se activa con Corepack, que viene con Node: `corepack enable` (la versión exacta la fija
`packageManager` en `package.json`).

```bash
fnm use                         # o nvm use: Node 24
corepack enable                 # una sola vez por máquina
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:up                      # MongoDB 9 en localhost:27017
pnpm db:seed                    # artículos de ejemplo (se puede repetir sin duplicar)
pnpm all:dev                    # API en :3000 y web en :5173
```

- Web: http://localhost:5173 (Vite reenvía `/api` a la API).
- API: http://localhost:3000/api/v1 · salud en `/health` · OpenAPI en http://localhost:3000/docs

Mientras no haya autenticación, en desarrollo el pie del menú permite cambiar entre el rol
**Tienda** y **Admin Central / Obrador** para revisar las pantallas de cada uno.

## Scripts (raíz)

Los scripts llevan prefijo por sección (`all:`, `api:`, `web:`, `db:`) para verse agrupados en VS Code.

| Script                   | Qué hace                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `pnpm all:dev`           | API y web en paralelo con recarga en caliente                                      |
| `pnpm all:build`         | Compila la API (`apps/api/dist/server.mjs`) y la web (`apps/web/dist`)             |
| `pnpm all:type-check`    | Comprobación de tipos en los tres paquetes                                         |
| `pnpm all:lint`          | ESLint (y oxlint en web) con autofix                                               |
| `pnpm all:test`          | Tests de API (Mongo en memoria) y web                                              |
| `pnpm all:format`        | Prettier en todo el repo (`all:format-check` solo comprueba)                       |
| `pnpm api:dev`           | Solo la API                                                                        |
| `pnpm web:dev`           | Solo la web                                                                        |
| `pnpm db:up` / `db:down` | Arranca / para MongoDB en Docker                                                   |
| `pnpm db:seed`           | Carga datos de ejemplo en la base local (idempotente; no se ejecuta en producción) |

Para un paquete concreto: `pnpm --filter @cocina-central/api <script>` (o `web`, `shared`).
Para añadir una dependencia a un paquete: `pnpm --filter @cocina-central/web add <paquete>`.
Instala siempre desde la raíz: es un monorepo con _pnpm workspaces_ (`pnpm-workspace.yaml`).

## Despliegue en producción (Docker)

Solo la API va en Docker: `apps/api/Dockerfile` (Node, usuario sin privilegios, healthcheck a
`/health`), construida desde la raíz del monorepo. La web se despliega aparte como estáticos
(`apps/web/dist`, compilada con `VITE_API_BASE_URL` apuntando a la API). MongoDB va aparte, gestionado
y con autenticación.

1. Crea `apps/api/.env.production` (no se versiona) a partir de `apps/api/.env.example`, con al menos:
   `MONGODB_URI`, `JWT_SECRET` aleatorio, `CORS_ORIGINS` (dominio de la web), `AMOENUS_API_URL`
   (gateway de Amoenus, con `/api`) y `AMOENUS_API_KEY` (la misma que tenga Amoenus en
   `cocinacentralconfigs` y `cocinacentralsaleconfigs`). `NODE_ENV=production` y
   `API_DOCS_ENABLED=false` ya vienen en la imagen.
2. `docker compose -f docker-compose.prod.yml up -d --build` (o, sin compose:
   `docker build -f apps/api/Dockerfile -t infortec/cocina-central-backend:v1.0.0 .` desde la raíz).
   La API queda en el puerto 3000.
3. Pon delante el proxy con HTTPS del servidor apuntando a ese puerto.

- La web (estáticos de `apps/web/dist`) se publica en Netlify. El router usa rutas sin `#`, así que
  `apps/web/public/_redirects` (copiado a `dist/` en el build) sirve `index.html` en cualquier ruta:
  sin él, recargar en `/solicitudes` o abrir `/login` da el 404 de Netlify. `CORS_ORIGINS` de la API
  debe incluir el dominio de la web.
- Una sola instancia de la API: la cola de tickets a Amoenus está en memoria (no escalar con réplicas).
- No ejecutes `pnpm db:seed` contra producción: los usuarios reales se dan de alta aparte.

## Documentación

- [Arquitectura y modelo de datos](docs/arquitectura.md)
- [Integración con Amoenus Central](docs/integracion-amoenus-central.md) (decisiones pendientes)
