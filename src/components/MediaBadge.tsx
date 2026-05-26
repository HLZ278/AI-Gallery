import type { MediaType } from '../../shared/types'
import { analysisStatusLabel } from '../utils/formatMedia'

const labels: Record<MediaType, string> = {
  photo: '照片',
  video: '视频',
  gif: '动图',
  live_photo: '实况',
  panorama: '全景',
  burst: '连拍'
}

export function MediaTypeBadge({ type }: { type: MediaType }) {
  return (
    <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-black/50 text-white backdrop-blur-sm">
      {labels[type]}
    </span>
  )
}

export function StatusDot({ status }: { status: string }) {
  const color =
    status === 'done' ? 'bg-green-500' : status === 'failed' ? 'bg-red-500' : status === 'processing' ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} title={analysisStatusLabel(status)} />
}
