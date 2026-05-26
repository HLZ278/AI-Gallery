import { getDb } from '../db/DatabaseManager'
import { configService } from './ConfigService'
import { embeddingClient, cosineSimilarity } from '../infra/EmbeddingClient'
import { mapAnalysisRow } from '../domain/AnalysisQueue'
import { mapMediaRow, MEDIA_JOIN } from '../domain/MediaMapper'
import type { SearchQuery, SearchResult } from '../../../shared/types'

interface ScoredId {
  mediaId: string
  score: number
}

export class VectorSearchService {
  async search(params: SearchQuery): Promise<SearchResult> {
    const query = params.keyword?.trim()
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 60
    const config = configService.load()

    if (!query) {
      return { items: [], analysisMap: {}, total: 0, page, pageSize, searchMode: 'vector' }
    }

    if (!config.embedding.enabled) {
      return {
        items: [],
        analysisMap: {},
        total: 0,
        page,
        pageSize,
        searchMode: 'vector',
        llmReason: '向量索引已在设置中关闭，请开启「启用向量索引」后补建索引'
      }
    }

    const db = getDb()
    const model = config.embedding.model
    const stats = db.prepare(
      'SELECT COUNT(*) as cnt FROM media_embeddings WHERE model_name IS NULL OR model_name = ?'
    ).get(model) as { cnt: number }

    if (stats.cnt === 0) {
      const stale = db.prepare(
        'SELECT COUNT(*) as cnt FROM media_embeddings WHERE model_name IS NOT NULL AND model_name != ?'
      ).get(model) as { cnt: number }
      if (stale.cnt > 0) {
        return {
          items: [],
          analysisMap: {},
          total: 0,
          page,
          pageSize,
          searchMode: 'vector',
          llmReason: `向量索引模型已变更（当前 ${model}），请在设置中点击「重新建立向量索引」`
        }
      }
      return {
        items: [],
        analysisMap: {},
        total: 0,
        page,
        pageSize,
        searchMode: 'vector',
        llmReason: '尚无向量索引，请在设置中开启向量索引并点击「补建向量索引」'
      }
    }

    const queryVector = await embeddingClient.embed(query)
    const candidates = this.loadCandidates(params, model)
    const minScore = config.embedding.minScore

    const scored: ScoredId[] = []
    let dimensionMismatch = 0
    for (const c of candidates) {
      if (c.vector.length !== queryVector.length) {
        dimensionMismatch++
        continue
      }
      const score = cosineSimilarity(queryVector, c.vector)
      if (score >= minScore) scored.push({ mediaId: c.mediaId, score })
    }

    if (scored.length === 0 && dimensionMismatch > 0) {
      return {
        items: [],
        analysisMap: {},
        total: 0,
        page,
        pageSize,
        searchMode: 'vector',
        llmReason: '向量维度与当前模型不一致，请在设置中重新建立向量索引'
      }
    }

    scored.sort((a, b) => b.score - a.score)
    const topK = Math.max(config.embedding.topK, pageSize)
    const limited = scored.slice(0, topK)
    const total = limited.length
    const offset = (page - 1) * pageSize
    const pageItems = limited.slice(offset, offset + pageSize)

    if (pageItems.length === 0) {
      return {
        items: [],
        analysisMap: {},
        total: 0,
        page,
        pageSize,
        searchMode: 'vector',
        llmReason: `未找到相似度 ≥ ${minScore} 的结果，可尝试降低设置中的「最低相似度」`
      }
    }

    const scoreMap = Object.fromEntries(pageItems.map((p) => [p.mediaId, p.score]))
    const placeholders = pageItems.map(() => '?').join(',')
    const orderCase = pageItems.map((p, idx) => `WHEN '${p.mediaId}' THEN ${idx}`).join(' ')

    const rows = db.prepare(`
      SELECT m.*, l.name as library_name, md.duration_ms, md.frame_count FROM media_items m
      ${MEDIA_JOIN}
      WHERE m.id IN (${placeholders})
      ORDER BY CASE m.id ${orderCase} END
    `).all(...pageItems.map((p) => p.mediaId)) as Array<Record<string, unknown>>

    const items = rows.map(mapMediaRow)
    const analysisMap: SearchResult['analysisMap'] = {}
    const vectorScoreMap: Record<string, number> = {}

    for (const item of items) {
      vectorScoreMap[item.id] = scoreMap[item.id] ?? 0
      const analysis = db.prepare('SELECT * FROM analysis_results WHERE media_id = ?').get(item.id) as Record<string, unknown> | undefined
      if (analysis) analysisMap[item.id] = mapAnalysisRow(analysis)
    }

    const topScore = pageItems[0]?.score ?? 0
    return {
      items,
      analysisMap,
      total,
      page,
      pageSize,
      searchMode: 'vector',
      llmReason: `向量语义匹配，最高相似度 ${(topScore * 100).toFixed(1)}%`,
      vectorScoreMap
    }
  }

  private loadCandidates(params: SearchQuery, model: string): Array<{ mediaId: string; vector: number[] }> {
    const db = getDb()
    const conditions: string[] = ['(e.model_name IS NULL OR e.model_name = ?)']
    const queryParams: unknown[] = [model]

    if (params.libraryIds?.length) {
      conditions.push(`m.library_id IN (${params.libraryIds.map(() => '?').join(',')})`)
      queryParams.push(...params.libraryIds)
    }
    if (params.dateFrom) {
      conditions.push('m.taken_at >= ?')
      queryParams.push(params.dateFrom)
    }
    if (params.dateTo) {
      conditions.push('m.taken_at <= ?')
      queryParams.push(params.dateTo)
    }
    if (params.mediaTypes?.length) {
      conditions.push(`m.media_type IN (${params.mediaTypes.map(() => '?').join(',')})`)
      queryParams.push(...params.mediaTypes)
    }

    const where = conditions.join(' AND ')
    const rows = db.prepare(`
      SELECT e.media_id, e.embedding FROM media_embeddings e
      INNER JOIN media_items m ON m.id = e.media_id
      WHERE ${where}
    `).all(...queryParams) as Array<{ media_id: string; embedding: string }>

    return rows.map((r) => ({
      mediaId: r.media_id,
      vector: JSON.parse(r.embedding) as number[]
    }))
  }
}

export const vectorSearchService = new VectorSearchService()
