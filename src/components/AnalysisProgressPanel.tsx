import type { AnalysisProgress } from '../../shared/types'

interface Props {
  progress: AnalysisProgress
  compact?: boolean
}

export function AnalysisProgressPanel({ progress, compact = false }: Props) {
  const { percent, total, completed, pending, processing, done, failed, currentFiles, isRunning, isStopping, concurrency } =
    progress
  const hasPending = pending > 0 || processing > 0
  const active = isRunning || isStopping || (hasPending && completed < total)

  if (!active && total === 0) return null

  const handleStop = () => window.api.analysis.stop()
  const handleResume = () => window.api.analysis.start()

  return (
    <div className={`rounded-apple-sm bg-[var(--color-card)] border border-[var(--color-border)] ${compact ? 'p-3 text-xs' : 'p-4 text-sm'}`}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="font-medium">
          {isStopping ? '正在停止...' : isRunning ? 'AI 分析进行中' : hasPending ? '分析已暂停' : '分析已完成'}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[var(--color-accent)] font-semibold">{percent}%</span>
          {isRunning && !isStopping && (
            <button
              type="button"
              onClick={handleStop}
              className="px-2 py-0.5 rounded text-[10px] border border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              停止
            </button>
          )}
          {!isRunning && !isStopping && pending > 0 && (
            <button
              type="button"
              onClick={handleResume}
              className="px-2 py-0.5 rounded text-[10px] bg-[var(--color-accent)] text-white hover:brightness-110"
            >
              继续
            </button>
          )}
        </div>
      </div>

      <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mb-2">
        <div
          className="h-full bg-[var(--color-accent)] transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex justify-between text-[var(--color-muted)] mb-2">
        <span>{completed} / {total}</span>
        <span>已完成 {done} · 失败 {failed}</span>
      </div>

      {!compact && (
        <div className="flex gap-3 text-xs text-[var(--color-muted)] mb-2">
          <span>待处理 {pending}</span>
          <span>进行中 {processing}</span>
          {concurrency != null && <span>{concurrency} 路并发</span>}
        </div>
      )}

      {isStopping && currentFiles.length > 0 && (
        <p className="text-[10px] text-[var(--color-muted)] mb-1">等待当前 {currentFiles.length} 个任务完成后停止...</p>
      )}

      {currentFiles.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
          <p className="text-[10px] text-[var(--color-muted)] mb-1">
            正在分析{concurrency != null ? `（${currentFiles.length}/${concurrency} 路）` : ''}：
          </p>
          {currentFiles.map((f) => (
            <p key={f.mediaId} className="truncate text-xs font-medium" title={f.filePath}>
              {f.fileName}
            </p>
          ))}
        </div>
      )}

      {isRunning && pending > 0 && currentFiles.length === 0 && (
        <p className="text-xs text-[var(--color-muted)] mt-1">准备下一张...</p>
      )}
    </div>
  )
}
