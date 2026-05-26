import type Database from 'better-sqlite3'

export const KEYWORD_SEARCH_FIELDS = [
  { table: 'a', column: 'description', label: '综合描述' },
  { table: 'a', column: 'scene', label: '场景' },
  { table: 'a', column: 'story', label: '故事' },
  { table: 'a', column: 'location', label: '位置' },
  { table: 'a', column: 'people', label: '人物' },
  { table: 'a', column: 'objects', label: '物体' },
  { table: 'a', column: 'trend_tags', label: '潮流标签' },
  { table: 'a', column: 'mood', label: '氛围' },
  { table: 'a', column: 'colors', label: '主色调' },
  { table: 'a', column: 'ocr_text', label: '图中文字' },
  { table: 'md', column: 'geo_text', label: 'GPS坐标' },
  { table: 'm', column: 'file_path', label: '文件路径' }
] as const

export function normalizeSearchText(text: string): string {
  return text.replace(/[\s\u00a0\u3000]+/g, '')
}

function fieldMatchSql(table: string, column: string): string {
  const col = `COALESCE(${table}.${column}, '')`
  const colNorm = `REPLACE(REPLACE(${col}, ' ', ''), char(12288), '')`
  return `(${col} LIKE ? OR ${colNorm} LIKE ?)`
}

export function keywordSearchIds(db: Database.Database, keyword: string): string[] {
  const terms = keyword.split(/\s+/).map((t) => t.trim()).filter(Boolean)
  if (terms.length === 0) return []

  const idSet = new Set<string>()

  for (const term of terms) {
    const like = `%${term}%`
    const likeNorm = `%${normalizeSearchText(term)}%`
    const conditions = KEYWORD_SEARCH_FIELDS.map(({ table, column }) => fieldMatchSql(table, column)).join(' OR ')
    const params = KEYWORD_SEARCH_FIELDS.flatMap(() => [like, likeNorm])

    const rows = db.prepare(`
      SELECT DISTINCT m.id as media_id FROM media_items m
      LEFT JOIN analysis_results a ON m.id = a.media_id
      LEFT JOIN media_metadata md ON md.media_id = m.id
      WHERE ${conditions}
    `).all(...params) as Array<{ media_id: string }>

    for (const row of rows) {
      if (row.media_id) idSet.add(row.media_id)
    }
  }

  return Array.from(idSet)
}

function isShortAsciiToken(keyword: string): boolean {
  return keyword.length <= 4 && /^[\x00-\x7f]+$/.test(keyword)
}

function ftsSearchIds(db: Database.Database, keyword: string): string[] {
  try {
    const escaped = keyword.replace(/"/g, '""')
    const ftsRows = db.prepare(`SELECT media_id FROM media_fts WHERE media_fts MATCH ?`).all(`"${escaped}"*`) as Array<{ media_id: string }>
    return ftsRows.map((r) => r.media_id)
  } catch {
    return []
  }
}

export function resolveKeywordMatchIds(db: Database.Database, keyword: string): string[] {
  const trimmed = keyword.trim()
  if (!trimmed) return []

  const idSet = new Set<string>(keywordSearchIds(db, trimmed))
  if (!isShortAsciiToken(trimmed)) {
    for (const id of ftsSearchIds(db, trimmed)) idSet.add(id)
  }
  return Array.from(idSet)
}
