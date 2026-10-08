# Amoenus - Cocina Central

Gestor de pedidos tienda → obrador central (primer cliente: ¡La Empanadera!). Monorepo npm workspaces.
Visión general y scripts en `README.md`; capas, modelo de datos y ciclo del pedido en `docs/arquitectura.md`;
integración con Amoenus Central (Portal Corporativo) en `docs/integracion-amoenus-central.md`.

Este fichero se versiona y lo comparte todo el equipo. Lo personal de cada desarrollador (entorno de su
máquina, reglas propias) va en `CLAUDE.local.md`, que está en `.gitignore`.

## Entorno
- Node 24 LTS (`.node-version`).
- MongoDB local: `npm run db:up` (Docker). Los tests usan mongodb-memory-server 9.0.2, no necesitan Docker.

## Estado actual (actualizar al avanzar)
- Hecho: monorepo, layout/menú según los mockups, router con secciones provisionales, CRUD completo de
  artículos de venta (API + web + tests).
- Sin autenticación: el front usa usuarios de prueba (`apps/web/src/stores/session.ts`) con selector de rol
  en desarrollo.
- Pendiente de decidir: integración con Amoenus Central y login (ver preguntas abiertas en
  `docs/integracion-amoenus-central.md`). Logo de ¡La Empanadera! provisional.
- Siguiente: módulos `stores` y `orders` (pantalla Nuevo Pedido), después Solicitudes, validación y albarán PDF.

## Reglas de código
- Contratos (esquemas Zod, tipos, enums) SOLO en `packages/shared`; API y web los importan de
  `@cocina-central/shared`.
- API: un módulo por carpeta `apps/api/src/modules/<modulo>/` con model · repository · service · schemas ·
  controller · routes (ver `sale-articles` como referencia). Los repositorios devuelven DTOs planos.
  Errores de negocio con las clases de `src/shared/errors.ts`. Rutas nuevas se registran en `apiV1Routes`
  (`app.ts`).
- Web: `apps/web/src/modules/<modulo>/` con api · composables (TanStack Query) · components · views.
  Estado de servidor → TanStack Query; estado de cliente → Pinia.
- `apps/web/src/components/ui/` lo genera shadcn-vue (`npx shadcn-vue@latest add <x>`): no editar a mano.
- TypeScript 6 (no 7: vue-tsc/typescript-eslint no lo soportan aún).
- Antes de dar algo por terminado: `npm run type-check && npm run lint && npm test && npm run build`.

## Convenciones de git
- Mensajes de commit en español, minúscula: `feat: ...`, `fix: ...`, `chore: ...`.
- Sin `Co-Authored-By`, "Generated with Claude Code" ni menciones a Claude en commits o PRs.

## graphify

Si existe `graphify-out/` (es local, no se versiona), el proyecto tiene un grafo de conocimiento del código.

- Para preguntas sobre el código, primero `graphify query "<pregunta>"`; `graphify path "<A>" "<B>"` para
  relaciones y `graphify explain "<concepto>"` para un concepto concreto.
- `graphify-out/GRAPH_REPORT.md` solo para revisiones amplias de arquitectura.
- Tras modificar código, `graphify update .` para mantener el grafo al día (solo AST, sin coste).
