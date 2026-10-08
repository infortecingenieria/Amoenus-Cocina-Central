const currencyFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

/** 1.45 → "1,45 €" */
export const formatCurrency = (value: number): string => currencyFormatter.format(value)
