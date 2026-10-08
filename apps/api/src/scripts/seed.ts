/**
 * Datos iniciales para desarrollo local: `pnpm db:seed` (desde la raíz).
 * Es idempotente: crea o actualiza por nombre (familias) y por código o nombre (artículos), nunca
 * duplica ni borra otros datos.
 */
import {
  createFamilySchema,
  createSaleArticleSchema,
  type CreateSaleArticleInput,
} from '@cocina-central/shared'
import mongoose from 'mongoose'

import { loadConfig } from '../config/env'
import { FAMILY_NAME_COLLATION, FamilyModel } from '../modules/families/family.model'
import { SaleArticleModel } from '../modules/sale-articles/sale-article.model'

const FAMILIES = ['Panadería', 'Bollería', 'Salados'] as const
type FamilyName = (typeof FAMILIES)[number]

const SALE_ARTICLES: (Omit<CreateSaleArticleInput, 'familyId'> & { family: FamilyName })[] = [
  {
    code: '10001',
    name: 'Barra Rústica Tradicional',
    family: 'Panadería',
    format: 'tray',
    unitsPerFormat: 12,
    price: 1.45,
  },
  {
    code: '20001',
    name: 'Croissant Mantequilla',
    family: 'Bollería',
    format: 'box',
    unitsPerFormat: 30,
    price: 0.85,
  },
  {
    code: '10002',
    name: 'Hogaza Centeno',
    family: 'Panadería',
    format: 'tray',
    unitsPerFormat: 12,
    price: 2.1,
  },
  {
    code: '20002',
    name: 'Napolitana de Crema',
    family: 'Bollería',
    format: 'tray',
    unitsPerFormat: 12,
    price: 1.2,
  },
  {
    code: '30001',
    name: 'Empanadilla de Atún',
    family: 'Salados',
    format: 'box',
    unitsPerFormat: 30,
    price: 0.95,
  },
]

const config = loadConfig()
if (config.nodeEnv === 'production') {
  throw new Error('El seed es solo para desarrollo: NODE_ENV=production')
}

await mongoose.connect(config.mongodbUri)
try {
  await Promise.all([FamilyModel.init(), SaleArticleModel.init()])

  const familyIds = new Map<FamilyName, string>()
  for (const name of FAMILIES) {
    const data = createFamilySchema.parse({ name })
    const family = await FamilyModel.findOneAndUpdate(
      { name: data.name },
      { $set: data },
      { upsert: true, returnDocument: 'after', collation: FAMILY_NAME_COLLATION },
    ).lean()
    familyIds.set(name, family._id.toString())
    console.log(`familia     ${data.name}`)
  }

  for (const { family, ...input } of SALE_ARTICLES) {
    const data = createSaleArticleSchema.parse({ ...input, familyId: familyIds.get(family) })
    // También por nombre: así un artículo de ejemplo sembrado con un código antiguo
    // (p. ej. «BAR-001», antes de exigir 5 dígitos) se renombra en lugar de duplicarse.
    const result = await SaleArticleModel.updateOne(
      { $or: [{ code: data.code }, { name: data.name }] },
      { $set: data },
      { upsert: true },
    )
    console.log(`${result.upsertedCount ? 'creado     ' : 'actualizado'} ${data.code} ${data.name}`)
  }
  console.log(`Seed completado en ${mongoose.connection.name}`)
} finally {
  await mongoose.disconnect()
}
