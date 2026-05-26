import { useEffect, useRef, useState } from 'react'
import type { MediaItem } from '../../shared/types'
import { toFileUrl, fileNameFromPath } from '../utils/fileUrl'
import { IconPlay } from './preview/icons'

interface Props {
  item: MediaItem
}

export function MultiPreviewCell({ item }: Props) {
  const fileUrl = toFileUrl(item.filePath)
  const posterUrl = item.thumbPath ? toFileUrl(item.thumbPath) : undefined
  const isVideo = item.mediaType === 'video'
  const isGif = item.mediaType === 'gif'
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hovering, setHovering] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !isVideo) return
    if (hovering) {
      void video.play().catch(() => {})
    } else {
      video.pause()
      video.currentTime = 0
    }
  }, [hovering, isVideo])

  const imageSrc = posterUrl ?? fileUrl

  return (
    <div
      className="multi-preview-cell relative overflow-hidden rounded-xl bg-black/40 border border-white/10"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {isVideo ? (
        <>
          <video
            ref={videoRef}
            src={fileUrl}
            poster={posterUrl}
            className="absolute inset-0 w-full h-full object-contain"
            muted
            loop
            playsInline
            preload="metadata"
          />
          {!hovering && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/90">
                <IconPlay className="w-5 h-5 ml-0.5" />
              </div>
            </div>
          )}
        </>
      ) : (
        <img
          src={isGif ? fileUrl : imageSrc}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain"
        />
      )}
      <span className="absolute bottom-0 inset-x-0 px-2 py-1 text-[10px] text-white/70 bg-gradient-to-t from-black/70 truncate">
        {isVideo && <span className="mr-1 opacity-80">▶</span>}
        {fileNameFromPath(item.filePath)}
      </span>
    </div>
  )
}
