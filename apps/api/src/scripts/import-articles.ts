/**
 * Da de alta como artículos de venta del obrador los artículos de almacén que las tiendas de
 * La Empanadera piden en Amoenus: `pnpm db:import-articles` (desde la raíz), contra `MONGODB_URI`.
 *
 * Es idempotente y solo crea: un código que ya existe se deja como está (no se pisan precios,
 * familias ni cambios hechos a mano). Al no pasar por la API no se envía el catálogo a Amoenus:
 * después, «Sincronizar con Amoenus» en Artículos de venta.
 */
import { createSaleArticleSchema } from '@cocina-central/shared'
import mongoose from 'mongoose'

import { loadConfig } from '../config/env'
import { SaleArticleModel } from '../modules/sale-articles/sale-article.model'
import { LA_EMPANADERA_ARTICLES } from './data/la-empanadera-articles'

const config = loadConfig()

await mongoose.connect(config.mongodbUri)
try {
  await SaleArticleModel.init()
  console.log(
    `Importando ${LA_EMPANADERA_ARTICLES.length} artículos en ${mongoose.connection.name}`,
  )

  let created = 0
  for (const input of LA_EMPANADERA_ARTICLES) {
    const data = createSaleArticleSchema.parse({ ...input, price: 0 })
    const result = await SaleArticleModel.updateOne(
      { code: data.code },
      { $setOnInsert: data },
      { upsert: true, timestamps: true },
    )
    created += result.upsertedCount
    console.log(`${result.upsertedCount ? 'creado   ' : 'ya existe'} ${data.code} ${data.name}`)
  }
  console.log(
    `Importación completada: ${created} creados, ${LA_EMPANADERA_ARTICLES.length - created} ya existían`,
  )
} finally {
  await mongoose.disconnect()
}
