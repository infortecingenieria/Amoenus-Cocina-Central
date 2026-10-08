import { z } from 'zod'

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI es obligatoria'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  API_DOCS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
})

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production'
  host: string
  port: number
  logLevel: (typeof LOG_LEVELS)[number]
  mongodbUri: string
  corsOrigins: string[]
  docsEnabled: boolean
}

/** Lee y valida las variables de entorno. Si hay un `.env` en el directorio actual, se carga antes. */
export function loadConfig(): AppConfig {
  try {
    process.loadEnvFile()
  } catch {
    // Sin .env: se usan solo las variables del entorno (Docker, CI...).
  }

  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(`Configuración de entorno no válida:\n${z.prettifyError(parsed.error)}`)
  }

  const env = parsed.data
  return {
    nodeEnv: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    mongodbUri: env.MONGODB_URI,
    corsOrigins: env.CORS_ORIGINS,
    docsEnabled: env.API_DOCS_ENABLED,
  }
}
