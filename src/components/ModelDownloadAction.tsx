import type { LocalModelStatusItem } from '../../shared/types'

interface ModelDownloadActionProps {
  modelId: string
  kind: 'caption' | 'embedding'
  label: string
  estimatedSizeMb?: number
  status?: LocalModelStatusItem | null
  liveProgress?: { modelId: string; progress: number } | null
  busy: boolean
  onDownload: (modelId: string, kind: 'caption' | 'embedding') => void
}

export function ModelDownloadAction({
  modelId,
  kind,
  label,
  estimatedSizeMb,
  status,
  liveProgress,
  busy,
  onDownload
}: ModelDownloadActionProps) {
  const ready = status?.ready ?? false
  const isLiveTarget = liveProgress?.modelId === modelId
  const progress = isLiveTarget ? liveProgress.progress : (status?.progress ?? 0)
  const isActiveTarget = isLiveTarget || (status?.downloading ?? false)
  const downloading = isActiveTarget && (busy || status?.downloading || progress < 100)

  if (ready) {
    return <p className="mt-2 text-xs text-green-600">已就绪，可直接使用</p>
  }

  const sizeHint = estimatedSizeMb ? `（约 ${formatSizeMb(estimatedSizeMb)}）` : ''

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={downloading}
          onClick={() => onDownload(modelId, kind)}
          className="px-4 py-2 rounded-apple-sm bg-[var(--color-accent)] text-white text-sm disabled:opacity-50"
        >
          {downloading ? '下载中…' : `下载模型${sizeHint}`}
        </button>
        {!downloading && (
          <span className="text-xs text-orange-500">尚未下载，请先下载后再使用</span>
        )}
      </div>
      {downloading && (
        <div className="p-3 rounded-apple-sm bg-black/5 border border-[var(--color-border)]">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="truncate pr-2">正在下载 {label}</span>
            <span className="shrink-0 font-medium">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-black/10 overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function formatSizeMb(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`
}
