import type { PackageFormat } from '@cocina-central/shared'

/**
 * Artículos de almacén de las tiendas de La Empanadera en Amoenus (`stockItems`) que pide al obrador.
 * El código es el de proveedor del artículo en Amoenus, para que sus pedidos casen por código.
 * «HALLACA» no tiene código de proveedor en Amoenus: se le asigna «H001» y hay que ponérselo allí.
 * Sin precio (en Amoenus está a 0): se fija desde Artículos de venta.
 */
export const LA_EMPANADERA_ARTICLES: {
  code: string
  name: string
  format: PackageFormat
  unitsPerFormat: number
}[] = [
  { code: 'E001', name: 'EMPANADA DE QUESO', format: 'bag', unitsPerFormat: 14 },
  { code: 'E002', name: 'EMPANADA DE POLLO', format: 'bag', unitsPerFormat: 14 },
  { code: 'E003', name: 'EMPANADA DE MOLIDA', format: 'bag', unitsPerFormat: 14 },
  { code: 'E004', name: 'EMPANADA DE MECHADA', format: 'bag', unitsPerFormat: 14 },
  { code: 'E005', name: 'EMPANADA DE PESCADO', format: 'bag', unitsPerFormat: 14 },
  { code: 'E006', name: 'EMPANADA DE JAMON Y QUESO', format: 'bag', unitsPerFormat: 14 },
  { code: 'E007', name: 'EMPANADA CORDON BLEU POLLO', format: 'bag', unitsPerFormat: 14 },
  { code: 'E008', name: 'EMPANADA CORDON BLEU CARNE', format: 'bag', unitsPerFormat: 14 },
  { code: 'E009', name: 'EMPANADA DE MECHADA QUESO', format: 'bag', unitsPerFormat: 14 },
  { code: 'E010', name: 'EMPANADA DE PABELLON', format: 'bag', unitsPerFormat: 14 },
  { code: 'E011', name: 'EMPANADA DE PABELLON MARGARITEÑO', format: 'bag', unitsPerFormat: 14 },
  { code: 'E012', name: 'EMPANADA PLATANO QUESO', format: 'bag', unitsPerFormat: 14 },
  { code: 'E013', name: 'EMPANADA DE CHULETA CON QUESO', format: 'bag', unitsPerFormat: 14 },
  { code: 'E014', name: 'EMPANADA DE VOLCAN MARINO', format: 'bag', unitsPerFormat: 14 },
  { code: 'E015', name: 'EMPANADA ITALIANA', format: 'bag', unitsPerFormat: 14 },
  { code: 'E016', name: 'EMPANADA DE QUESO AMARILLO Y POLLO', format: 'bag', unitsPerFormat: 14 },
  { code: 'E017', name: 'EMPANADA DOMINO', format: 'bag', unitsPerFormat: 14 },
  { code: 'E018', name: 'EMPANADA CAMARON', format: 'bag', unitsPerFormat: 14 },
  { code: 'P001', name: 'PASTELITO DE POLLO', format: 'bag', unitsPerFormat: 24 },
  { code: 'P002', name: 'PASTELITO DE MECHADA', format: 'bag', unitsPerFormat: 24 },
  { code: 'P003', name: 'PASTELITO DE PIZZA', format: 'bag', unitsPerFormat: 24 },
  { code: 'P004', name: 'PASTELITO DE MOLIDA', format: 'bag', unitsPerFormat: 24 },
  { code: 'P005', name: 'PASTELITO DE QUESO', format: 'bag', unitsPerFormat: 24 },
  { code: 'P006', name: 'PASTELITO DE JAMON Y QUESO', format: 'bag', unitsPerFormat: 24 },
  { code: 'P007', name: 'PASTELITO DE PAPA CON QUESO', format: 'bag', unitsPerFormat: 24 },
  { code: 'T001', name: 'TEQUEÑOS DE QUESO', format: 'bag', unitsPerFormat: 100 },
  { code: 'T002', name: 'TEQUENOS DE GUAYABA CON QUESO', format: 'bag', unitsPerFormat: 100 },
  { code: 'T003', name: 'TEQUEYOYO', format: 'bag', unitsPerFormat: 24 },
  { code: 'T004', name: 'MINI TEQUEÑOS', format: 'bag', unitsPerFormat: 100 },
  { code: 'S001', name: 'SALSA GUASACACA', format: 'bag', unitsPerFormat: 5 },
  { code: 'S002', name: 'SALSA DE AJO', format: 'bag', unitsPerFormat: 5 },
  { code: 'S003', name: 'SALSA PICANTE', format: 'bag', unitsPerFormat: 5 },
  { code: 'E019', name: 'MINI EMPANADA QUESO', format: 'bag', unitsPerFormat: 50 },
  { code: 'E020', name: 'MINI EMPANADA MOLIDA', format: 'bag', unitsPerFormat: 50 },
  { code: 'E021', name: 'MINI EMPANADA MECHADA', format: 'bag', unitsPerFormat: 50 },
  { code: 'E022', name: 'MINI EMPANADA POLLO', format: 'bag', unitsPerFormat: 50 },
  { code: 'CH001', name: 'CHICHARRON', format: 'bag', unitsPerFormat: 12 },
  { code: 'H001', name: 'HALLACA', format: 'bag', unitsPerFormat: 15 },
]
