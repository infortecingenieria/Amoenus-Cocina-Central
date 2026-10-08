# Arquitectura

## Monorepo

Un único repositorio con _pnpm workspaces_ (`pnpm-workspace.yaml`):

- `packages/shared` (`@cocina-central/shared`): **fuente única de los contratos**. Los esquemas Zod
  validan las peticiones en la API, generan la documentación OpenAPI, tipan las respuestas en el
  front y validan los formularios. No se compila: API (tsdown) y web (Vite) importan su código
  TypeScript directamente.
- `apps/api` y `apps/web` dependen de él con `"@cocina-central/shared": "workspace:*"`.

Si un campo cambia, se cambia en `shared` y TypeScript señala todo lo que hay que adaptar en los
dos lados.

## API (`apps/api`)

Cada módulo de negocio vive en `src/modules/<modulo>/` con estas capas, de fuera hacia dentro:

| Fichero           | Responsabilidad                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `*.routes.ts`     | Registra las rutas en Fastify y compone las dependencias (repositorio → servicio → controlador).                |
| `*.schemas.ts`    | Contrato HTTP de cada ruta: `params`, `querystring`, `body` y `response` con esquemas de `shared`.              |
| `*.controller.ts` | Adapta HTTP ⇄ servicio: lee la petición tipada y fija el código de estado. Sin lógica de negocio.               |
| `*.service.ts`    | Reglas de negocio. Lanza errores de `shared/errors.ts` (`NotFoundError`, `ConflictError`, `InvalidStateError`). |
| `*.repository.ts` | Acceso a MongoDB. Devuelve siempre DTOs planos (`id` string, fechas ISO), nunca documentos Mongoose.            |
| `*.model.ts`      | Esquema e índices de Mongoose.                                                                                  |

Flujo de una petición: `routes` → validación Zod (automática) → `controller` → `service` →
`repository` → `model`. La respuesta se serializa contra su esquema Zod, así que un campo
que no está en el contrato nunca sale de la API.

Transversal:

- `config/env.ts`: variables de entorno validadas con Zod; si falta alguna, la API no arranca.
- `plugins/error-handler.ts`: todo error sale como `ApiErrorBody`
  (`{ statusCode, code, message, details? }`), con `code` estable (`VALIDATION_ERROR`, `NOT_FOUND`,
  `CONFLICT`, `INVALID_STATE`…) para que el front no dependa del texto.
- `plugins/swagger.ts`: OpenAPI generado desde los esquemas, en `/docs`.
- Rutas de negocio versionadas bajo `/api/v1`. `GET /health` informa del estado de la base de datos.
- `buildApp()` no abre conexiones ni puertos: `server.ts` conecta Mongo y escucha; los tests usan
  `app.inject()` contra un MongoDB en memoria (`mongodb-memory-server`, versión 9.0.2).

## Web (`apps/web`)

- `modules/<modulo>/`: `api/` (llamadas HTTP con `apiClient`), `composables/` (hooks de TanStack
  Query y _query keys_), `components/` y `views/`.
- **Estado de servidor** (catálogo, pedidos…) → TanStack Query. Tras cada mutación se invalidan las
  _query keys_ del módulo.
- **Estado de cliente** (sesión, carrito del pedido en curso) → Pinia.
- `components/ui/` lo genera el CLI de shadcn-vue (`npx shadcn-vue@latest add <componente>`). No se
  edita a mano; las adaptaciones van en `assets/main.css` o en componentes propios.
- Rutas con `meta.roles` para restringir pantallas por rol (`store`, `kitchen_admin`).

## Modelo de datos (propuesta)

Implementado: `families` y `sale_articles`. El resto es la propuesta para los siguientes módulos.

```
stores (tiendas)
  _id, code, name, active, amoenusLocalId?            ← local equivalente en Amoenus Central

families (familias de artículos de venta)             ✅ implementado
  _id, name (único sin distinguir mayúsculas ni tildes), createdAt, updatedAt
  No se puede borrar si tiene artículos asignados.

sale_articles (artículos de venta del obrador)        ✅ implementado
  _id, code (único, 5 dígitos: "00123"), name, familyId? (→ families), format (box|tray|bag|unit),
  unitsPerFormat, price, imageUrl, active, amoenusSaleItemId? (único si existe),
  createdAt, updatedAt

orders (pedidos tienda → obrador)
  _id, number ("PED-2026-0001", correlativo por año), storeId, status,
  requestedDeliveryAt, deliverySlot, notes,
  lines: [{ saleArticleId, code, name, format, unitsPerFormat,   ← copia del artículo al pedir
            unitPrice, requestedQty, confirmedQty? }],
  statusHistory: [{ status, at, userId, reason? }],               ← motivo de rechazo, auditoría
  createdBy, createdAt, updatedAt

delivery_notes (albaranes)
  _id, number, orderId, storeId, issuedAt, lines (cantidades confirmadas), totals

counters (numeración correlativa atómica: pedidos y albaranes)
  _id ("order-2026"), seq
```

Las líneas del pedido guardan una copia del artículo (nombre, formato, precio) para que el
histórico y los albaranes no cambien si luego se modifica el catálogo.

## Ciclo de vida del pedido

Definido en `packages/shared/src/orders/order-status.ts`:

```
pending ──► approved ──► in_preparation ──► delivered
   │    └─► modified ──┘
   ├─► rejected   (obrador, con motivo)
   └─► cancelled  (tienda)
```

- La tienda solo puede editar o cancelar mientras el pedido está `pending`.
- `modified` = aprobado con cantidades distintas a las pedidas (rotura de stock, mermas, capacidad
  de horneada).

## Decisiones técnicas

| Decisión                                                     | Motivo                                                                                                                                                                                                            |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node 24 LTS (no 26)                                          | Node 26 aún es _Current_; pasa a LTS a finales de octubre de 2026.                                                                                                                                                |
| TypeScript 6.0 (no 7)                                        | `vue-tsc` y `typescript-eslint` todavía no soportan el compilador nativo de TS 7.                                                                                                                                 |
| API empaquetada con tsdown                                   | Un único `dist/server.mjs` que incluye `@cocina-central/shared`.                                                                                                                                                  |
| `zod` como _peer_ de `shared`                                | Una sola instancia de Zod en todo el monorepo.                                                                                                                                                                    |
| Inter autoalojada (`@fontsource-variable/inter`)             | Sin peticiones a Google Fonts (RGPD) ni dependencia de CDN.                                                                                                                                                       |
| Variantes `data-open/closed/checked/unchecked` en `main.css` | El estilo _vega_ de shadcn-vue usa atributos de Base UI; reka-ui expone `data-state`.                                                                                                                             |
| pnpm 11 como gestor de paquetes                              | Dependencias estrictas (sin dependencias fantasma), instalaciones más rápidas y mejor soporte de monorepos. pnpm 12 solo se distribuye como binario nativo y en los equipos con antivirus corporativo no arranca. |
| Sin `npm audit fix --force`                                  | Las 4 alertas _high_ son de `braces` dentro del tooling de ESLint (sin versión corregida, sin impacto en runtime).                                                                                                |
