import './assets/main.css'
import 'vue-sonner/style.css'

import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { createApp, watch } from 'vue'

import App from './App.vue'
import { configureApiClient } from './lib/api-client'
import { queryClient } from './lib/query-client'
import router from './router'
import { useSessionStore } from './stores/session'

const app = createApp(App)

app.use(createPinia())

const session = useSessionStore()

/** Sesión caducada o no válida: se cierra y se vuelve al login conservando la página actual. */
function expireSession() {
  if (!session.isAuthenticated) return
  session.logout()
  const current = router.currentRoute.value
  void router.replace({ name: 'login', query: { redirect: current.fullPath } })
}

configureApiClient({ getToken: () => session.token, onUnauthorized: expireSession })

// Cierra la sesión justo al caducar el token, aunque el usuario no haga ninguna petición.
const MAX_TIMEOUT_MS = 2 ** 31 - 1
let expiryTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => session.expiresAt,
  (expiresAt) => {
    clearTimeout(expiryTimer)
    if (expiresAt === null) return
    const delay = Math.min(Math.max(expiresAt - Date.now(), 0), MAX_TIMEOUT_MS)
    expiryTimer = setTimeout(expireSession, delay)
  },
  { immediate: true },
)

app.use(router)
app.use(VueQueryPlugin, { queryClient })

app.mount('#app')

// Al recargar con una sesión guardada, se refrescan los datos del usuario (y si el token ha
// caducado, el 401 lleva al login).
void session.refreshUser().catch(() => {})
