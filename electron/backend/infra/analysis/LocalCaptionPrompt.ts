import { promptBuilder } from '../../domain/PromptBuilder'
import type { LocalModelEntry } from '../../../../shared/types'

/** 本地 caption 提问：优先 registry captionPrompt，否则对齐 prompts/image_analysis 的 local_caption_instruction */
export function resolveLocalCaptionPrompt(entry: LocalModelEntry): string {
  const custom = entry.captionPrompt?.trim()
  if (custom) return custom
  if (entry.useAnalysisPrompt) {
    return promptBuilder.buildLocalCaptionPrompt()
  }
  return ''
}
