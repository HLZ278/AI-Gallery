/** @deprecated 请使用 CloudImageAnalysisProvider；保留兼容导出 */
export {
  CloudImageAnalysisProvider as LLMClient,
  cloudImageAnalysisProvider as llmClient
} from './analysis/CloudImageAnalysisProvider'

export type { AnalyzeFileResult } from './analysis/IImageAnalysisProvider'

import { cloudImageAnalysisProvider } from './analysis/CloudImageAnalysisProvider'

export class ImageAnalyzer {
  constructor(private readonly provider = cloudImageAnalysisProvider) {}

  async analyzeFile(filePath: string) {
    return this.provider.analyzeFile(filePath)
  }
}

export const imageAnalyzer = new ImageAnalyzer()
