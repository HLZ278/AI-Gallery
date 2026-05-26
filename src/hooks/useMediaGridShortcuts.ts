import { useEffect } from 'react'
import type { MediaItem } from '../../shared/types'
import { isEditableTarget } from '../utils/keyboardGuard'

interface Options {
  enabled: boolean
  getSelectedItems: () => MediaItem[]
  primaryItem: MediaItem | null
  selectAll: () => void
  clearSelection: () => void
  moveFocus: (delta: number, extend?: boolean) => MediaItem | null
  onPreview: (item: MediaItem) => void
  onCloseDetail?: () => void
}

async function copyItemsToClipboard(items: MediaItem[]): Promise<void> {
  if (items.length === 0) return
  await window.api.media.copyItems(
    items.map((i) => ({ filePath: i.filePath, mediaType: i.mediaType }))
  )
}

export function useMediaGridShortcuts({
  enabled,
  getSelectedItems,
  primaryItem,
  selectAll,
  clearSelection,
  moveFocus,
  onPreview,
  onCloseDetail
}: Options) {
  useEffect(() => {
    if (!enabled) return

    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return

      const mod = e.ctrlKey || e.metaKey
      const selected = getSelectedItems()
      const targets = selected.length > 0 ? selected : primaryItem ? [primaryItem] : []

      if (mod && e.key.toLowerCase() === 'c') {
        if (targets.length === 0) return
        e.preventDefault()
        void copyItemsToClipboard(targets)
        return
      }

      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        selectAll()
        return
      }

      if (e.key === 'Escape') {
        if (selected.length > 0) {
          e.preventDefault()
          clearSelection()
          return
        }
        onCloseDetail?.()
        return
      }

      if (e.key === 'Enter' || (e.key === ' ' && !mod)) {
        if (!primaryItem) return
        e.preventDefault()
        onPreview(primaryItem)
        return
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        moveFocus(1, e.shiftKey)
        return
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        moveFocus(-1, e.shiftKey)
        return
      }

      if (mod && e.key.toLowerCase() === 'e') {
        if (!primaryItem) return
        e.preventDefault()
        void window.api.media.showInFolder(primaryItem.filePath)
        return
      }

      if (mod && e.key.toLowerCase() === 'o') {
        if (!primaryItem) return
        e.preventDefault()
        void window.api.media.openFile(primaryItem.filePath)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    enabled,
    getSelectedItems,
    primaryItem,
    selectAll,
    clearSelection,
    moveFocus,
    onPreview,
    onCloseDetail
  ])
}
