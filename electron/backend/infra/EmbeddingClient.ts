import OpenAI from 'openai'
import { configService } from '../services/ConfigService'

export interface IEmbeddingProvider {
  embed(text: string): Promise<number[]>
}

export class OpenAIEmbeddingClient implements IEmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    const config = configService.load()
    const model = config.embedding.model
    const client = new OpenAI({
      apiKey: config.llm.apiKey,
      baseURL: config.llm.baseUrl,
      timeout: config.llm.timeoutMs
    })

    const response = await client.embeddings.create({
      model,
      input: text.slice(0, 8000)
    })

    const vector = response.data[0]?.embedding
    if (!vector?.length) throw new Error('Empty embedding response')
    return vector
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

export const embeddingClient = new OpenAIEmbeddingClient()
