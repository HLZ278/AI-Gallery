import type { ImageAnalysisPayload } from '../../../../shared/types'
import { loadAnalysisLimitsConfig } from './AnalysisLimitsConfig'

export function truncateText(text: string, maxChars: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxChars) return trimmed
  return `${trimmed.slice(0, maxChars)}…`
}

/** 折叠连续重复的子串（常见于 OCR/LaTeX 幻觉循环） */
export function collapseRepetitiveRuns(
  text: string,
  minUnitLen: number,
  maxRuns: number
): string {
  const repeatMatch = text.match(/(.{6,80}?)\1{2,}/s)
  if (repeatMatch) {
    const unit = repeatMatch[1]
    if (unit.length >= minUnitLen) {
      return unit.repeat(Math.max(1, maxRuns)) + '…(已省略重复内容)'
    }
  }
  return text
}

export function sanitizeOcrText(text: string): string {
  const cfg = loadAnalysisLimitsConfig()
  let out = text.trim()
  if (!out || out === '无' || out === '未识别') return ''
  out = collapseRepetitiveRuns(out, cfg.ocrRepeatMinUnitLen, cfg.ocrRepeatMaxRuns)
  return truncateText(out, cfg.ocrTextMaxChars)
}

export function sanitizeTextField(text: string): string {
  const cfg = loadAnalysisLimitsConfig()
  return truncateText(text, cfg.textFieldMaxChars)
}

export function sanitizeAnalysisPayload(payload: ImageAnalysisPayload): ImageAnalysisPayload {
  return {
    ...payload,
    description: sanitizeTextField(payload.description),
    scene: sanitizeTextField(payload.scene),
    location: sanitizeTextField(payload.location),
    story: sanitizeTextField(payload.story),
    mood: sanitizeTextField(payload.mood),
    ocr_text: sanitizeOcrText(payload.ocr_text)
  }
}
