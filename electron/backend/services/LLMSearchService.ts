import OpenAI from 'openai'
import { configService } from './ConfigService'
import { promptBuilder } from '../domain/PromptBuilder'
import { buildCatalog, formatCatalogLine } from '../domain/CatalogBuilder'
import { mapMediaRow } from '../domain/MediaMapper'
import { mapAnalysisRow } from '../domain/AnalysisQueue'
import { getDb } from '../db/DatabaseManager'
import type { SearchQuery, SearchResult } from '../../../shared/types'

function extractJson(text: string): Record<string, unknown> {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in LLM search response')
  return JSON.parse(jsonMatch[0]) as Record<string, unknown>
}

export class LLMSearchService {
  async search(params: SearchQuery): Promise<SearchResult> {
    const query = params.keyword?.trim()
    if (!query) {
      return { items: [], analysisMap: {}, total: 0, page: 1, pageSize: params.pageSize ?? 60, searchMode: 'llm' }
    }

    const catalog = buildCatalog(params)
    if (catalog.length === 0) {
      return {
        items: [],
        analysisMap: {},
        total: 0,
        page: 1,
        pageSize: params.pageSize ?? 60,
        searchMode: 'llm',
        llmReason: '当前图库中没有已完成分析的图片，请先等待分析完成'
      }
    }

    const config = configService.load()
    const matchedIds: string[] = []
    const reasons: string[] = []

    for (let i = 0; i < catalog.length; i += config.search.chunkSize) {
      const chunk = catalog.slice(i, i + config.search.chunkSize)
      const result = await this.searchChunk(query, chunk)
      for (const id of result.matched_ids) {
        if (!matchedIds.includes(id)) matchedIds.push(id)
      }
      if (result.reason) reasons.push(result.reason)
    }

    return this.buildResult(matchedIds, params, reasons.join('；'))
  }

  private async searchChunk(query: string, catalog: ReturnType<typeof buildCatalog>): Promise<{ matched_ids: string[]; reason: string }> {
    const config = configService.load()
    const prompt = promptBuilder.loadSearchPrompt()
    const catalogText = catalog.map(formatCatalogLine).join('\n')
    const userPrompt = promptBuilder.buildSearchUserPrompt(prompt, {
      query,
      count: catalog.length,
      catalog: catalogText
    })

    const client = new OpenAI({
      apiKey: config.llm.apiKey,
      baseURL: config.llm.baseUrl,
      timeout: config.llm.timeoutMs
    })

    const response = await client.chat.completions.create({
      model: config.llm.model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 4096
    })

    const content = response.choices[0]?.message?.content ?? ''
    const raw = extractJson(typeof content === 'string' ? content : JSON.stringify(content))
    const matched = Array.isArray(raw.matched_ids) ? raw.matched_ids.map(String) : []
    return { matched_ids: matched, reason: String(raw.reason ?? '') }
  }

  private buildResult(matchedIds: string[], params: SearchQuery, llmReason: string): SearchResult {
    if (matchedIds.length === 0) {
      return {
        items: [],
        analysisMap: {},
        total: 0,
        page: 1,
        pageSize: params.pageSize ?? 60,
        searchMode: 'llm',
        llmReason: llmReason || '未找到语义匹配的图片'
      }
    }

    const db = getDb()
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 60
    const offset = (page - 1) * pageSize
    const pageIds = matchedIds.slice(offset, offset + pageSize)

    if (pageIds.length === 0) {
      return {
        items: [],
        analysisMap: {},
        total: matchedIds.length,
        page,
        pageSize,
        searchMode: 'llm',
        llmReason
      }
    }

    const placeholders = pageIds.map(() => '?').join(',')
    const orderCase = pageIds.map((id, idx) => `WHEN '${id}' THEN ${idx}`).join(' ')
    const rows = db.prepare(`
      SELECT m.*, l.name as library_name, md.duration_ms, md.frame_count FROM media_items m
      LEFT JOIN libraries l ON m.library_id = l.id
      LEFT JOIN media_metadata md ON md.media_id = m.id
      WHERE m.id IN (${placeholders})
      ORDER BY CASE m.id ${orderCase} END
    `).all(...pageIds) as Array<Record<string, unknown>>

    const items = rows.map(mapMediaRow)
    const analysisMap: SearchResult['analysisMap'] = {}

    for (const item of items) {
      const analysis = db.prepare('SELECT * FROM analysis_results WHERE media_id = ?').get(item.id) as Record<string, unknown> | undefined
      if (analysis) analysisMap[item.id] = mapAnalysisRow(analysis)
    }

    return {
      items,
      analysisMap,
      total: matchedIds.length,
      page,
      pageSize,
      searchMode: 'llm',
      llmReason
    }
  }
}

export const llmSearchService = new LLMSearchService()
