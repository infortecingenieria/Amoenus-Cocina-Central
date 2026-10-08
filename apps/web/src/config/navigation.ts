import type { UserRole } from '@cocina-central/shared'
import {
  CircleAlertIcon,
  ClipboardListIcon,
  CroissantIcon,
  FolderTreeIcon,
  HistoryIcon,
  ShoppingCartIcon,
  TruckIcon,
} from '@lucide/vue'
import type { Component } from 'vue'

export interface NavItem {
  label: string
  /** Nombre de la ruta destino. */
  route: string
  icon: Component
  roles?: readonly UserRole[]
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Nuevo Pedido', route: 'new-order', icon: ShoppingCartIcon },
  { label: 'Solicitudes', route: 'requests', icon: ClipboardListIcon },
  { label: 'Historial', route: 'history', icon: HistoryIcon },
  { label: 'Entregas', route: 'deliveries', icon: TruckIcon },
  { label: 'Incidencias', route: 'incidents', icon: CircleAlertIcon },
  { label: 'Artículos', route: 'sale-articles', icon: CroissantIcon, roles: ['kitchen_admin'] },
  { label: 'Familias', route: 'families', icon: FolderTreeIcon, roles: ['kitchen_admin'] },
]
