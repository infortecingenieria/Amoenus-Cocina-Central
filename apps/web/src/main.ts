import './assets/main.css'
import 'vue-sonner/style.css'

import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { configureApiClient } from './lib/api-client'
import { queryClient } from './lib/query-client'
import router from './router'
import { useSessionStore } from './stores/session'

const app = createApp(App)

app.use(createPinia())

const session = useSessionStore()
configureApiClient({
  getToken: () => session.token,
  // Sesión caducada o no válida: se cierra y se vuelve al login conservando la página actual.
  onUnauthorized: () => {
    if (!session.isAuthenticated) return
    session.logout()
    const current = router.currentRoute.value
    void router.replace({ name: 'login', query: { redirect: current.fullPath } })
  },
})

app.use(router)
app.use(VueQueryPlugin, { queryClient })

app.mount('#app')

// Al recargar con una sesión guardada, se refrescan los datos del usuario (y si el token ha
// caducado, el 401 lleva al login).
void session.refreshUser().catch(() => {})
