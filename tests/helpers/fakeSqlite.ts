import type Database from 'better-sqlite3'
import { claimNextPending, hasPending } from '../../electron/backend/infra/mediaPendingClaim'

type Row = { id: string; file_path: string; analysis_status: string; library_id: string; taken_at: number }

/** In-memory stand-in when better-sqlite3 native ABI mismatches system Node (Electron build). */
export function createFakeClaimDb(initial: Row[]): Database.Database {
  const rows = [...initial]

  const selectPending = (opts?: { libraryId?: string; mediaIds?: string[] }): Row | undefined => {
    const pending = rows
      .filter((r) => r.analysis_status === 'pending')
      .filter((r) => {
        if (opts?.mediaIds?.length) return opts.mediaIds.includes(r.id)
        if (opts?.libraryId) return r.library_id === opts.libraryId
        return true
      })
      .sort((a, b) => a.taken_at - b.taken_at)
    return pending[0]
  }

  const db = {
    transaction<T>(fn: () => T): () => T {
      return () => fn()
    },
    prepare(sql: string) {
      return {
        get(...args: unknown[]) {
          if (sql.includes('analysis_status = \'pending\' AND id IN')) {
            const mediaIds = args as string[]
            return selectPending({ mediaIds })
          }
          if (sql.includes('library_id = ?')) {
            return selectPending({ libraryId: args[0] as string })
          }
          if (sql.startsWith('SELECT id, file_path FROM media_items WHERE analysis_status = \'pending\'')) {
            return selectPending()
          }
          if (sql.includes('SELECT 1 FROM media_items WHERE analysis_status = \'pending\' AND id IN')) {
            return selectPending({ mediaIds: args as string[] }) ? { 1: 1 } : undefined
          }
          if (sql.includes('library_id = ? LIMIT 1')) {
            return selectPending({ libraryId: args[0] as string }) ? { 1: 1 } : undefined
          }
          if (sql.includes("analysis_status = 'pending' LIMIT 1")) {
            return selectPending() ? { 1: 1 } : undefined
          }
          return undefined
        },
        run(id: string) {
          const row = rows.find((r) => r.id === id && r.analysis_status === 'pending')
          if (row) row.analysis_status = 'processing'
          return { changes: row ? 1 : 0 }
        }
      }
    }
  }

  return db as unknown as Database.Database
}

export { claimNextPending, hasPending }
