import type { SaleArticle } from '@cocina-central/shared'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { useOrderCartStore } from '../order-cart'

const article = (id: string, price: number): SaleArticle => ({
  id: id.padStart(24, '0'),
  code: id.padStart(5, '0'),
  name: `Artículo ${id}`,
  format: 'tray',
  unitsPerFormat: 12,
  price,
  familyId: null,
  familyName: null,
  active: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
})

const barra = article('1', 1.45)
const croissant = article('2', 0.85)

describe('carrito del pedido', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('añade, cambia y quita artículos al fijar la cantidad', () => {
    const cart = useOrderCartStore()

    cart.setQuantity(barra, 3)
    cart.setQuantity(croissant, 2)
    cart.setQuantity(barra, 5)
    expect(cart.lineCount).toBe(2)
    expect(cart.quantityOf(barra.id)).toBe(5)

    cart.setQuantity(croissant, 0)
    expect(cart.lines.map((line) => line.article.id)).toEqual([barra.id])
  })

  it('calcula el total redondeado a céntimos', () => {
    const cart = useOrderCartStore()
    cart.setQuantity(barra, 3)
    cart.setQuantity(croissant, 2)
    expect(cart.total).toBe(6.05)
  })

  it('genera el pedido para la API y se vacía', () => {
    const cart = useOrderCartStore()
    cart.setQuantity(barra, 3)
    cart.notes = '  Por la puerta de atrás  '

    expect(cart.toOrderInput()).toEqual({
      notes: 'Por la puerta de atrás',
      lines: [{ saleArticleId: barra.id, quantity: 3 }],
    })

    cart.clear()
    expect(cart.isEmpty).toBe(true)
    expect(cart.notes).toBe('')
  })

  it('actualiza el precio con los datos del catálogo', () => {
    const cart = useOrderCartStore()
    cart.setQuantity(barra, 2)
    cart.syncArticles([{ ...barra, price: 2 }])
    expect(cart.total).toBe(4)
  })

  it('se conserva al recargar la página', async () => {
    useOrderCartStore().setQuantity(barra, 4)
    await nextTick() // useLocalStorage escribe en el siguiente tick

    setActivePinia(createPinia())
    expect(useOrderCartStore().quantityOf(barra.id)).toBe(4)
  })
})
