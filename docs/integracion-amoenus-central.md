# Integración con Amoenus Central

> Estado: **pendiente de decidir**. Este documento recoge lo que ya ofrece Amoenus Central
> (Portal Corporativo) y las opciones para conectar Cocina Central.

## Qué existe hoy en Amoenus Central

**API de integraciones** (`Portal-Corporativo/integrations`, guía en `integrations/API_V2.md`):

- `POST /api/integrations/login` → token (cabecera `Authorization: <token>`, sin `Bearer`).
- Límite de 60 peticiones/minuto por cliente; v2 exige `locationId` y rangos de 5 días como máximo.
- Endpoints relevantes:
  - `GET /locals` → locales del cliente (equivalen a las **tiendas**).
  - `GET /v2/sale-items` → **artículos de venta**: `_id, clientId, code, name, family, price,
amoenusPrice, stockItems, recipes, active, externalCode`.
  - `GET /v2/orders-to-suppliers` → pedidos a proveedor por local.
  - `GET /v2/inputs` → entradas de almacén.

**Obrador en Amoenus** (`Portal-Corporativo/factories/monitoringOrders`): ya hay un concepto de
fábrica/obrador. `ConfigFactory` asocia un cliente con sus proveedores-obrador y los
`OrderSupplier` (pedidos a proveedor de cada local) llevan un estado de obrador
`En espera → Preparando → Enviado`. También existen albaranes globales (`GlobalDeliveryNote`).

## Qué hay que sincronizar

| Dato                      | Dirección                                         | Notas                                                |
| ------------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| Tiendas                   | Amoenus → Cocina Central                          | `stores.amoenusLocalId` ↔ `locals._id`               |
| Artículos de venta        | Amoenus → Cocina Central (o mantenimiento propio) | `sale_articles.amoenusSaleItemId` ↔ `sale-items._id` |
| Usuarios / login          | ?                                                 | Ver opciones de autenticación                        |
| Pedido aprobado / albarán | Cocina Central → Amoenus                          | Para que el stock de la tienda refleje la entrada    |

## Opciones

### A. Cocina Central independiente, sincronizada por API (recomendada)

Base de datos propia. Un módulo `integrations/amoenus` en la API:

- Importa tiendas y artículos de venta desde la API de integraciones (botón «sincronizar» en el
  mantenimiento y/o tarea programada).
- Al aprobar un pedido o emitir el albarán, lo envía a Amoenus como **pedido a proveedor** o
  **entrada de almacén** del local. Requiere un endpoint de escritura en Amoenus: hoy la API de
  integraciones solo consulta estos datos (en `integration.routes.js` las rutas `POST` internas
  llaman a `getOrdersToSuppliers`, `getInputs`…, todas de lectura).

Pros: desacoplado, se puede desplegar y evolucionar por separado, contrato explícito.
Contras: hace falta exponer endpoints de escritura en Amoenus y gestionar reintentos.

### B. Compartir la base de datos de Amoenus

Leer/escribir directamente las colecciones (`locals`, `saleitems`, `ordersuppliers`) como hacen
los microservicios del portal entre sí.

Pros: sin desarrollo en Amoenus. Contras: acoplamiento fuerte al esquema interno, migraciones
arriesgadas, mezcla de responsabilidades. **No recomendada.**

### C. Cocina Central como módulo del propio Portal Corporativo

Descartada de partida: el stack elegido (Vue 3 + Fastify + TS) no encaja con el portal
(AngularJS + Express).

## Autenticación (depende de la opción)

1. **Login propio** en Cocina Central (usuarios por tienda y obrador). Lo más sencillo para empezar.
2. **SSO con el Cognito de Amoenus** (`Portal-Corporativo/authSSO`), si los usuarios de las tiendas
   ya existen en Amoenus.
3. **Login contra `/api/integrations/login`**: pensado para integraciones máquina a máquina, no
   para usuarios finales.

Mientras tanto, el front trabaja con usuarios de prueba (`apps/web/src/stores/session.ts`).

## Preguntas abiertas

- ¿Las tiendas de ¡La Empanadera! ya están dadas de alta como locales en Amoenus? ¿Y sus usuarios?
- ¿El catálogo de artículos del obrador se mantiene en Cocina Central o es el de artículos de venta
  de Amoenus (filtrado por familia / proveedor)?
- ¿Qué debe registrarse en Amoenus al aprobar o entregar un pedido: pedido a proveedor, entrada de
  almacén, ambos?
- ¿El precio de pedido es por formato (bandeja/caja) o por unidad? ¿Lo puede modificar la tienda?
- ¿Las franjas horarias de entrega son fijas o configurables por tienda?
- ¿El albarán tiene que seguir algún formato o numeración de Amoenus/SAP?
