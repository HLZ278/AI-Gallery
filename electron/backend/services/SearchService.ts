import { getDb } from '../db/DatabaseManager'
import { mapAnalysisRow } from '../domain/AnalysisQueue'
import { resolveKeywordMatchIds, KEYWORD_SEARCH_FIELDS } from '../domain/KeywordSearch'
import { mapMediaRow, MEDIA_JOIN } from '../domain/MediaMapper'
import { llmSearchService } from './LLMSearchService'
import { vectorSearchService } from './VectorSearchService'
import type { SearchQuery, SearchResult, AnalysisResult } from '../../../shared/types'

export { KEYWORD_SEARCH_FIELDS }

export class SearchService {
  async query(params: SearchQuery): Promise<SearchResult> {
    if (params.mode === 'llm' && params.keyword?.trim()) {
      return llmSearchService.search(params)
    }
    if (params.mode === 'vector' && params.keyword?.trim()) {
      return vectorSearchService.search(params)
    }
    return this.keywordQuery(params)
  }

  keywordQuery(params: SearchQuery): SearchResult {
    const db = getDb()
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 60
    const offset = (page - 1) * pageSize

    const conditions: string[] = ['1=1']
    const queryParams: unknown[] = []

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

    if (params.keyword?.trim()) {
      const ftsIds = resolveKeywordMatchIds(db, params.keyword.trim())
      if (ftsIds.length === 0) {
        return { items: [], analysisMap: {}, total: 0, page, pageSize, searchMode: 'keyword' }
      }
      conditions.push(`m.id IN (${ftsIds.map(() => '?').join(',')})`)
      queryParams.push(...ftsIds)
    }

    const where = conditions.join(' AND ')
    const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM media_items m WHERE ${where}`).get(...queryParams) as { cnt: number }

    const rows = db.prepare(`
      SELECT m.*, l.name as library_name, md.duration_ms, md.frame_count FROM media_items m
      ${MEDIA_JOIN}
      WHERE ${where}
      ORDER BY m.taken_at DESC, m.imported_at DESC
      LIMIT ? OFFSET ?
    `).all(...queryParams, pageSize, offset) as Array<Record<string, unknown>>

    const items = rows.map(mapMediaRow)
    const analysisMap: Record<string, AnalysisResult> = {}

    for (const item of items) {
      const analysis = db.prepare('SELECT * FROM analysis_results WHERE media_id = ?').get(item.id) as Record<string, unknown> | undefined
      if (analysis) analysisMap[item.id] = mapAnalysisRow(analysis)
    }

    return { items, analysisMap, total: totalRow.cnt, page, pageSize, searchMode: 'keyword' }
  }

  listMedia(libraryId?: string, page = 1, pageSize = 60): Promise<SearchResult> {
    return Promise.resolve(this.keywordQuery({ libraryIds: libraryId ? [libraryId] : undefined, page, pageSize }))
  }

  getAnalysis(mediaId: string): AnalysisResult | null {
    const row = getDb().prepare('SELECT * FROM analysis_results WHERE media_id = ?').get(mediaId) as Record<string, unknown> | undefined
    return row ? mapAnalysisRow(row) : null
  }
}

export const searchService = new SearchService()
