import type { ImageAnalysisPayload } from '../../../../shared/types'
import { sanitizeAnalysisPayload } from './AnalysisTextSanitizer'

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

export function stripMarkdownFence(text: string): string {
  const trimmed = text.trim()
  const closed = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i)
  if (closed) return closed[1].trim()
  if (/^```(?:json)?/i.test(trimmed)) {
    return trimmed.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
  }
  return trimmed
}

export function extractJsonObject(text: string): Record<string, unknown> | null {
  const candidate = stripMarkdownFence(text)
  const jsonStart = candidate.indexOf('{')
  if (jsonStart < 0) return null

  const jsonText = candidate.slice(jsonStart)
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/)

  if (jsonMatch) {
    const attempts = [jsonMatch[0], repairTruncatedJson(jsonMatch[0])]
    for (const attempt of attempts) {
      if (!attempt) continue
      try {
        const parsed = JSON.parse(attempt) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>
        }
      } catch {
        /* 尝试下一种修复 */
      }
    }
    const partial = tryExtractPartialJson(jsonMatch[0])
    if (partial) return partial
  }

  // 模型输出被 num_predict 截断、缺少闭合 } 时仍尝试字段级提取
  return tryExtractPartialJson(jsonText)
}

/** 截断或损坏的 ocr_text 常导致 JSON 无法闭合，先替换该字段再解析 */
function repairTruncatedJson(json: string): string | null {
  const withoutOcr = json.replace(/"ocr_text"\s*:\s*"[\s\S]*?(?=",\s*"[a-z_]+"\s*:)/i, '"ocr_text":""')
  if (withoutOcr === json) return null
  const closed = withoutOcr.endsWith('}') ? withoutOcr : `${withoutOcr}}`
  return closed
}

/** JSON 整体解析失败时，用正则提取主要字段 */
function tryExtractPartialJson(json: string): Record<string, unknown> | null {
  const pickString = (key: string): string | undefined => {
    const m = json.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 's'))
    return m?.[1]?.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  const pickArray = (key: string): string[] | undefined => {
    const m = json.match(new RegExp(`"${key}"\\s*:\\s*\\[(.*?)\\]`, 's'))
    if (!m) return undefined
    try {
      const arr = JSON.parse(`[${m[1]}]`) as unknown
      return Array.isArray(arr) ? arr.map(String) : undefined
    } catch {
      return undefined
    }
  }

  const description = pickString('description')
  if (!description) return null

  return {
    description,
    objects: pickArray('objects') ?? [],
    people: pickArray('people') ?? [],
    scene: pickString('scene') ?? '',
    location: pickString('location') ?? '',
    story: pickString('story') ?? '',
    trend_tags: pickArray('trend_tags') ?? [],
    mood: pickString('mood') ?? '',
    colors: pickArray('colors') ?? [],
    ocr_text: pickString('ocr_text') ?? '',
    is_meme: pickString('is_meme') === 'true',
    ip_references: pickArray('ip_references') ?? []
  }
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
  return sanitizeAnalysisPayload({
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
  })
}

export function tryParseCaptionToPayload(
  caption: string,
  dominantColors: string[],
  geoText?: string | null
): ImageAnalysisPayload | null {
  const hasFence = /^```(?:json)?/im.test(caption.trim())
  const raw = extractJsonObject(caption)

  console.log('[AnalysisParse] 尝试解析模型输出', {
    rawLen: caption.length,
    hasMarkdownFence: hasFence,
    preview: caption.slice(0, 160).replace(/\s+/g, ' '),
    parsed: Boolean(raw),
    mode: raw ? (caption.match(/\{[\s\S]*\}/) ? 'full-or-partial-json' : 'partial-fields') : 'failed'
  })

  if (!raw) return null

  const payload = mapStructuredPayload(raw)
  console.log('[AnalysisParse] 解析成功', {
    descriptionLen: payload.description.length,
    objects: payload.objects.length,
    scene: payload.scene.slice(0, 40)
  })

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
    payload.description = parts.join('；') || stripMarkdownFence(caption).slice(0, 500)
  }
  return payload
}
