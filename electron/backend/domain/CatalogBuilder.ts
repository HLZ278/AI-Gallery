import { basename } from 'path'
import { getDb } from '../db/DatabaseManager'
import { configService } from '../services/ConfigService'
import type { SearchQuery } from '../../../shared/types'

export interface CatalogItem {
  id: string
  fileName: string
  takenAt: number | null
  mediaType: string
  width: number
  height: number
  description: string
  scene: string
  story: string
  location: string
  trendTags: string[]
  people: string[]
  objects: string[]
  ocrText: string
}

export function buildCatalog(params: Pick<SearchQuery, 'libraryIds' | 'dateFrom' | 'dateTo' | 'mediaTypes'>): CatalogItem[] {
  const db = getDb()
  const config = configService.load()
  const conditions: string[] = ["m.analysis_status = 'done'"]
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

  const where = conditions.join(' AND ')
  const rows = db.prepare(`
    SELECT m.id, m.file_path, m.taken_at, m.media_type, m.width, m.height,
      a.description, a.scene, a.story, a.location, a.trend_tags, a.people, a.objects, a.ocr_text
    FROM media_items m
    INNER JOIN analysis_results a ON m.id = a.media_id
    WHERE ${where}
    ORDER BY m.taken_at DESC
    LIMIT ?
  `).all(...queryParams, config.search.maxCatalogItems) as Array<Record<string, unknown>>

  return rows.map(mapCatalogRow)
}

function mapCatalogRow(row: Record<string, unknown>): CatalogItem {
  return {
    id: row.id as string,
    fileName: basename(row.file_path as string),
    takenAt: (row.taken_at as number) ?? null,
    mediaType: row.media_type as string,
    width: (row.width as number) ?? 0,
    height: (row.height as number) ?? 0,
    description: (row.description as string) ?? '',
    scene: (row.scene as string) ?? '',
    story: (row.story as string) ?? '',
    location: (row.location as string) ?? '',
    trendTags: JSON.parse((row.trend_tags as string) || '[]') as string[],
    people: JSON.parse((row.people as string) || '[]') as string[],
    objects: JSON.parse((row.objects as string) || '[]') as string[],
    ocrText: (row.ocr_text as string) ?? ''
  }
}

export function formatCatalogLine(item: CatalogItem): string {
  const date = item.takenAt ? new Date(item.takenAt).toLocaleString('zh-CN') : '未知'
  const orientation = item.width > item.height ? '横图' : item.width < item.height ? '竖图' : '方图'
  const parts = [
    `[id:${item.id}]`,
    `文件:${item.fileName}`,
    `类型:${item.mediaType}`,
    `尺寸:${item.width}x${item.height}(${orientation})`,
    `时间:${date}`,
    item.description && `描述:${item.description}`,
    item.scene && `场景:${item.scene}`,
    item.story && `故事:${item.story}`,
    item.location && `位置:${item.location}`,
    item.people.length && `人物:${item.people.join('、')}`,
    item.objects.length && `物体:${item.objects.join('、')}`,
    item.trendTags.length && `标签:${item.trendTags.join('、')}`,
    item.ocrText && `文字:${item.ocrText}`
  ].filter(Boolean)
  return parts.join(' | ')
}

export function formatCatalogText(items: CatalogItem[]): string {
  return items.map(formatCatalogLine).join('\n')
}
