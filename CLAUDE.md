# Amoenus - Cocina Central

Gestor de pedidos tienda → obrador central (primer cliente: ¡La Empanadera!). Monorepo con pnpm workspaces.
Visión general y scripts en `README.md`; capas, modelo de datos y ciclo del pedido en `docs/arquitectura.md`;
integración con Amoenus Central (Portal Corporativo) en `docs/integracion-amoenus-central.md`.

Este fichero se versiona y lo comparte todo el equipo. Lo personal de cada desarrollador (entorno de su
máquina, reglas propias) va en `CLAUDE.local.md`, que está en `.gitignore`.

## Entorno

- Node 24 LTS (`.node-version`) y pnpm 11 vía Corepack (`packageManager` en `package.json`). No uses npm:
  instala siempre desde la raíz (`pnpm install`, `pnpm --filter @cocina-central/<paquete> add <dep>`).
- MongoDB local: `pnpm db:up` (Docker). Los tests usan mongodb-memory-server 9.0.2, no necesitan Docker.

## Estado actual (actualizar al avanzar)

- Hecho: monorepo, layout/menú según los mockups, CRUD completo de
  artículos de venta y de sus familias (API + web + tests; familia opcional, filtro por familia).
- Login propio con usuario y contraseña (colección `users`, JWT en `Authorization: Bearer`). Toda la
  API salvo `/auth/login` y `/health` exige sesión; las escrituras usan `app.requireRole(...)`.
  `pnpm db:seed` crea los usuarios `admin` y `tienda` (contraseñas de desarrollo en `seed.ts`).
- Integración con Amoenus Central (`modules/integrations/amoenus`): los pedidos a proveedor que hace un
  local en Amoenus llegan como solicitudes `pending` por `POST /api/v1/integrations/amoenus/orders`, con
  clave de API (`AMOENUS_API_KEY`), artículos por código y `source` en el pedido. Al aprobar se genera el
  albarán (`modules/delivery-notes`, `ALB-AAAA-NNNN`) y, si el pedido es de Amoenus, se le envía el albarán
  o el rechazo (`AmoenusSyncService`, `AMOENUS_API_URL`, reintento cada 5 min y «Reenviar a Amoenus»).
  Pendiente: si el login pasa a ser contra Amoenus (ver `docs/integracion-amoenus-central.md`).
- Pedidos (`orders`): pantalla Nuevo Pedido (tienda, sin fecha de entrega), Solicitudes (filtro
  multiestado, orden por fecha de creación, Aprobar/Editar por fila) y ficha con aprobación (ajustando
  cantidades → `modified`), rechazo con motivo y cancelación por la tienda. Sin módulo `stores` aún:
  el pedido guarda el `storeName` del usuario.
- Descartado: las pantallas Historial, Entregas e Incidencias no forman parte de la aplicación.
- Siguiente: módulo `stores`, preparación/entrega y albarán PDF (el albarán ya existe en datos).

## Reglas de código

- Contratos (esquemas Zod, tipos, enums) SOLO en `packages/shared`; API y web los importan de
  `@cocina-central/shared`.
- API: un módulo por carpeta `apps/api/src/modules/<modulo>/` con model · repository · service · schemas ·
  controller · routes (ver `sale-articles` como referencia). Los repositorios devuelven DTOs planos.
  Errores de negocio con las clases de `src/shared/errors.ts`. Rutas nuevas se registran en `apiV1Routes`
  (`app.ts`).
- Web: `apps/web/src/modules/<modulo>/` con api · composables (TanStack Query) · components · views.
  Estado de servidor → TanStack Query; estado de cliente → Pinia.
- `apps/web/src/components/ui/` lo genera shadcn-vue (`pnpm dlx shadcn-vue@latest add <x>` desde `apps/web`): no editar a mano.
- TypeScript 6 (no 7: vue-tsc/typescript-eslint no lo soportan aún).
- Antes de dar algo por terminado: `pnpm all:type-check && pnpm all:lint && pnpm all:test && pnpm all:build`.
  Los scripts raíz llevan prefijo por sección (`all:`, `api:`, `web:`, `db:`) para verse agrupados en el panel "Scripts Npm".

## Convenciones de git

- Mensajes de commit en español, minúscula: `feat: ...`, `fix: ...`, `chore: ...`.
- Sin `Co-Authored-By`, "Generated with Claude Code" ni menciones a Claude en commits o PRs.

## graphify

Si existe `graphify-out/` (es local, no se versiona), el proyecto tiene un grafo de conocimiento del código.

- Para preguntas sobre el código, primero `graphify query "<pregunta>"`; `graphify path "<A>" "<B>"` para
  relaciones y `graphify explain "<concepto>"` para un concepto concreto.
- `graphify-out/GRAPH_REPORT.md` solo para revisiones amplias de arquitectura.
- Tras modificar código, `graphify update .` para mantener el grafo al día (solo AST, sin coste).
