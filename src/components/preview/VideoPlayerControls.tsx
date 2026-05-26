import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { IconPause, IconPlay } from './icons'

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

export interface VideoPlayerHandle {
  togglePlay: () => void
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface Props {
  src: string
  autoPlay?: boolean
  onTogglePlay?: (playing: boolean) => void
}

export const VideoPlayerControls = forwardRef<VideoPlayerHandle, Props>(function VideoPlayerControls(
  { src, autoPlay = true, onTogglePlay },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(autoPlay)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = speed
  }, [speed, src])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !autoPlay) return
    void video.play().catch(() => setPlaying(false))
  }, [src, autoPlay])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      void video.play()
      setPlaying(true)
      onTogglePlay?.(true)
    } else {
      video.pause()
      setPlaying(false)
      onTogglePlay?.(false)
    }
  }, [onTogglePlay])

  useImperativeHandle(ref, () => ({ togglePlay }), [togglePlay])

  const seekToRatio = useCallback((ratio: number) => {
    const video = videoRef.current
    if (!video || !Number.isFinite(video.duration)) return
    const next = Math.max(0, Math.min(1, ratio)) * video.duration
    video.currentTime = next
    setCurrentTime(next)
  }, [])

  const onTrackPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      seekToRatio((clientX - rect.left) / rect.width)
    },
    [seekToRatio]
  )

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => onTrackPointer(e.clientX)
    const onUp = () => setDragging(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragging, onTrackPointer])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="flex flex-col w-full max-w-[min(92vw,960px)]">
      <video
        ref={videoRef}
        src={src}
        className="max-w-full max-h-[calc(100vh-180px)] rounded-xl object-contain bg-black mx-auto"
        playsInline
        onClick={togglePlay}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <div className="mt-3 px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-2xl">
        <div
          ref={trackRef}
          className="relative h-1.5 rounded-full bg-white/20 cursor-pointer group mb-3"
          onPointerDown={(e) => {
            setDragging(true)
            onTrackPointer(e.clientX)
          }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[#0A84FF] transition-[width] duration-75"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 7px)` }}
          />
        </div>
        <div className="flex items-center gap-3 text-white/90">
          <button
            type="button"
            onClick={togglePlay}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            aria-label={playing ? '暂停' : '播放'}
          >
            {playing ? <IconPause /> : <IconPlay />}
          </button>
          <span className="text-xs tabular-nums min-w-[80px]">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <div className="flex-1" />
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="text-xs bg-white/10 border border-white/15 rounded-lg px-2 py-1 outline-none cursor-pointer hover:bg-white/15"
          >
            {SPEED_OPTIONS.map((s) => (
              <option key={s} value={s} className="text-black">
                {s === 1 ? '正常' : `${s}x`}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
})
