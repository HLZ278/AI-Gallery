import { useCallback, useEffect, useRef, useState } from 'react'
import type { MediaItem } from '../../shared/types'

export interface SelectModifiers {
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

function rangeSelectIds(ids: string[], anchorId: string, targetId: string): Set<string> {
  const ai = ids.indexOf(anchorId)
  const bi = ids.indexOf(targetId)
  if (ai < 0 || bi < 0) return new Set([targetId])
  const [from, to] = ai < bi ? [ai, bi] : [bi, ai]
  return new Set(ids.slice(from, to + 1))
}

export function useMediaSelection(items: MediaItem[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [focusId, setFocusId] = useState<string | null>(null)
  const anchorIdRef = useRef<string | null>(null)

  useEffect(() => {
    const valid = new Set(items.map((i) => i.id))
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => valid.has(id)))
      return next.size === prev.size ? prev : next
    })
    if (focusId && !valid.has(focusId)) setFocusId(null)
  }, [items, focusId])

  const selectItem = useCallback(
    (item: MediaItem, mods: SelectModifiers = { shiftKey: false, ctrlKey: false, metaKey: false }) => {
      const multi = mods.ctrlKey || mods.metaKey
      const range = mods.shiftKey

      if (range && anchorIdRef.current) {
        const ids = items.map((i) => i.id)
        setSelectedIds(rangeSelectIds(ids, anchorIdRef.current, item.id))
      } else if (multi) {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          if (next.has(item.id)) next.delete(item.id)
          else next.add(item.id)
          return next
        })
        anchorIdRef.current = item.id
      } else {
        setSelectedIds(new Set([item.id]))
        anchorIdRef.current = item.id
      }
      setFocusId(item.id)
    },
    [items]
  )

  const selectAll = useCallback(() => {
    if (items.length === 0) return
    setSelectedIds(new Set(items.map((i) => i.id)))
    anchorIdRef.current = items[0].id
    setFocusId(items[items.length - 1].id)
  }, [items])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setFocusId(null)
    anchorIdRef.current = null
  }, [])

  const moveFocus = useCallback(
    (delta: number, extend = false): MediaItem | null => {
      if (items.length === 0) return null
      const ids = items.map((i) => i.id)
      let idx = focusId ? ids.indexOf(focusId) : 0
      if (idx < 0) idx = 0
      const nextIdx = Math.max(0, Math.min(ids.length - 1, idx + delta))
      const item = items[nextIdx]
      setFocusId(item.id)

      if (extend) {
        const anchor = anchorIdRef.current ?? ids[idx] ?? item.id
        if (!anchorIdRef.current) anchorIdRef.current = anchor
        setSelectedIds(rangeSelectIds(ids, anchor, item.id))
      } else {
        setSelectedIds(new Set([item.id]))
        anchorIdRef.current = item.id
      }
      return item
    },
    [items, focusId]
  )

  const getSelectedItems = useCallback(() => {
    const set = selectedIds
    return items.filter((i) => set.has(i.id))
  }, [items, selectedIds])

  const primaryItem =
    (focusId ? items.find((i) => i.id === focusId) : null) ?? getSelectedItems()[0] ?? null

  return {
    selectedIds,
    focusId,
    primaryItem,
    selectItem,
    selectAll,
    clearSelection,
    moveFocus,
    getSelectedItems
  }
}
