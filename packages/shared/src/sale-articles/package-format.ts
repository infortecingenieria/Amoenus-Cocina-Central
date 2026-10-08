import { z } from 'zod'

/** Formato de presentación / envasado en el que se pide un artículo al obrador. */
export const PACKAGE_FORMATS = ['box', 'tray', 'bag', 'unit'] as const
export const packageFormatSchema = z.enum(PACKAGE_FORMATS)
export type PackageFormat = z.infer<typeof packageFormatSchema>

export const PACKAGE_FORMAT_LABELS: Record<PackageFormat, string> = {
  box: 'Caja',
  tray: 'Bandeja',
  bag: 'Bolsa',
  unit: 'Unidad',
}

/** Texto de presentación, p. ej. "Bandeja 12 uds". */
export const formatPackage = (format: PackageFormat, unitsPerFormat: number): string =>
  format === 'unit'
    ? PACKAGE_FORMAT_LABELS.unit
    : `${PACKAGE_FORMAT_LABELS[format]} ${unitsPerFormat} uds`
