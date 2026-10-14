import { Schema, model } from 'mongoose'

/** Numeración correlativa: un documento por serie (`order-2026`, más adelante albaranes). */
interface CounterRecord {
  _id: string
  seq: number
}

const counterSchema = new Schema<CounterRecord>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { collection: 'counters', versionKey: false },
)

const CounterModel = model<CounterRecord>('Counter', counterSchema)

/**
 * Devuelve el siguiente número de la serie. `$inc` con `upsert` es atómico en MongoDB: dos
 * peticiones simultáneas nunca reciben el mismo número.
 */
export async function nextSequence(key: string): Promise<number> {
  const counter = await CounterModel.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  ).lean<CounterRecord>()
  return counter.seq
}
