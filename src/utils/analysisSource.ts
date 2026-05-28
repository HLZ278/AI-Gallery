export function analysisSourceLabel(modelName: string): string {
  if (modelName.startsWith('cloud/')) return '云端'
  if (modelName.startsWith('local/')) return '本地'
  return modelName ? '云端' : ''
}
