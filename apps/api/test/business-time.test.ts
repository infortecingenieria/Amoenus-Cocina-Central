import { describe, expect, it } from 'vitest'

import { businessDateTime } from '../src/shared/business-time'

describe('businessDateTime', () => {
  const at = (iso: string) => businessDateTime(new Date(iso))

  it('da el día y la hora en Madrid', () => {
    expect(at('2026-11-06T08:45:00Z')).toEqual({ date: '2026-11-06', time: '09:45' })
    expect(at('2026-07-15T08:45:00Z')).toEqual({ date: '2026-07-15', time: '10:45' })
  })

  it('a medianoche es 00:00 del día siguiente', () => {
    expect(at('2026-11-05T23:00:00Z')).toEqual({ date: '2026-11-06', time: '00:00' })
  })

  it('en Nochevieja, pasadas las 23:00 UTC ya es año nuevo', () => {
    expect(at('2026-12-31T23:30:00Z')).toEqual({ date: '2027-01-01', time: '00:30' })
  })

  it('respeta los cambios de hora', () => {
    // Marzo: a las 02:00 se pasa a las 03:00.
    expect(at('2026-03-29T00:59:00Z')).toEqual({ date: '2026-03-29', time: '01:59' })
    expect(at('2026-03-29T01:00:00Z')).toEqual({ date: '2026-03-29', time: '03:00' })
    // Octubre: a las 03:00 se vuelve a las 02:00.
    expect(at('2026-10-25T00:30:00Z')).toEqual({ date: '2026-10-25', time: '02:30' })
    expect(at('2026-10-25T01:30:00Z')).toEqual({ date: '2026-10-25', time: '02:30' })
  })
})
