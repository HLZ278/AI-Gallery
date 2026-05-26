const TYPE_LABELS: Record<string, string> = {
  photo: '照片',
  video: '视频',
  gif: '动图',
  live_photo: '实况',
  panorama: '全景',
  burst: '连拍'
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待分析',
  processing: '分析中',
  done: '已完成',
  failed: '分析失败'
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }
  return `${size >= 100 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`
}

export function formatResolution(width: number, height: number): string {
  if (!width || !height) return '—'
  return `${width} × ${height}`
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return '—'
  const totalSec = Math.round(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatDateTime(ts: number | null | undefined): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('zh-CN')
}

export function mediaTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type
}

export function analysisStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

export function formatGeoDisplay(geoText: string | null | undefined): string {
  if (!geoText?.trim()) return '—'
  const match = geoText.match(/^GPS ([\d.-]+) ([\d.-]+)/)
  return match ? `${match[1]}, ${match[2]}` : geoText
}
