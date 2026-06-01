import { readFileSync } from 'fs'
import { resolveBundledConfigPath } from '../AppPaths'

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

export function loadAnalysisLimitsConfig(): AnalysisLimitsConfig {
  if (cached) return cached
  try {
    cached = { ...DEFAULTS, ...JSON.parse(readFileSync(resolveBundledConfigPath('analysis-limits.json'), 'utf-8')) }
  } catch {
    cached = DEFAULTS
  }
  return cached
}

export function resetAnalysisLimitsConfigCache(): void {
  cached = null
}
