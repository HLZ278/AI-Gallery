import type { ImageAnalysisPayload } from '../../../../shared/types'
import { tryParseCaptionToPayload } from './AnalysisPayloadMapper'
import { mapLocalCaptionToPayload, mergeFrameCaptions } from './LocalPayloadMapper'
import { sanitizeAnalysisPayload } from './AnalysisTextSanitizer'

const PLACEHOLDER = new Set(['', '无', '未识别', '未提供', '无法确定'])

function uniqStrings(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter((v) => v && !PLACEHOLDER.has(v)))]
}

function pickBestString(values: string[]): string {
  const candidates = uniqStrings(values)
  if (candidates.length === 0) return ''
  candidates.sort((a, b) => b.length - a.length)
  return candidates[0]
}

function mergePayloadList(payloads: ImageAnalysisPayload[]): ImageAnalysisPayload {
  return sanitizeAnalysisPayload({
    description: pickBestString(payloads.map((p) => p.description)),
    objects: uniqStrings(payloads.flatMap((p) => p.objects)),
    people: uniqStrings(payloads.flatMap((p) => p.people)),
    scene: pickBestString(payloads.map((p) => p.scene)),
    location: pickBestString(payloads.map((p) => p.location)),
    story: uniqStrings(payloads.map((p) => p.story)).join('；'),
    trend_tags: uniqStrings(payloads.flatMap((p) => p.trend_tags)),
    mood: pickBestString(payloads.map((p) => p.mood)),
    colors: uniqStrings(payloads.flatMap((p) => p.colors)),
    ocr_text: pickBestString(payloads.map((p) => p.ocr_text)),
    is_meme: payloads.some((p) => p.is_meme),
    ip_references: uniqStrings(payloads.flatMap((p) => p.ip_references))
  })
}

/** 逐帧解析 JSON 后合并字段，避免多段 JSON 字符串拼接导致解析失败 */
export function mergeFrameCaptionsToPayload(params: {
  frameCaptions: string[]
  colors: string[]
  geoText?: string | null
}): ImageAnalysisPayload {
  const payloads: ImageAnalysisPayload[] = []
  for (const caption of params.frameCaptions) {
    const parsed = tryParseCaptionToPayload(caption, [], params.geoText)
    if (parsed) payloads.push(parsed)
  }

  if (payloads.length > 0) {
    const merged = mergePayloadList(payloads)
    if (merged.colors.length === 0 && params.colors.length > 0) {
      merged.colors = params.colors
    }
    const geo = params.geoText?.trim()
    const loc = merged.location.trim()
    if (geo && (!loc || PLACEHOLDER.has(loc))) {
      merged.location = geo
    }
    if (!merged.description.trim()) {
      merged.description = pickBestString(payloads.map((p) => [p.scene, p.story].filter(Boolean).join('；')))
    }
    return merged
  }

  const mergedText = mergeFrameCaptions(params.frameCaptions)
  return mapLocalCaptionToPayload({
    caption: mergedText,
    colors: params.colors,
    geoText: params.geoText
  })
}
