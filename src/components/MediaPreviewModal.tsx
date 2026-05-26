import { useCallback, useEffect, useRef, useState } from 'react'
import type { MediaItem } from '../../shared/types'
import { toFileUrl, fileNameFromPath } from '../utils/fileUrl'
import { MediaContextMenu, type MediaContextAction } from './MediaContextMenu'
import { VideoPlayerControls, type VideoPlayerHandle } from './preview/VideoPlayerControls'
import { PreviewTopBar, PreviewBottomBar, PreviewNavButton } from './preview/PreviewToolbar'
import { PreviewOverlay } from './preview/PreviewOverlay'
import { useFullscreen } from './preview/useFullscreen'
import { useImageZoom } from './preview/useImageZoom'

interface Props {
  items: MediaItem[]
  initialIndex?: number
  onClose: () => void
}

export function MediaPreviewModal({ items, initialIndex = 0, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<VideoPlayerHandle>(null)
  const [index, setIndex] = useState(() => Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0)))
  const [rotation, setRotation] = useState(0)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef)

  const item = items[index]
  const zoom = useImageZoom(item?.id ?? index)
  const canNavigate = items.length > 1
  const isVideo = item?.mediaType === 'video'
  const showRotation = !isVideo

  useEffect(() => {
    setRotation(0)
  }, [index, item?.id])

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : items.length - 1))
  }, [items.length])

  const goNext = useCallback(() => {
    setIndex((i) => (i < items.length - 1 ? i + 1 : 0))
  }, [items.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (contextMenu) return
      switch (e.key) {
        case 'Escape':
          if (isFullscreen) {
            void document.exitFullscreen()
          } else {
            onClose()
          }
          break
        case 'ArrowLeft':
          if (canNavigate) goPrev()
          break
        case 'ArrowRight':
          if (canNavigate) goNext()
          break
        case 'f':
        case 'F':
          void toggleFullscreen()
          break
        case '+':
        case '=':
          if (!isVideo) zoom.zoomIn()
          break
        case '-':
        case '_':
          if (!isVideo) zoom.zoomOut()
          break
        case '0':
          if (!isVideo) zoom.resetZoom()
          break
        case 'c':
        case 'C':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            if (item) {
              void window.api.media.copyItems([{ filePath: item.filePath, mediaType: item.mediaType }])
            }
          }
          break
        case ' ':
          e.preventDefault()
          if (isVideo) videoRef.current?.togglePlay()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, goPrev, goNext, canNavigate, toggleFullscreen, isFullscreen, contextMenu, isVideo, item, zoom])

  const handleContextAction = async (action: MediaContextAction) => {
    if (!item) return
    setContextMenu(null)
    switch (action) {
      case 'copy':
        await window.api.media.copy(item.filePath, item.mediaType)
        break
      case 'showInFolder':
        await window.api.media.showInFolder(item.filePath)
        break
      default:
        break
    }
  }

  if (!item) return null

  const fileUrl = toFileUrl(item.filePath)
  const fileName = fileNameFromPath(item.filePath)

  return (
    <PreviewOverlay
      containerRef={containerRef}
      className="bg-[#0a0a0a]/95 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isFullscreen) onClose()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center pt-14 pb-24 px-16 pointer-events-none">
        <div
          ref={zoom.viewportRef}
          className="flex items-center justify-center w-full h-full min-h-0 pointer-events-auto overflow-hidden"
          onDoubleClick={() => {
            if (!isVideo) void toggleFullscreen()
          }}
        >
          {isVideo ? (
            <div className="w-full max-h-full flex justify-center">
              <VideoPlayerControls ref={videoRef} src={fileUrl} autoPlay />
            </div>
          ) : (
            <img
              src={fileUrl}
              alt=""
              draggable={false}
              className={`max-w-full max-h-full object-contain rounded-xl shadow-2xl transition-transform duration-100 ${
                zoom.scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
              }`}
              style={{
                transform: `translate(${zoom.offset.x}px, ${zoom.offset.y}px) scale(${zoom.scale}) rotate(${rotation}deg)`
              }}
              onPointerDown={zoom.handlePointerDown}
              onPointerMove={zoom.handlePointerMove}
              onPointerUp={zoom.handlePointerUp}
              onPointerCancel={zoom.handlePointerCancel}
            />
          )}
        </div>
      </div>

      <div className="absolute inset-0 z-[100] pointer-events-none">
        <PreviewTopBar fileName={fileName} index={index} total={items.length} onClose={onClose} />

        {canNavigate && (
          <>
            <PreviewNavButton direction="left" onClick={goPrev} />
            <PreviewNavButton direction="right" onClick={goNext} />
          </>
        )}

        {!isVideo && (
          <PreviewBottomBar
            showRotation={showRotation}
            showNavigation={canNavigate}
            showZoom
            zoomPercent={zoom.zoomPercent}
            canZoomIn={zoom.canZoomIn}
            canZoomOut={zoom.canZoomOut}
            onZoomIn={zoom.zoomIn}
            onZoomOut={zoom.zoomOut}
            onZoomReset={zoom.resetZoom}
            isFullscreen={isFullscreen}
            onPrev={goPrev}
            onNext={goNext}
            onRotateLeft={() => setRotation((r) => r - 90)}
            onRotateRight={() => setRotation((r) => r + 90)}
            onToggleFullscreen={() => void toggleFullscreen()}
          />
        )}

        {isVideo && (
          <div className="absolute bottom-4 right-4 pointer-events-auto">
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 text-white/85 text-xs hover:bg-white/15"
            >
              {isFullscreen ? '退出全屏' : '全屏'}
            </button>
          </div>
        )}
      </div>

      {contextMenu && (
        <MediaContextMenu
          item={item}
          x={contextMenu.x}
          y={contextMenu.y}
          variant="preview"
          onAction={handleContextAction}
          onClose={() => setContextMenu(null)}
        />
      )}
    </PreviewOverlay>
  )
}
