import type {
  AmoenusCatalogSyncResult,
  AmoenusSaleArticlesPayload,
  SaleArticle,
} from '@cocina-central/shared'
import type { FastifyBaseLogger } from 'fastify'

import { InvalidStateError } from '../../../shared/errors'
import type { SaleArticleRepository } from '../../sale-articles/sale-article.repository'
import type { SaleArticlesChangedListener } from '../../sale-articles/sale-article.service'
import type { AmoenusClient } from './amoenus.client'

const toPayload = (articles: SaleArticle[]): AmoenusSaleArticlesPayload => ({
  articles: articles.map((article) => ({
    code: article.code,
    name: article.name,
    family: article.familyName,
    price: article.price,
    active: article.active,
  })),
})

/**
 * Catálogo del obrador en Amoenus: sus artículos de venta, con el mismo código, para que las líneas
 * de los tickets casen con ellos y allí se les pueda montar el escandallo. Cada alta, cambio o baja
 * se envía al momento; si algo no llega, «Sincronizar con Amoenus» envía el catálogo entero.
 */
export class AmoenusCatalogService implements SaleArticlesChangedListener {
  private readonly saleArticles: SaleArticleRepository
  private readonly client: AmoenusClient
  private readonly log: Pick<FastifyBaseLogger, 'error'>
  private readonly enabled: boolean

  constructor(
    saleArticles: SaleArticleRepository,
    client: AmoenusClient,
    log: Pick<FastifyBaseLogger, 'error'>,
    enabled: boolean,
  ) {
    this.saleArticles = saleArticles
    this.client = client
    this.log = log
    this.enabled = enabled
  }

  /** No espera a Amoenus ni falla: el mantenimiento de artículos no depende de que responda. */
  saleArticlesChanged(articles: SaleArticle[]): void {
    if (!this.enabled) return
    this.client.sendSaleArticles(toPayload(articles)).catch((error: unknown) => {
      this.log.error(
        { err: error, codes: articles.map((article) => article.code) },
        'Error enviando artículos a Amoenus',
      )
    })
  }

  async syncAll(): Promise<AmoenusCatalogSyncResult> {
    if (!this.enabled) throw new InvalidStateError('La integración con Amoenus no está configurada')
    const articles = await this.saleArticles.findAll()
    if (articles.length === 0) return { articles: 0, error: null }
    try {
      await this.client.sendSaleArticles(toPayload(articles))
      return { articles: articles.length, error: null }
    } catch (error) {
      return { articles: 0, error: error instanceof Error ? error.message : String(error) }
    }
  }
}
