/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base de la API. Por defecto `/api/v1` (en desarrollo, Vite lo reenvía a la API local). */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
