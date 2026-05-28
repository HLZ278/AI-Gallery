import type { ImageAnalysisPayload } from '../../../../shared/types'

/** 本地模型常用中文字段名 → 标准 payload 字段 */
const CHINESE_FIELD_ALIASES: Record<string, keyof ImageAnalysisPayload | 'is_meme'> = {
  综合描述: 'description',
  描述: 'description',
  主要物体: 'objects',
  物体: 'objects',
  人物: 'people',
  场景: 'scene',
  位置: 'location',
  情境故事: 'story',
  故事: 'story',
  '标签/梗/事件/作品名': 'trend_tags',
  标签: 'trend_tags',
  潮流标签: 'trend_tags',
  氛围: 'mood',
  主色: 'colors',
  主色调: 'colors',
  图中文字: 'ocr_text',
  是否梗图: 'is_meme',
  '关联 IP/作品/游戏/综艺/品牌': 'ip_references',
  '关联 IP': 'ip_references'
}

export function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced?.[1] ?? trimmed).trim()
  const jsonMatch = candidate.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return null
  }
  return null
}

export function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.map(String).map((s) => s.trim()).filter(Boolean)
  }
  if (typeof val === 'string') {
    const s = val.trim()
    if (!s || s === '无' || s === '未识别' || s === '无法确定') return []
    return [s]
  }
  return []
}

function parseBooleanField(val: unknown): boolean {
  if (typeof val === 'boolean') return val
  const s = String(val).trim().toLowerCase()
  return s === 'true' || s === '是' || s === 'yes' || s === '1'
}

function normalizeRawKeys(raw: Record<string, unknown>): Record<string, unknown> {
  if ('description' in raw || 'objects' in raw || 'people' in raw) {
    return raw
  }
  const out: Record<string, unknown> = { ...raw }
  for (const [key, value] of Object.entries(raw)) {
    const mapped = CHINESE_FIELD_ALIASES[key.trim()]
    if (mapped && out[mapped] === undefined) {
      out[mapped] = value
    }
  }
  return out
}

export function mapStructuredPayload(raw: Record<string, unknown>): ImageAnalysisPayload {
  const n = normalizeRawKeys(raw)
  return {
    description: String(n.description ?? ''),
    objects: toStringArray(n.objects),
    people: toStringArray(n.people),
    scene: String(n.scene ?? ''),
    location: String(n.location ?? ''),
    story: String(n.story ?? ''),
    trend_tags: toStringArray(n.trend_tags),
    mood: String(n.mood ?? ''),
    colors: toStringArray(n.colors),
    ocr_text: String(n.ocr_text ?? ''),
    is_meme: parseBooleanField(n.is_meme),
    ip_references: toStringArray(n.ip_references)
  }
}

export function tryParseCaptionToPayload(
  caption: string,
  dominantColors: string[],
  geoText?: string | null
): ImageAnalysisPayload | null {
  const raw = extractJsonObject(caption)
  if (!raw) return null

  const payload = mapStructuredPayload(raw)
  const geo = geoText?.trim()
  const loc = payload.location.trim()
  if (geo && (!loc || loc === '无法确定' || loc === '未识别')) {
    payload.location = geo
  }
  if (payload.colors.length === 0 && dominantColors.length > 0) {
    payload.colors = dominantColors
  }
  if (!payload.description.trim()) {
    const parts = [payload.scene, payload.story].filter(Boolean)
    payload.description = parts.join('；') || caption.trim()
  }
  return payload
}
