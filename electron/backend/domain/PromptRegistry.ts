import { existsSync, readdirSync } from 'fs'
import { join } from 'path'

export type PromptKind = 'image' | 'video' | 'gif' | 'search'

const PROMPT_PREFIX: Record<PromptKind, string> = {
  image: 'image_analysis_v',
  video: 'video_analysis_v',
  gif: 'gif_analysis_v',
  search: 'llm_search_v'
}

export interface PromptFileRef {
  filename: string
  version: string
}

function resolvePromptsDir(): string {
  const fromEnv = process.env.PICTURESEARCH_PROMPTS_DIR?.trim()
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  let appPath = process.cwd()
  try {
    if (app?.getAppPath) appPath = app.getAppPath()
  } catch {
    /* worker */
  }
  const candidates = [
    join(appPath, 'prompts'),
    join(__dirname, '../../prompts'),
    join(process.cwd(), 'prompts')
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  throw new Error('Prompts directory not found')
}

function parseVersionFromFilename(prefix: string, filename: string): string | null {
  if (!filename.startsWith(prefix) || !filename.endsWith('.json')) return null
  const raw = filename.slice(prefix.length, -'.json'.length)
  if (!raw) return null
  return raw === '1' ? '1.0' : raw
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((part) => Number(part) || 0)
  const pb = b.split('.').map((part) => Number(part) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

export class PromptRegistry {
  private latestByKind = new Map<PromptKind, PromptFileRef>()

  getPromptsDir(): string {
    return resolvePromptsDir()
  }

  resolvePromptPath(filename: string): string {
    return join(this.getPromptsDir(), filename)
  }

  getLatestPromptFile(kind: PromptKind): PromptFileRef {
    const cached = this.latestByKind.get(kind)
    if (cached) return cached

    const prefix = PROMPT_PREFIX[kind]
    const files = readdirSync(this.getPromptsDir())
    let best: PromptFileRef | null = null

    for (const filename of files) {
      const version = parseVersionFromFilename(prefix, filename)
      if (!version) continue
      if (!best || compareVersions(version, best.version) > 0) {
        best = { filename, version }
      }
    }

    if (!best) {
      throw new Error(`No prompt files found for kind: ${kind}`)
    }

    this.latestByKind.set(kind, best)
    return best
  }

  clearCache(): void {
    this.latestByKind.clear()
  }
}

export const promptRegistry = new PromptRegistry()
