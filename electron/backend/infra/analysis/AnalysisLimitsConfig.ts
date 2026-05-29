import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { getAppInstallDir } from '../AppPaths'

export interface AnalysisLimitsConfig {
  ocrTextMaxChars: number
  textFieldMaxChars: number
  ocrRepeatMinUnitLen: number
  ocrRepeatMaxRuns: number
}

const DEFAULTS: AnalysisLimitsConfig = {
  ocrTextMaxChars: 400,
  textFieldMaxChars: 1500,
  ocrRepeatMinUnitLen: 6,
  ocrRepeatMaxRuns: 2
}

let cached: AnalysisLimitsConfig | null = null

function resolveConfigPath(): string {
  const paths = [
    join(getAppInstallDir(), 'config', 'analysis-limits.json'),
    join(__dirname, '../../../config/analysis-limits.json'),
    join(process.cwd(), 'config/analysis-limits.json')
  ]
  for (const p of paths) {
    if (existsSync(p)) return p
  }
  throw new Error('Config file not found: analysis-limits.json')
}

export function loadAnalysisLimitsConfig(): AnalysisLimitsConfig {
  if (cached) return cached
  try {
    cached = { ...DEFAULTS, ...JSON.parse(readFileSync(resolveConfigPath(), 'utf-8')) }
  } catch {
    cached = DEFAULTS
  }
  return cached
}

export function resetAnalysisLimitsConfigCache(): void {
  cached = null
}
