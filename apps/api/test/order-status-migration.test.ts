import type { Order } from '@cocina-central/shared'
import { Types } from 'mongoose'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { OrderModel } from '../src/modules/orders/order.model'
import { migrateOrderStatuses } from '../src/modules/orders/order-status.migration'
import { clearDatabase, createTestApp, type TestContext } from './helpers/test-app'

describe('migración de estados de pedido', () => {
  let ctx: TestContext

  beforeAll(async () => {
    ctx = await createTestApp()
  })
  afterAll(async () => {
    await ctx.close()
  })
  beforeEach(async () => {
    await clearDatabase()
  })

  const entry = (status: string, reason: string | null = null) => ({
    status,
    at: new Date('2026-10-01T10:00:00Z'),
    userId: new Types.ObjectId(),
    userName: 'admin',
    reason,
  })

  /** Pedido guardado tal cual estaba antes, sin pasar por el modelo (ya no admite esos estados). */
  async function legacyOrder(status: string, history: string[]) {
    const { insertedId } = await OrderModel.collection.insertOne({
      number: `PED-2026-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`,
      storeName: 'Tienda de pruebas',
      status,
      notes: null,
      amoenus: null,
      amoenusSale: null,
      deliveryNote: null,
      lines: [],
      createdBy: { id: new Types.ObjectId(), displayName: 'store' },
      statusHistory: history.map((item) => entry(item, item === 'modified' ? 'Sin stock' : null)),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    return insertedId
  }

  it('pasa los estados antiguos a los actuales, en el pedido y en su historial', async () => {
    const modified = await legacyOrder('modified', ['pending', 'modified'])
    const preparing = await legacyOrder('in_preparation', ['pending', 'approved', 'in_preparation'])
    const delivered = await legacyOrder('delivered', [
      'pending',
      'modified',
      'shipped',
      'delivered',
    ])
    await legacyOrder('rejected', ['pending', 'rejected'])

    // El rechazado no tenía nada que cambiar.
    expect(await migrateOrderStatuses(OrderModel.collection)).toBe(3)

    const statusesOf = async (id: Types.ObjectId) => {
      const order = await OrderModel.collection.findOne({ _id: id })
      return [order?.status, order?.statusHistory.map((item: { status: string }) => item.status)]
    }
    expect(await statusesOf(modified)).toEqual(['approved', ['pending', 'approved']])
    expect(await statusesOf(preparing)).toEqual(['approved', ['pending', 'approved', 'approved']])
    expect(await statusesOf(delivered)).toEqual([
      'shipped',
      ['pending', 'approved', 'shipped', 'shipped'],
    ])

    // Se conserva el motivo que se indicó al modificar.
    const migrated = await OrderModel.collection.findOne({ _id: modified })
    expect(migrated?.statusHistory[1]).toMatchObject({ status: 'approved', reason: 'Sin stock' })

    // La API ya puede devolverlo.
    const response = await ctx.app.inject({
      url: `/api/v1/orders/${modified.toHexString()}`,
      headers: ctx.authHeaders('kitchen_admin'),
    })
    expect(response.statusCode).toBe(200)
    expect(response.json<Order>().status).toBe('approved')
  })

  it('es idempotente', async () => {
    await legacyOrder('modified', ['pending', 'modified'])
    await migrateOrderStatuses(OrderModel.collection)

    expect(await migrateOrderStatuses(OrderModel.collection)).toBe(0)
  })
})
