import { formatPackage } from '@cocina-central/shared'
import { describe, expect, it } from 'vitest'

import { formatCurrency, formatDate, formatTime } from '../format'

describe('formato', () => {
  it('formatea importes en euros con formato español', () => {
    // Intl separa el símbolo con un espacio duro (U+00A0).
    expect(formatCurrency(1.45).replace(/\s/g, ' ')).toBe('1,45 €')
  })

  it('describe el formato de presentación', () => {
    expect(formatPackage('tray', 12)).toBe('Bandeja 12 uds')
    expect(formatPackage('box', 30)).toBe('Caja 30 uds')
    expect(formatPackage('unit', 1)).toBe('Unidad')
  })

  it('separa fecha y hora de un instante de la API, en hora local', () => {
    const createdAt = new Date(2026, 9, 14, 9, 5).toISOString()
    expect(formatDate(createdAt)).toMatch(/^14 oct\.? 2026$/)
    expect(formatTime(createdAt)).toBe('09:05 h')
  })
})
