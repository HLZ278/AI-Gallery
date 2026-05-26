import { useEffect, useRef, useState } from 'react'
import type { MediaItem } from '../../shared/types'
import { toFileUrl } from '../utils/fileUrl'

interface Props {
  item: MediaItem
  className?: string
  animate?: boolean
}

export function MediaThumbnail({ item, className = 'w-full h-full object-cover', animate = true }: Props) {
  const fileUrl = toFileUrl(item.filePath)
  const thumbUrl = item.thumbPath ? toFileUrl(item.thumbPath) : null
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hovering, setHovering] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || item.mediaType !== 'video') return
    if (hovering) {
      video.play().catch(() => {})
    } else {
      video.pause()
      video.currentTime = 0
    }
  }, [hovering, item.mediaType])

  if (item.mediaType === 'gif' && animate) {
    return <img src={fileUrl} alt="" className={`${className} block`} loading="lazy" />
  }

  if (item.mediaType === 'video') {
    return (
      <video
        ref={videoRef}
        src={fileUrl}
        className={`${className} block`}
        muted
        loop
        playsInline
        preload="metadata"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      />
    )
  }

  if (thumbUrl) {
    return <img src={thumbUrl} alt="" className={`${className} block`} loading="lazy" />
  }

  return <img src={fileUrl} alt="" className={`${className} block`} loading="lazy" />
}
