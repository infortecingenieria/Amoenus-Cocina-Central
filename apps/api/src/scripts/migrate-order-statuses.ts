/**
 * Pasa los pedidos con estados que ya no existen a los actuales: `pnpm db:migrate-order-statuses`
 * (desde la raíz), contra `MONGODB_URI`. `modified` e `in_preparation` → `approved`;
 * `delivered` → `shipped`. Es idempotente.
 *
 * Hay que ejecutarlo en cada entorno al desplegar la simplificación de estados: sin él, la API no
 * puede devolver los pedidos antiguos.
 */
import mongoose from 'mongoose'

import { loadConfig } from '../config/env'
import { OrderModel } from '../modules/orders/order.model'
import { migrateOrderStatuses } from '../modules/orders/order-status.migration'

const config = loadConfig()

await mongoose.connect(config.mongodbUri)
try {
  console.log(`Migrando estados de pedido en ${mongoose.connection.name}`)
  const migrated = await migrateOrderStatuses(OrderModel.collection)
  console.log(`Migración completada: ${migrated} pedidos actualizados`)
} finally {
  await mongoose.disconnect()
}
