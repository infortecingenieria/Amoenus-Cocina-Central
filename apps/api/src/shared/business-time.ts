/** Zona horaria del negocio: decide en qué año se numera un documento hecho en Nochevieja. */
export const BUSINESS_TIME_ZONE = 'Europe/Madrid'

/** Año actual como «2026». */
export const currentYear = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE, year: 'numeric' }).format(
    new Date(),
  )

const dateTimeFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Día y hora de negocio de un instante: `{ date: '2026-11-06', time: '09:45' }`. */
export const businessDateTime = (at: Date): { date: string; time: string } => {
  const parts = new Map(dateTimeFormat.formatToParts(at).map((part) => [part.type, part.value]))
  return {
    date: `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`,
    time: `${parts.get('hour')}:${parts.get('minute')}`,
  }
}
