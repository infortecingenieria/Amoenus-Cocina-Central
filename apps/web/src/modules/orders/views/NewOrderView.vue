<script setup lang="ts">
import { PlusIcon } from '@lucide/vue'
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import { useOrderCartStore } from '@/stores/order-cart'

import OrderCartSummary from '../components/OrderCartSummary.vue'
import OrderQuantityField from '../components/OrderQuantityField.vue'
import SaleArticlePicker from '../components/SaleArticlePicker.vue'

const cart = useOrderCartStore()

const selectedIds = computed(() => cart.lines.map((line) => line.article.id))
</script>

<template>
  <div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
    <section class="flex flex-col gap-6 rounded-2xl bg-card p-6 shadow-sm">
      <header>
        <h1 class="text-2xl font-bold">Nuevo pedido</h1>
        <p class="text-muted-foreground">
          Elige los artículos y cuántos formatos necesitas. El obrador validará el pedido.
        </p>
      </header>

      <!-- Si el obrador ha cambiado un precio o un nombre, el carrito se pone al día. -->
      <SaleArticlePicker :selected-ids="selectedIds" @loaded="cart.syncArticles">
        <template #action="{ article }">
          <OrderQuantityField
            v-if="cart.quantityOf(article.id) > 0"
            :model-value="cart.quantityOf(article.id)"
            :label="`Cantidad de ${article.name}`"
            @update:model-value="(value: number) => cart.setQuantity(article, value)"
          />
          <Button
            v-else
            variant="outline"
            size="sm"
            class="w-32"
            @click="cart.setQuantity(article, 1)"
          >
            <PlusIcon />
            Añadir
          </Button>
        </template>
      </SaleArticlePicker>
    </section>

    <OrderCartSummary class="xl:sticky xl:top-4" />
  </div>
</template>
