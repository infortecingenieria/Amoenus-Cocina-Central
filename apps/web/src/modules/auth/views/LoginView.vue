<script setup lang="ts">
import { loginSchema } from '@cocina-central/shared'
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { z } from 'zod'

import logoUrl from '@/assets/brand/logo-la-empanadera.svg'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { getErrorMessage } from '@/lib/api-client'
import { useSessionStore } from '@/stores/session'

interface FormState {
  username: string
  password: string
}
type FormErrors = Partial<Record<keyof FormState, string[]>>

const session = useSessionStore()
const route = useRoute()
const router = useRouter()

const form = reactive<FormState>({ username: '', password: '' })
const errors = ref<FormErrors>({})
/** Error general (credenciales incorrectas, API caída...). */
const loginError = ref<string | null>(null)
const isSubmitting = ref(false)

/** Solo rutas internas, para que `?redirect=` no pueda sacar al usuario de la aplicación. */
const redirectTarget = () => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
    ? redirect
    : { name: 'home' }
}

async function submit() {
  loginError.value = null
  const parsed = loginSchema.safeParse(form)
  if (!parsed.success) {
    errors.value = z.flattenError(parsed.error).fieldErrors
    return
  }

  errors.value = {}
  isSubmitting.value = true
  try {
    await session.login(parsed.data)
    await router.replace(redirectTarget())
  } catch (error) {
    loginError.value = getErrorMessage(error)
    form.password = ''
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="flex min-h-svh items-center justify-center p-4">
    <Card class="w-full max-w-sm">
      <CardHeader class="items-center text-center">
        <img :src="logoUrl" alt="¡La Empanadera!" class="mx-auto mb-2 h-24 w-auto" />
        <CardTitle class="text-xl">Cocina Central</CardTitle>
        <CardDescription>Inicia sesión para hacer y gestionar pedidos.</CardDescription>
      </CardHeader>

      <CardContent>
        <form id="login-form" novalidate @submit.prevent="submit">
          <FieldGroup class="gap-4">
            <Field :data-invalid="!!errors.username">
              <FieldLabel for="username">Usuario</FieldLabel>
              <Input
                id="username"
                v-model="form.username"
                :aria-invalid="!!errors.username"
                autocomplete="username"
                autocapitalize="none"
                autofocus
              />
              <FieldError :errors="errors.username" />
            </Field>

            <Field :data-invalid="!!errors.password">
              <FieldLabel for="password">Contraseña</FieldLabel>
              <Input
                id="password"
                v-model="form.password"
                type="password"
                :aria-invalid="!!errors.password"
                autocomplete="current-password"
              />
              <FieldError :errors="errors.password" />
            </Field>

            <p v-if="loginError" role="alert" class="text-sm text-destructive">
              {{ loginError }}
            </p>
          </FieldGroup>
        </form>
      </CardContent>

      <CardFooter>
        <Button type="submit" form="login-form" class="w-full" :disabled="isSubmitting">
          {{ isSubmitting ? 'Entrando…' : 'Entrar' }}
        </Button>
      </CardFooter>
    </Card>
  </main>
</template>
