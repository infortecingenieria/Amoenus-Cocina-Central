import type { UserRole } from '@cocina-central/shared'
import {
  CircleAlertIcon,
  ClipboardListIcon,
  CroissantIcon,
  FolderTreeIcon,
  HistoryIcon,
  ShoppingCartIcon,
  TruckIcon,
  WrenchIcon,
} from '@lucide/vue'
import type { Component } from 'vue'

export interface NavItem {
  label: string
  /** Nombre de la ruta destino. */
  route: string
  icon: Component
  roles?: readonly UserRole[]
}

/**
 * Grupo del menú. Sin `label`, sus opciones se muestran siempre. Con `label`, es un desplegable
 * plegado por defecto (se abre solo si la ruta actual es una de sus opciones).
 */
export interface NavSection {
  label?: string
  /** Icono del desplegable; es lo único que se ve con el menú plegado. */
  icon?: Component
  items: readonly NavItem[]
}

/** Una sección sin opciones visibles para el rol del usuario no se muestra. */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    items: [
      { label: 'Nuevo Pedido', route: 'new-order', icon: ShoppingCartIcon },
      { label: 'Solicitudes', route: 'requests', icon: ClipboardListIcon },
      { label: 'Historial', route: 'history', icon: HistoryIcon },
      { label: 'Entregas', route: 'deliveries', icon: TruckIcon },
      { label: 'Incidencias', route: 'incidents', icon: CircleAlertIcon },
    ],
  },
  {
    label: 'Mantenimiento',
    icon: WrenchIcon,
    items: [
      { label: 'Artículos', route: 'sale-articles', icon: CroissantIcon, roles: ['kitchen_admin'] },
      { label: 'Familias', route: 'families', icon: FolderTreeIcon, roles: ['kitchen_admin'] },
    ],
  },
]
