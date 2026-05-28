import { configService } from '../../services/ConfigService'
import { localModelService } from '../../services/LocalModelService'
import type { IEmbeddingProvider } from './IEmbeddingProvider'

export class LocalEmbeddingProvider implements IEmbeddingProvider {
  getModelName(): string {
    return `local/${configService.load().embedding.localModelId}`
  }

  async embed(text: string): Promise<number[]> {
    const ready = await localModelService.isEmbeddingModelReady()
    if (!ready) {
      throw new Error('本地向量模型未下载，请在设置中下载本地模型')
    }
    const modelId = configService.load().embedding.localModelId
    return localModelService.embedText(text.slice(0, 8000), modelId)
  }
}

export const localEmbeddingProvider = new LocalEmbeddingProvider()
