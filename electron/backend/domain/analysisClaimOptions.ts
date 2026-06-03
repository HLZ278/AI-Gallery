/** Pure claim-scope resolution for library-wide vs scoped analysis queues. */
export function buildAnalysisClaimOptions(
  scopeMediaIds: Set<string> | null | undefined,
  libraryFilter: string | null | undefined
): { libraryId?: string; mediaIds?: string[] } {
  if (scopeMediaIds?.size) {
    return { mediaIds: [...scopeMediaIds] }
  }
  if (libraryFilter) {
    return { libraryId: libraryFilter }
  }
  return {}
}
