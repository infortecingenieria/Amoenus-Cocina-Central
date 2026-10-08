/**
 * Datos iniciales para desarrollo local: `pnpm db:seed` (desde la raíz).
 * Es idempotente: crea o actualiza por código, nunca duplica ni borra otros datos.
 */
import { createSaleArticleSchema, type CreateSaleArticleInput } from '@cocina-central/shared'
import mongoose from 'mongoose'

import { loadConfig } from '../config/env'
import { SaleArticleModel } from '../modules/sale-articles/sale-article.model'

const SALE_ARTICLES: CreateSaleArticleInput[] = [
  {
    code: 'BAR-001',
    name: 'Barra Rústica Tradicional',
    format: 'tray',
    unitsPerFormat: 12,
    price: 1.45,
  },
  {
    code: 'CRO-001',
    name: 'Croissant Mantequilla',
    format: 'box',
    unitsPerFormat: 30,
    price: 0.85,
  },
  { code: 'HOG-001', name: 'Hogaza Centeno', format: 'tray', unitsPerFormat: 12, price: 2.1 },
  { code: 'NAP-001', name: 'Napolitana de Crema', format: 'tray', unitsPerFormat: 12, price: 1.2 },
  { code: 'EMP-001', name: 'Empanadilla de Atún', format: 'box', unitsPerFormat: 30, price: 0.95 },
]

const config = loadConfig()
if (config.nodeEnv === 'production') {
  throw new Error('El seed es solo para desarrollo: NODE_ENV=production')
}

await mongoose.connect(config.mongodbUri)
try {
  await SaleArticleModel.init()
  for (const input of SALE_ARTICLES) {
    const data = createSaleArticleSchema.parse(input)
    const result = await SaleArticleModel.updateOne(
      { code: data.code },
      { $set: data },
      { upsert: true },
    )
    console.log(`${result.upsertedCount ? 'creado     ' : 'actualizado'} ${data.code} ${data.name}`)
  }
  console.log(`Seed completado en ${mongoose.connection.name}`)
} finally {
  await mongoose.disconnect()
}
