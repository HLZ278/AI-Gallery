import OpenAI from 'openai'
import { configService } from '../../services/ConfigService'
import type { IEmbeddingProvider } from './IEmbeddingProvider'

export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  getModelName(): string {
    return `cloud/${configService.load().embedding.model}`
  }

  async embed(text: string): Promise<number[]> {
    const config = configService.load()
    const client = new OpenAI({
      apiKey: config.llm.apiKey,
      baseURL: config.llm.baseUrl,
      timeout: config.llm.timeoutMs
    })

    const response = await client.embeddings.create({
      model: config.embedding.model,
      input: text.slice(0, 8000)
    })

    const vector = response.data[0]?.embedding
    if (!vector?.length) throw new Error('Empty embedding response')
    return vector
  }
}

export const openAIEmbeddingProvider = new OpenAIEmbeddingProvider()
