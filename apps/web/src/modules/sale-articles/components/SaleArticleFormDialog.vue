<script setup lang="ts">
import {
  createSaleArticleSchema,
  PACKAGE_FORMAT_LABELS,
  PACKAGE_FORMATS,
  type PackageFormat,
  type SaleArticle,
} from '@cocina-central/shared'
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@/components/ui/number-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ApiError, getErrorMessage } from '@/lib/api-client'

import { useCreateSaleArticle, useUpdateSaleArticle } from '../composables/useSaleArticles'

const props = defineProps<{
  /** Artículo a editar; `null` para crear uno nuevo. */
  article: SaleArticle | null
}>()
const open = defineModel<boolean>('open', { required: true })

interface FormState {
  code: string
  name: string
  format: PackageFormat
  unitsPerFormat: number
  price: number
  imageUrl: string
  amoenusSaleItemId: string
  active: boolean
}
type FormErrors = Partial<Record<keyof FormState, string[]>>

const emptyForm = (): FormState => ({
  code: '',
  name: '',
  format: 'tray',
  unitsPerFormat: 12,
  price: 0,
  imageUrl: '',
  amoenusSaleItemId: '',
  active: true,
})

const toForm = (article: SaleArticle): FormState => ({
  code: article.code,
  name: article.name,
  format: article.format,
  unitsPerFormat: article.unitsPerFormat,
  price: article.price,
  imageUrl: article.imageUrl ?? '',
  amoenusSaleItemId: article.amoenusSaleItemId ?? '',
  active: article.active,
})

const form = reactive<FormState>(emptyForm())
const errors = ref<FormErrors>({})

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(form, props.article ? toForm(props.article) : emptyForm())
  errors.value = {}
})

const isEditing = computed(() => props.article !== null)
const createMutation = useCreateSaleArticle()
const updateMutation = useUpdateSaleArticle()
const isSaving = computed(() => createMutation.isPending.value || updateMutation.isPending.value)

async function submit() {
  const parsed = createSaleArticleSchema.safeParse({
    ...form,
    imageUrl: form.imageUrl.trim() || null,
    amoenusSaleItemId: form.amoenusSaleItemId.trim() || null,
  })
  if (!parsed.success) {
    errors.value = z.flattenError(parsed.error).fieldErrors
    return
  }

  errors.value = {}
  try {
    if (props.article) {
      await updateMutation.mutateAsync({ id: props.article.id, input: parsed.data })
      toast.success('Artículo actualizado')
    } else {
      await createMutation.mutateAsync(parsed.data)
      toast.success('Artículo creado')
    }
    open.value = false
  } catch (error) {
    if (error instanceof ApiError && error.body?.code === 'CONFLICT') {
      errors.value = { code: [error.message] }
    } else {
      toast.error(getErrorMessage(error))
    }
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ isEditing ? 'Editar artículo' : 'Nuevo artículo' }}</DialogTitle>
        <DialogDescription
          >Datos del artículo de venta que las tiendas piden al obrador.</DialogDescription
        >
      </DialogHeader>

      <form id="sale-article-form" novalidate @submit.prevent="submit">
        <FieldGroup class="gap-4">
          <div class="grid grid-cols-3 gap-4">
            <Field :data-invalid="!!errors.code">
              <FieldLabel for="code">Código</FieldLabel>
              <Input
                id="code"
                v-model="form.code"
                :aria-invalid="!!errors.code"
                autocomplete="off"
              />
              <FieldError :errors="errors.code" />
            </Field>
            <Field :data-invalid="!!errors.name" class="col-span-2">
              <FieldLabel for="name">Nombre</FieldLabel>
              <Input id="name" v-model="form.name" :aria-invalid="!!errors.name" />
              <FieldError :errors="errors.name" />
            </Field>
          </div>

          <div class="grid grid-cols-3 gap-4">
            <Field :data-invalid="!!errors.format">
              <FieldLabel for="format">Formato</FieldLabel>
              <Select v-model="form.format">
                <SelectTrigger id="format" class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="format in PACKAGE_FORMATS" :key="format" :value="format">
                    {{ PACKAGE_FORMAT_LABELS[format] }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field :data-invalid="!!errors.unitsPerFormat">
              <FieldLabel for="unitsPerFormat">Uds. por formato</FieldLabel>
              <NumberField id="unitsPerFormat" v-model="form.unitsPerFormat" :min="1" :step="1">
                <NumberFieldContent>
                  <NumberFieldDecrement />
                  <NumberFieldInput :aria-invalid="!!errors.unitsPerFormat" />
                  <NumberFieldIncrement />
                </NumberFieldContent>
              </NumberField>
              <FieldError :errors="errors.unitsPerFormat" />
            </Field>
            <Field :data-invalid="!!errors.price">
              <FieldLabel for="price">Precio</FieldLabel>
              <NumberField
                id="price"
                v-model="form.price"
                :min="0"
                :step="0.05"
                locale="es-ES"
                :format-options="{ style: 'currency', currency: 'EUR' }"
              >
                <NumberFieldContent>
                  <NumberFieldInput :aria-invalid="!!errors.price" />
                </NumberFieldContent>
              </NumberField>
              <FieldError :errors="errors.price" />
            </Field>
          </div>

          <Field :data-invalid="!!errors.imageUrl">
            <FieldLabel for="imageUrl">URL de la imagen</FieldLabel>
            <Input id="imageUrl" v-model="form.imageUrl" type="url" placeholder="https://…" />
            <FieldError :errors="errors.imageUrl" />
          </Field>

          <Field :data-invalid="!!errors.amoenusSaleItemId">
            <FieldLabel for="amoenusSaleItemId">Artículo de venta en Amoenus Central</FieldLabel>
            <Input id="amoenusSaleItemId" v-model="form.amoenusSaleItemId" autocomplete="off" />
            <FieldDescription
              >Identificador para vincularlo con Amoenus. Opcional.</FieldDescription
            >
            <FieldError :errors="errors.amoenusSaleItemId" />
          </Field>

          <Field orientation="horizontal">
            <Switch id="active" v-model="form.active" />
            <FieldLabel for="active">Activo (visible para las tiendas)</FieldLabel>
          </Field>
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button variant="outline" :disabled="isSaving" @click="open = false">Cancelar</Button>
        <Button type="submit" form="sale-article-form" :disabled="isSaving">
          {{ isSaving ? 'Guardando…' : 'Guardar' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
