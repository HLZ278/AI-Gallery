import { readFileSync } from 'fs'
import { promptRegistry, type PromptKind } from './PromptRegistry'

interface PromptTemplate {
  version: string
  system: string
  user_template: string
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
