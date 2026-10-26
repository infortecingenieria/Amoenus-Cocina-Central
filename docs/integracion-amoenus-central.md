# Integración con Amoenus Central

> Estado: **pedidos Amoenus → Cocina Central y albarán/rechazo de vuelta implementados** (opción A,
> AM-903). Tiendas y login siguen pendientes. Más abajo, lo que ya ofrece Amoenus Central (Portal
> Corporativo) y las opciones que se valoraron.

## Pedidos de Amoenus → solicitudes en Cocina Central

Cuando un local de Amoenus hace un pedido al proveedor que es este obrador (Gestión de pedidos), Amoenus
lo envía a Cocina Central y aparece como solicitud `pending`, igual que si lo hubiera hecho la tienda.

```
Amoenus (warehouses, OrderSupplier.createOrder)
  └─ POST /api/v1/integrations/amoenus/orders      cabecera X-Api-Key: <AMOENUS_API_KEY>
       { externalOrderId, clientId, localId, localName, createdByName, notes,
         lines: [{ code: "10001", quantity: 3 }] }
  ◄─ 201 Order (nuevo) · 200 Order (ya recibido) · 400 artículos que no existen · 401 clave no válida
```

- **Autenticación**: clave de API compartida (`AMOENUS_API_KEY` en el `.env` de la API, mínimo 32
  caracteres), no sesión JWT. Sin la variable, la ruta responde siempre 401.
- **Artículos**: se casan por código. En Amoenus, el artículo de stock lleva como código del proveedor
  (`suppliers[].code`) el código de 5 dígitos de Cocina Central; `quantity` son formatos (bandejas,
  cajas…), su unidad de servicio. El precio y el formato salen del catálogo de Cocina Central.
- **Tienda**: de momento `storeName` = nombre del local en Amoenus. El pedido guarda además
  `source: { system: 'amoenus', externalOrderId, clientId, localId }`, que el módulo `stores` podrá usar.
- **Idempotencia**: índice único por `source.externalOrderId`; reenviar el mismo pedido devuelve el existente.
- **Autor**: usuario técnico `amoenus` (desactivado, no puede iniciar sesión); en el pedido figura
  `"<usuario de Amoenus> (Amoenus)"`. La ficha muestra la etiqueta «Desde Amoenus».
- **En Amoenus**: la colección `cocinacentralconfigs` (`clientId`, `supplierId`, `baseUrl`, `apiKey`)
  activa el envío para un cliente y proveedor. El pedido se envía antes de guardarlo: si Cocina Central no
  responde o lo rechaza, no se guarda en Amoenus y el usuario ve el motivo. El número `PED-…` queda en
  `orderCode` del pedido de Amoenus.
- **En Amoenus** el pedido enviado ya no se puede modificar ni borrar (como Florette/Conway).
- **Pendiente**: si la respuesta se pierde por un timeout y el usuario reintenta, el pedido se duplica
  (Amoenus genera un id nuevo en cada intento): el obrador rechazaría el sobrante.

## Albarán y rechazo de Cocina Central → Amoenus

Al **aprobar** un pedido (con o sin cambios) se genera su albarán (`delivery_notes`, número
`ALB-AAAA-NNNN`, uno por pedido) con lo pedido y lo servido (`confirmedQty`). Si el pedido viene de
Amoenus, se le envía en el momento; al **rechazarlo**, se envía el rechazo con el motivo. Funciona
como el albarán de Conway en Amoenus, pero sin cron: lo empuja Cocina Central.

```
Cocina Central (OrderService.approve / reject → AmoenusSyncService)
  └─ POST {AMOENUS_API_URL}/warehouses/cocina-central/delivery-notes   X-Api-Key: <AMOENUS_API_KEY>
       { externalOrderId, orderNumber, deliveryNote: { number, issuedAt,
         lines: [{ code, name, requestedQty, deliveredQty, unitPrice }] } }
  └─ POST {AMOENUS_API_URL}/warehouses/cocina-central/rejections
       { externalOrderId, orderNumber, reason, rejectedAt, rejectedBy }
  ◄─ 200 { success: true } · 400 { success: false, message }
```

- **Configuración**: `AMOENUS_API_URL` = gateway de Amoenus con `/api` (en local
  `http://localhost:4547/api`) y la misma `AMOENUS_API_KEY`. En Amoenus, la ruta no lleva sesión: la
  clave identifica la fila de `cocinacentralconfigs` (cliente + proveedor) y solo acepta pedidos de ese
  cliente a ese proveedor marcados `cocinaCentral`.
- **Si Amoenus no responde**, el pedido queda aprobado o rechazado igualmente y el envío queda en
  `order.amoenusSync` (`pending` → `sent` / `failed`, con `attempts` y `lastError`). `server.ts`
  reintenta los no enviados cada 5 minutos y el obrador puede pulsar «Reenviar a Amoenus» en la ficha
  (`POST /api/v1/orders/:id/amoenus-sync`). Amoenus es idempotente: un reenvío sustituye el albarán.
- **En Amoenus** el albarán se guarda como `GlobalDeliveryNote` (pedido = `serviceUnit`, servido =
  `quantityServiceUnit`, precio de Cocina Central) enlazado al pedido por `globalDeliveryNoteId`, y el
  pedido se autocorrige con lo servido (las líneas a 0 se quitan). En Gestión de pedidos sale el botón
  del albarán (en rojo si hay cambios) en lugar de «Recepcionar pedido», y la entrada se crea a mano
  desde él. Un rechazo marca el pedido `rejected` con `cocinaCentralRejection` (motivo, fecha, usuario).

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
| Artículos de venta        | Amoenus → Cocina Central (o mantenimiento propio) | Sin vínculo: por definir si se decide la integración |
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

De momento está implementada la opción 1, de forma provisional: colección `users` propia, login
con usuario y contraseña y JWT (ver `apps/api/src/modules/auth`). Si se pasa a la opción 2, solo
cambiaría cómo se obtiene el token; los permisos por rol de la API y de la web se mantienen.

## Preguntas abiertas

- ¿Las tiendas de ¡La Empanadera! ya están dadas de alta como locales en Amoenus? ¿Y sus usuarios?
- ¿El catálogo de artículos del obrador se mantiene en Cocina Central o es el de artículos de venta
  de Amoenus (filtrado por familia / proveedor)?
- ¿Qué debe registrarse en Amoenus al aprobar o entregar un pedido: pedido a proveedor, entrada de
  almacén, ambos?
- ¿El precio de pedido es por formato (bandeja/caja) o por unidad? ¿Lo puede modificar la tienda?
- ¿Las franjas horarias de entrega son fijas o configurables por tienda?
- ¿El albarán tiene que seguir algún formato o numeración de Amoenus/SAP?
