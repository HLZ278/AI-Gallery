import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { configService } from '../services/ConfigService'

interface PromptTemplate {
  version: string
  system: string
  user_template: string
}

function resolvePromptPath(filename: string): string {
  const candidates = [
    join(app.getAppPath(), 'prompts', filename),
    join(__dirname, '../../prompts', filename),
    join(process.cwd(), 'prompts', filename)
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  throw new Error(`Prompt file not found: ${filename}`)
}

export class PromptBuilder {
  loadImagePrompt(version?: string): PromptTemplate {
    const ver = version ?? configService.load().analysis.promptVersion
    const filename = ver === '1.0' ? 'image_analysis_v1.json' : `image_analysis_v${ver}.json`
    return JSON.parse(readFileSync(resolvePromptPath(filename), 'utf-8')) as PromptTemplate
  }

  loadVideoPrompt(version?: string): PromptTemplate {
    const ver = version ?? configService.load().analysis.videoPromptVersion
    const filename = ver === '1.0' ? 'video_analysis_v1.json' : `video_analysis_v${ver}.json`
    return JSON.parse(readFileSync(resolvePromptPath(filename), 'utf-8')) as PromptTemplate
  }

  loadGifPrompt(version?: string): PromptTemplate {
    const ver = version ?? configService.load().analysis.gifPromptVersion
    const filename = ver === '1.0' ? 'gif_analysis_v1.json' : `gif_analysis_v${ver}.json`
    return JSON.parse(readFileSync(resolvePromptPath(filename), 'utf-8')) as PromptTemplate
  }

  loadSearchPrompt(version?: string): PromptTemplate {
    const ver = version ?? configService.load().search.llmSearchPromptVersion
    const filename = ver === '1.0' ? 'llm_search_v1.json' : `llm_search_v${ver}.json`
    return JSON.parse(readFileSync(resolvePromptPath(filename), 'utf-8')) as PromptTemplate
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
