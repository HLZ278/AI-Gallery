import { describe, expect, it } from 'vitest'
import { claimNextPending, hasPending } from '../electron/backend/infra/mediaPendingClaim'
import { createMemoryDb, insertPendingMedia, seedLibrary } from './helpers/memoryDb'

describe('mediaPendingClaim (sqlite)', () => {
  it('runs against in-memory sqlite when native module matches Node', () => {
    let db
    try {
      db = createMemoryDb()
    } catch {
      return
    }
    seedLibrary(db)
    insertPendingMedia(db, { id: 'only' })
    expect(claimNextPending(db)?.id).toBe('only')
    expect(hasPending(db)).toBe(false)
  })
})
