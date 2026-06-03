import { describe, expect, it } from 'vitest'
import { buildAnalysisClaimOptions } from '../electron/backend/domain/analysisClaimOptions'

describe('buildAnalysisClaimOptions', () => {
  it('prefers scoped media ids over library filter', () => {
    expect(
      buildAnalysisClaimOptions(new Set(['m1', 'm2']), 'lib-a')
    ).toEqual({ mediaIds: ['m1', 'm2'] })
  })

  it('uses library filter when scope is empty', () => {
    expect(buildAnalysisClaimOptions(null, 'lib-a')).toEqual({ libraryId: 'lib-a' })
    expect(buildAnalysisClaimOptions(new Set(), 'lib-a')).toEqual({ libraryId: 'lib-a' })
  })

  it('returns empty options for full-library queue', () => {
    expect(buildAnalysisClaimOptions(null, null)).toEqual({})
  })
})
