/** Zona horaria del negocio: decide en qué año se numera un documento hecho en Nochevieja. */
export const BUSINESS_TIME_ZONE = 'Europe/Madrid'

/** Año actual como «2026». */
export const currentYear = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE, year: 'numeric' }).format(
    new Date(),
  )
