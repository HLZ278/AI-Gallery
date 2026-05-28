import type { ImageAnalysisPayload } from '../../../../shared/types'

export interface AnalyzeFileResult {
  payload: ImageAnalysisPayload
  promptVersion: string
}

export interface IImageAnalysisProvider {
  analyzeFile(filePath: string, mediaId?: string): Promise<AnalyzeFileResult>
}
