import type { ImageAnalysisPayload } from '../../../shared/types'

export function parseAnalysisExtendedFields(rawJson: string): Pick<ImageAnalysisPayload, 'ip_references' | 'is_meme'> {
  try {
    const raw = JSON.parse(rawJson) as Record<string, unknown>
    const ipRaw = raw.ip_references
    const ip_references = Array.isArray(ipRaw)
      ? ipRaw.map(String).filter(Boolean)
      : typeof ipRaw === 'string' && ipRaw
        ? [ipRaw]
        : []
    return {
      ip_references,
      is_meme: Boolean(raw.is_meme)
    }
  } catch {
    return { ip_references: [], is_meme: false }
  }
}

export function toAnalysisFtsPayload(payload: ImageAnalysisPayload): {
  description: string
  objects: string[]
  people: string[]
  scene: string
  location: string
  story: string
  trend_tags: string[]
  ocr_text: string
  ip_references: string[]
} {
  return {
    description: payload.description,
    objects: payload.objects,
    people: payload.people,
    scene: payload.scene,
    location: payload.location,
    story: payload.story,
    trend_tags: payload.trend_tags,
    ocr_text: payload.ocr_text,
    ip_references: payload.ip_references ?? []
  }
}
