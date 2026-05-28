export interface IEmbeddingProvider {
  embed(text: string): Promise<number[]>
  getModelName(): string
}
