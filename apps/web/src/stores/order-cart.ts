import {
  calculateOrderTotal,
  MAX_ORDER_LINE_QUANTITY,
  type CreateOrderInput,
  type SaleArticle,
} from '@cocina-central/shared'
import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

const CART_KEY = 'cocina-central:order-cart'

export interface CartLine {
  article: SaleArticle
  /** Formatos (bandejas, cajas…) que se piden. */
  quantity: number
}

interface CartState {
  lines: CartLine[]
  notes: string
}

const emptyCart = (): CartState => ({ lines: [], notes: '' })

/**
 * Pedido en curso de la tienda. Se guarda en localStorage para no perderlo al recargar o al
 * cambiar de pantalla; se vacía al enviarlo y al cerrar sesión.
 */
export const useOrderCartStore = defineStore('order-cart', () => {
  const state = useLocalStorage<CartState>(CART_KEY, emptyCart(), { mergeDefaults: true })

  const lines = computed(() => state.value.lines)
  const lineCount = computed(() => state.value.lines.length)
  const isEmpty = computed(() => state.value.lines.length === 0)
  const total = computed(() =>
    calculateOrderTotal(
      state.value.lines.map((line) => ({
        unitPrice: line.article.price,
        requestedQty: line.quantity,
        confirmedQty: null,
      })),
    ),
  )

  const notes = computed({
    get: () => state.value.notes,
    set: (value: string) => (state.value.notes = value),
  })

  const quantityOf = (articleId: string): number =>
    state.value.lines.find((line) => line.article.id === articleId)?.quantity ?? 0

  /** Fija la cantidad de un artículo: lo añade si no estaba y lo quita si llega a 0. */
  function setQuantity(article: SaleArticle, quantity: number) {
    const value = Math.min(Math.max(Math.trunc(quantity) || 0, 0), MAX_ORDER_LINE_QUANTITY)
    const line = state.value.lines.find((item) => item.article.id === article.id)
    if (value === 0) {
      remove(article.id)
    } else if (line) {
      line.quantity = value
    } else {
      state.value.lines.push({ article, quantity: value })
    }
  }

  function remove(articleId: string) {
    state.value.lines = state.value.lines.filter((line) => line.article.id !== articleId)
  }

  function clear() {
    state.value = emptyCart()
  }

  /** Actualiza nombre, precio, etc. de los artículos del carrito con los recién cargados. */
  function syncArticles(articles: readonly SaleArticle[]) {
    const byId = new Map(articles.map((article) => [article.id, article]))
    for (const line of state.value.lines) {
      const fresh = byId.get(line.article.id)
      if (fresh) line.article = fresh
    }
  }

  const toOrderInput = (): CreateOrderInput => ({
    notes: state.value.notes.trim() || null,
    lines: state.value.lines.map((line) => ({
      saleArticleId: line.article.id,
      quantity: line.quantity,
    })),
  })

  return {
    lines,
    lineCount,
    isEmpty,
    total,
    notes,
    quantityOf,
    setQuantity,
    remove,
    clear,
    syncArticles,
    toOrderInput,
  }
})
