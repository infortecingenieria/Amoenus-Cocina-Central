import type { mongo } from 'mongoose'

/**
 * Estados que ya no existen y a cuál pasan: «modificado por obrador» y «en preparación» son un
 * pedido aprobado; «entregado», uno enviado.
 */
export const LEGACY_ORDER_STATUSES: Readonly<Record<string, string>> = {
  modified: 'approved',
  in_preparation: 'approved',
  delivered: 'shipped',
}

/**
 * Pasa los pedidos con estados antiguos (en `status` y en `statusHistory`) a los actuales y
 * devuelve cuántos pedidos ha cambiado. Trabaja sobre la colección, sin el modelo, porque el modelo
 * ya no admite esos estados. Es idempotente: una segunda pasada no cambia nada.
 */
export const migrateOrderStatuses = async (orders: mongo.Collection): Promise<number> => {
  const legacy = Object.keys(LEGACY_ORDER_STATUSES)
  const affected = await orders.countDocuments({
    $or: [{ status: { $in: legacy } }, { 'statusHistory.status': { $in: legacy } }],
  })
  for (const [from, to] of Object.entries(LEGACY_ORDER_STATUSES)) {
    await orders.updateMany({ status: from }, { $set: { status: to } })
    await orders.updateMany(
      { 'statusHistory.status': from },
      { $set: { 'statusHistory.$[entry].status': to } },
      { arrayFilters: [{ 'entry.status': from }] },
    )
  }
  return affected
}
