<script setup lang="ts">
import { createFamilySchema, type Family } from '@cocina-central/shared'
import { computed, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ApiError, getErrorMessage } from '@/lib/api-client'

import { useCreateFamily, useUpdateFamily } from '../composables/useFamilies'

const props = defineProps<{
  /** Familia a editar; `null` para crear una nueva. */
  family: Family | null
}>()
const open = defineModel<boolean>('open', { required: true })

interface FormState {
  name: string
}
type FormErrors = Partial<Record<keyof FormState, string[]>>

const form = reactive<FormState>({ name: '' })
const errors = ref<FormErrors>({})

watch(open, (isOpen) => {
  if (!isOpen) return
  form.name = props.family?.name ?? ''
  errors.value = {}
})

const isEditing = computed(() => props.family !== null)
const createMutation = useCreateFamily()
const updateMutation = useUpdateFamily()
const isSaving = computed(() => createMutation.isPending.value || updateMutation.isPending.value)

async function submit() {
  const parsed = createFamilySchema.safeParse(form)
  if (!parsed.success) {
    errors.value = z.flattenError(parsed.error).fieldErrors
    return
  }

  errors.value = {}
  try {
    if (props.family) {
      await updateMutation.mutateAsync({ id: props.family.id, input: parsed.data })
      toast.success('Familia actualizada')
    } else {
      await createMutation.mutateAsync(parsed.data)
      toast.success('Familia creada')
    }
    open.value = false
  } catch (error) {
    if (error instanceof ApiError && error.body?.code === 'CONFLICT') {
      errors.value = { name: [error.message] }
    } else {
      toast.error(getErrorMessage(error))
    }
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ isEditing ? 'Editar familia' : 'Nueva familia' }}</DialogTitle>
        <DialogDescription>Agrupa los artículos de venta del obrador.</DialogDescription>
      </DialogHeader>

      <form id="family-form" novalidate @submit.prevent="submit">
        <FieldGroup>
          <Field :data-invalid="!!errors.name">
            <FieldLabel for="family-name">Nombre</FieldLabel>
            <Input
              id="family-name"
              v-model="form.name"
              :aria-invalid="!!errors.name"
              autocomplete="off"
            />
            <FieldError :errors="errors.name" />
          </Field>
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button variant="outline" :disabled="isSaving" @click="open = false">Cancelar</Button>
        <Button type="submit" form="family-form" :disabled="isSaving">
          {{ isSaving ? 'Guardando…' : 'Guardar' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
