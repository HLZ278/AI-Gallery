import { getDb } from '../db/DatabaseManager'
import { configService } from './ConfigService'
import { embeddingClient } from '../infra/EmbeddingClient'
import { buildEmbeddingDocument } from '../domain/EmbeddingTextBuilder'
import { mapAnalysisRow } from '../domain/AnalysisQueue'

export class EmbeddingService {
  async indexMedia(mediaId: string): Promise<void> {
    const config = configService.load()
    if (!config.embedding.enabled) return

    const db = getDb()
    const row = db.prepare('SELECT * FROM analysis_results WHERE media_id = ?').get(mediaId) as Record<string, unknown> | undefined
    if (!row) return

    const analysis = mapAnalysisRow(row)
    const geoRow = db.prepare('SELECT geo_text FROM media_metadata WHERE media_id = ?').get(mediaId) as
      | { geo_text?: string | null }
      | undefined
    const document = buildEmbeddingDocument(analysis, geoRow?.geo_text)
    if (!document.trim()) return

    const vector = await embeddingClient.embed(document)
    db.prepare(`
      INSERT INTO media_embeddings (media_id, embedding, source_text, model_name, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(media_id) DO UPDATE SET
        embedding = excluded.embedding,
        source_text = excluded.source_text,
        model_name = excluded.model_name,
        updated_at = excluded.updated_at
    `).run(mediaId, JSON.stringify(vector), document, config.embedding.model, Date.now())
  }

  scheduleIndex(mediaId: string): void {
    const config = configService.load()
    if (!config.embedding.enabled || !config.embedding.autoIndexOnAnalysis) return
    this.indexMedia(mediaId).catch((err) => console.error(`Embedding index failed for ${mediaId}:`, err))
  }

  async backfillMissing(): Promise<{ indexed: number; failed: number; skipped: number }> {
    const config = configService.load()
    if (!config.embedding.enabled) {
      return { indexed: 0, failed: 0, skipped: 0 }
    }

    const db = getDb()
    const rows = db.prepare(`
      SELECT a.media_id FROM analysis_results a
      LEFT JOIN media_embeddings e ON a.media_id = e.media_id
        AND (e.model_name IS NULL OR e.model_name = ?)
      WHERE e.media_id IS NULL
    `).all(config.embedding.model) as Array<{ media_id: string }>

    let indexed = 0
    let failed = 0
    for (const { media_id } of rows) {
      try {
        await this.indexMedia(media_id)
        const exists = db.prepare('SELECT 1 FROM media_embeddings WHERE media_id = ?').get(media_id)
        if (exists) indexed++
        else failed++
      } catch {
        failed++
      }
    }
    return { indexed, failed, skipped: 0 }
  }

  getStats(): { total: number; indexed: number; pending: number; staleModel: number; enabled: boolean } {
    const config = configService.load()
    const db = getDb()
    const model = config.embedding.model
    const total = (db.prepare(`SELECT COUNT(*) as cnt FROM analysis_results`).get() as { cnt: number }).cnt
    const indexed = (
      db.prepare(
        `SELECT COUNT(*) as cnt FROM media_embeddings WHERE model_name IS NULL OR model_name = ?`
      ).get(model) as { cnt: number }
    ).cnt
    const staleModel = (
      db.prepare(`SELECT COUNT(*) as cnt FROM media_embeddings WHERE model_name IS NOT NULL AND model_name != ?`).get(
        model
      ) as { cnt: number }
    ).cnt
    return {
      total,
      indexed,
      pending: Math.max(0, total - indexed),
      staleModel,
      enabled: config.embedding.enabled
    }
  }
}

export const embeddingService = new EmbeddingService()
