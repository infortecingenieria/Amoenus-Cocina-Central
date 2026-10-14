const currencyFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
const dateFormatter = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' })
const timeFormatter = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })
const dateTimeFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
})

/** 1.45 → "1,45 €" */
export const formatCurrency = (value: number): string => currencyFormatter.format(value)

/** Instante ISO de la API → "14 oct 2026" en hora local. */
export const formatDate = (isoDateTime: string): string =>
  dateFormatter.format(new Date(isoDateTime))

/** Instante ISO de la API → "09:30 h" en hora local. */
export const formatTime = (isoDateTime: string): string =>
  `${timeFormatter.format(new Date(isoDateTime))} h`

/** Instante ISO de la API → "15/10/26, 9:30" en hora local. */
export const formatDateTime = (isoDateTime: string): string =>
  dateTimeFormatter.format(new Date(isoDateTime))
