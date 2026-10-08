import type { UserRole } from '@cocina-central/shared'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import AppLayout from '@/layouts/AppLayout.vue'
import { useSessionStore } from '@/stores/session'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    /** Texto que muestra la pantalla provisional mientras la sección no está desarrollada. */
    description?: string
    /** Roles con acceso. Sin definir = cualquier usuario autenticado. */
    roles?: readonly UserRole[]
  }
}

const ComingSoonView = () => import('@/views/ComingSoonView.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    children: [
      {
        path: '',
        name: 'home',
        redirect: () => ({ name: useSessionStore().isKitchenAdmin ? 'requests' : 'new-order' }),
      },
      {
        path: 'pedidos/nuevo',
        name: 'new-order',
        component: ComingSoonView,
        meta: {
          title: 'Nuevo pedido',
          description:
            'Catálogo de artículos con selector de unidades y resumen del pedido con franja de entrega y notas para el obrador.',
        },
      },
      {
        path: 'solicitudes',
        name: 'requests',
        component: ComingSoonView,
        meta: {
          title: 'Solicitudes',
          description: 'Histórico y estado de los pedidos enviados al obrador central.',
        },
      },
      {
        path: 'solicitudes/:id',
        name: 'request-detail',
        component: ComingSoonView,
        meta: {
          title: 'Detalle de pedido',
          description: 'Validación del pedido por el obrador, ajuste de cantidades y albarán.',
        },
      },
      {
        path: 'historial',
        name: 'history',
        component: ComingSoonView,
        meta: { title: 'Historial' },
      },
      {
        path: 'entregas',
        name: 'deliveries',
        component: ComingSoonView,
        meta: { title: 'Entregas' },
      },
      {
        path: 'incidencias',
        name: 'incidents',
        component: ComingSoonView,
        meta: { title: 'Incidencias' },
      },
      {
        path: 'articulos',
        name: 'sale-articles',
        component: () => import('@/modules/sale-articles/views/SaleArticlesView.vue'),
        meta: { title: 'Artículos de venta', roles: ['kitchen_admin'] },
      },
      {
        path: 'familias',
        name: 'families',
        component: () => import('@/modules/families/views/FamiliesView.vue'),
        meta: { title: 'Familias', roles: ['kitchen_admin'] },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: 'Página no encontrada' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to) => {
  if (!useSessionStore().hasRole(to.meta.roles)) return { name: 'home' }
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Cocina Central` : 'Cocina Central'
})

export default router
