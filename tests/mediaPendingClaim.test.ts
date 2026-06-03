import { describe, expect, it } from 'vitest'
import { claimNextPending, createFakeClaimDb, hasPending } from './helpers/fakeSqlite'

const baseRows = () => [
  {
    id: 'a',
    file_path: 'C:\\a.jpg',
    analysis_status: 'pending',
    library_id: 'lib-1',
    taken_at: 100
  },
  {
    id: 'b',
    file_path: 'C:\\b.jpg',
    analysis_status: 'pending',
    library_id: 'lib-1',
    taken_at: 200
  },
  {
    id: 'l2',
    file_path: 'C:\\l2.jpg',
    analysis_status: 'pending',
    library_id: 'lib-2',
    taken_at: 50
  }
]

describe('mediaPendingClaim', () => {
  it('claims oldest pending globally and marks processing', () => {
    const db = createFakeClaimDb([baseRows()[2], baseRows()[0], baseRows()[1]])
    expect(claimNextPending(db)?.id).toBe('l2')
    expect(claimNextPending(db)?.id).toBe('a')
    expect(claimNextPending(db)?.id).toBe('b')
    expect(claimNextPending(db)).toBeNull()
  })

  it('scopes claim to mediaIds only', () => {
    const db = createFakeClaimDb(baseRows())
    const claimed = claimNextPending(db, { mediaIds: ['b'] })
    expect(claimed?.id).toBe('b')
    expect(hasPending(db, { mediaIds: ['a'] })).toBe(true)
    expect(hasPending(db, { mediaIds: ['b'] })).toBe(false)
  })

  it('hasPending respects library filter', () => {
    const db = createFakeClaimDb(baseRows())
    expect(hasPending(db, { libraryId: 'lib-1' })).toBe(true)
    claimNextPending(db, { libraryId: 'lib-1' })
    claimNextPending(db, { libraryId: 'lib-1' })
    expect(hasPending(db, { libraryId: 'lib-1' })).toBe(false)
    expect(hasPending(db, { libraryId: 'lib-2' })).toBe(true)
  })

  it('does not double-claim the same row', () => {
    const db = createFakeClaimDb([baseRows()[0]])
    claimNextPending(db)
    expect(claimNextPending(db)).toBeNull()
    expect(hasPending(db)).toBe(false)
  })
})
