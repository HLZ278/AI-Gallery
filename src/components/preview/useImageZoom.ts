import { useCallback, useEffect, useRef, useState } from 'react'
import {
  PREVIEW_ZOOM_MIN,
  PREVIEW_ZOOM_MAX,
  PREVIEW_ZOOM_STEP,
  PREVIEW_ZOOM_WHEEL_FACTOR,
  clampPreviewZoom
} from './previewZoom'

interface Offset {
  x: number
  y: number
}

export function useImageZoom(resetKey: string | number) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(PREVIEW_ZOOM_MIN)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const scaleRef = useRef(scale)
  scaleRef.current = scale
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; originX: number; originY: number } | null>(
    null
  )

  const resetZoom = useCallback(() => {
    setScale(PREVIEW_ZOOM_MIN)
    setOffset({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    resetZoom()
  }, [resetKey, resetZoom])

  const applyZoom = useCallback((getNextScale: (current: number) => number, anchor?: { x: number; y: number }) => {
    setScale((currentScale) => {
      const clamped = clampPreviewZoom(getNextScale(currentScale))
      if (clamped <= PREVIEW_ZOOM_MIN) {
        setOffset({ x: 0, y: 0 })
        return PREVIEW_ZOOM_MIN
      }

      if (anchor && currentScale > 0) {
        const ratio = clamped / currentScale
        setOffset((prev) => ({
          x: anchor.x - (anchor.x - prev.x) * ratio,
          y: anchor.y - (anchor.y - prev.y) * ratio
        }))
      }

      return clamped
    })
  }, [])

  const zoomIn = useCallback(() => {
    applyZoom((current) => current + PREVIEW_ZOOM_STEP)
  }, [applyZoom])

  const zoomOut = useCallback(() => {
    applyZoom((current) => current - PREVIEW_ZOOM_STEP)
  }, [applyZoom])

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault()
      const viewport = viewportRef.current
      if (!viewport) return

      const rect = viewport.getBoundingClientRect()
      const anchor = {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2
      }
      const current = scaleRef.current
      const delta = -event.deltaY * PREVIEW_ZOOM_WHEEL_FACTOR
      applyZoom(() => current * (1 + delta), anchor)
    },
    [applyZoom]
  )

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLImageElement>) => {
      if (scaleRef.current <= PREVIEW_ZOOM_MIN) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      dragRef.current = {
        active: true,
        startX: event.clientX,
        startY: event.clientY,
        originX: offset.x,
        originY: offset.y
      }
    },
    [offset.x, offset.y]
  )

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLImageElement>) => {
    const drag = dragRef.current
    if (!drag?.active) return
    setOffset({
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY)
    })
  }, [])

  const endDrag = useCallback((event: React.PointerEvent<HTMLImageElement>) => {
    if (!dragRef.current?.active) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const canZoomOut = scale > PREVIEW_ZOOM_MIN
  const canZoomIn = scale < PREVIEW_ZOOM_MAX
  const zoomPercent = Math.round(scale * 100)

  return {
    viewportRef,
    scale,
    offset,
    zoomPercent,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    resetZoom,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: endDrag,
    handlePointerCancel: endDrag
  }
}
