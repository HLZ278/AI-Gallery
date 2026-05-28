import { configService } from '../../services/ConfigService'
import type { IEmbeddingProvider } from './IEmbeddingProvider'
import { localEmbeddingProvider } from './LocalEmbeddingProvider'
import { openAIEmbeddingProvider } from './OpenAIEmbeddingProvider'

let cachedProvider: IEmbeddingProvider | null = null
let cachedKey = ''

export function createEmbeddingProvider(): IEmbeddingProvider {
  const config = configService.load()
  const key = `${config.embedding.provider}:${config.embedding.model}:${config.embedding.localModelId}`
  if (cachedProvider && cachedKey === key) return cachedProvider
  cachedKey = key
  cachedProvider = config.embedding.provider === 'local' ? localEmbeddingProvider : openAIEmbeddingProvider
  return cachedProvider
}

export function resetEmbeddingProviderCache(): void {
  cachedProvider = null
  cachedKey = ''
}
