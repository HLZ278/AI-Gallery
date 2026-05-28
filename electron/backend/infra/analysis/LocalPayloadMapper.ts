import type { ImageAnalysisPayload } from '../../../../shared/types'
import { tryParseCaptionToPayload } from './AnalysisPayloadMapper'

const LOCAL_PROMPT_VERSION = 'local-v1'

export function mapLocalCaptionToPayload(params: {
  caption: string
  colors: string[]
  geoText?: string | null
}): ImageAnalysisPayload {
  const structured = tryParseCaptionToPayload(params.caption, params.colors, params.geoText)
  if (structured) return structured

  const caption = params.caption.trim()
  const location = params.geoText?.trim() ?? ''

  return {
    description: caption,
    objects: [],
    people: [],
    scene: caption,
    location,
    story: caption,
    trend_tags: [],
    mood: '',
    colors: params.colors,
    ocr_text: '',
    is_meme: false,
    ip_references: []
  }
}

export function mergeFrameCaptions(captions: string[]): string {
  const unique = [...new Set(captions.map((c) => c.trim()).filter(Boolean))]
  if (unique.length === 0) return ''
  unique.sort((a, b) => b.length - a.length)
  return unique.join('；')
}

export function getLocalPromptVersion(): string {
  return LOCAL_PROMPT_VERSION
}
