import type { UserRole } from '@cocina-central/shared'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import AppLayout from '@/layouts/AppLayout.vue'
import { useSessionStore } from '@/stores/session'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    /** Roles con acceso. Sin definir = cualquier usuario autenticado. */
    roles?: readonly UserRole[]
    /** Accesible sin iniciar sesión (solo el login). */
    public?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/modules/auth/views/LoginView.vue'),
    meta: { title: 'Iniciar sesión', public: true },
  },
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
        component: () => import('@/modules/orders/views/NewOrderView.vue'),
        meta: { title: 'Nuevo pedido', roles: ['store'] },
      },
      {
        path: 'solicitudes',
        name: 'requests',
        component: () => import('@/modules/orders/views/OrdersView.vue'),
        meta: { title: 'Solicitudes' },
      },
      {
        path: 'solicitudes/:id',
        name: 'request-detail',
        component: () => import('@/modules/orders/views/OrderDetailView.vue'),
        meta: { title: 'Detalle de pedido' },
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
  const session = useSessionStore()

  if (to.meta.public) {
    // Con sesión iniciada no tiene sentido volver al login.
    return session.isAuthenticated ? { name: 'home' } : true
  }
  if (!session.isAuthenticated) {
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }
  if (!session.hasRole(to.meta.roles)) return { name: 'home' }
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Cocina Central` : 'Cocina Central'
})

export default router
