/**
 * Momento de caducidad (ms desde epoch) del JWT, leído del campo `exp` de su payload, o null si el
 * token no es legible o no lleva `exp`. Solo se decodifica, no se verifica: la firma la valida la API.
 */
export function getTokenExpiry(token: string | null): number | null {
  const payload = token?.split('.')[1]
  if (!payload) return null
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(base64)) as { exp?: unknown }
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null
  } catch {
    return null
  }
}
