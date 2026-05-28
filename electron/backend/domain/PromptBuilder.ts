import { readFileSync } from 'fs'
import { promptRegistry, type PromptKind } from './PromptRegistry'

interface PromptTemplate {
  version: string
  system: string
  user_template: string
  /** 本地端侧 caption 提问，与云端 system/user 语义对齐（Qwen VL 等） */
  local_caption_instruction?: string
}

function loadLatestPrompt(kind: PromptKind): PromptTemplate {
  const { filename } = promptRegistry.getLatestPromptFile(kind)
  const raw = readFileSync(promptRegistry.resolvePromptPath(filename), 'utf-8')
  return JSON.parse(raw) as PromptTemplate
}

export class PromptBuilder {
  loadImagePrompt(): PromptTemplate {
    return loadLatestPrompt('image')
  }

  getImagePromptVersion(): string {
    return this.loadImagePrompt().version
  }

  /** 复用最新 image_analysis 的 system + local_caption_instruction，与云端分析标准一致 */
  buildLocalCaptionPrompt(): string {
    const prompt = this.loadImagePrompt()
    const system = prompt.system.trim()
    const instruction = prompt.local_caption_instruction?.trim()
    if (!instruction) {
      throw new Error(
        `提示词 ${prompt.version} 缺少 local_caption_instruction，请在 prompts/image_analysis_*.json 中补充`
      )
    }
    return `${system}\n\n${instruction}`
  }

  loadVideoPrompt(): PromptTemplate {
    return loadLatestPrompt('video')
  }

  loadGifPrompt(): PromptTemplate {
    return loadLatestPrompt('gif')
  }

  loadSearchPrompt(): PromptTemplate {
    return loadLatestPrompt('search')
  }

  buildSearchUserPrompt(
    template: PromptTemplate,
    params: { query: string; count: number; catalog: string }
  ): string {
    return template.user_template
      .replace('{{query}}', params.query)
      .replace('{{count}}', String(params.count))
      .replace('{{catalog}}', params.catalog)
  }
}

export const promptBuilder = new PromptBuilder()
