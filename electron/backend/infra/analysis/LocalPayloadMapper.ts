import type { ImageAnalysisPayload } from '../../../../shared/types'
import { tryParseCaptionToPayload, stripMarkdownFence } from './AnalysisPayloadMapper'
import { sanitizeTextField } from './AnalysisTextSanitizer'

const LOCAL_PROMPT_VERSION = 'local-v1'

export function mapLocalCaptionToPayload(params: {
  caption: string
  colors: string[]
  geoText?: string | null
}): ImageAnalysisPayload {
  const structured = tryParseCaptionToPayload(params.caption, params.colors, params.geoText)
  if (structured) return structured

  console.warn('[AnalysisParse] 结构化解析失败，降级为纯文本描述', {
    rawLen: params.caption.length,
    hasMarkdownFence: /^```(?:json)?/im.test(params.caption.trim()),
    preview: params.caption.slice(0, 240).replace(/\s+/g, ' ')
  })

  const stripped = stripMarkdownFence(params.caption)
  const caption = sanitizeTextField(stripped.startsWith('{') ? '模型返回格式异常，请重新分析' : stripped)
  const location = params.geoText?.trim() ?? ''

  return {
    description: caption,
    objects: [],
    people: [],
    scene: '',
    location,
    story: '',
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
