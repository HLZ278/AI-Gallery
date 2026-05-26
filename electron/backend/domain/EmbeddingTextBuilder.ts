import type { AnalysisResult } from '../../../shared/types'

export function buildEmbeddingDocument(
  analysis: Pick<
    AnalysisResult,
    | 'description'
    | 'objects'
    | 'people'
    | 'scene'
    | 'location'
    | 'story'
    | 'trendTags'
    | 'mood'
    | 'colors'
    | 'ocrText'
    | 'ipReferences'
  >,
  geoText?: string | null
): string {
  const parts: string[] = []

  if (analysis.description) parts.push(`描述：${analysis.description}`)
  if (analysis.scene) parts.push(`场景：${analysis.scene}`)
  if (analysis.story) parts.push(`故事：${analysis.story}`)
  if (analysis.location) parts.push(`位置：${analysis.location}`)
  if (geoText?.trim()) parts.push(`GPS：${geoText.trim()}`)
  if (analysis.people.length) parts.push(`人物：${analysis.people.join('、')}`)
  if (analysis.ipReferences?.length) parts.push(`IP/角色/作品：${analysis.ipReferences.join('、')}`)
  if (analysis.objects.length) parts.push(`物体：${analysis.objects.join('、')}`)
  if (analysis.trendTags.length) parts.push(`标签：${analysis.trendTags.join('、')}`)
  if (analysis.mood) parts.push(`氛围：${analysis.mood}`)
  if (analysis.colors.length) parts.push(`颜色：${analysis.colors.join('、')}`)
  if (analysis.ocrText) parts.push(`文字：${analysis.ocrText}`)

  return parts.join('\n')
}
