import { randomBytes, scrypt, timingSafeEqual, type BinaryLike } from 'node:crypto'

/**
 * Hash de contraseñas con scrypt (incluido en Node, sin dependencias nativas).
 * Formato guardado: `scrypt$<sal en base64>$<hash en base64>`.
 */
const KEY_LENGTH = 64
const SALT_LENGTH = 16
const PREFIX = 'scrypt'

const deriveKey = (password: BinaryLike, salt: BinaryLike): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, key) => (error ? reject(error) : resolve(key)))
  })

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const key = await deriveKey(password, salt)
  return [PREFIX, salt.toString('base64'), key.toString('base64')].join('$')
}

/** Comparación en tiempo constante. Un hash con formato desconocido nunca coincide. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [prefix, salt, hash] = stored.split('$')
  if (prefix !== PREFIX || !salt || !hash) return false

  const expected = Buffer.from(hash, 'base64')
  const actual = await deriveKey(password, Buffer.from(salt, 'base64'))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
