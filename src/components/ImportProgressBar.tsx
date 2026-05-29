import type { ImportProgress } from '../../shared/types'

interface ImportProgressBarProps {
  progress: ImportProgress
}

export function ImportProgressBar({ progress }: ImportProgressBarProps) {
  const percent = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0

  return (
    <div className="p-5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)]">
      <div className="flex justify-between text-sm mb-2">
        <span>{progress.message}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 rounded-full bg-black/10 overflow-hidden">
        <div
          className="h-full bg-[var(--color-accent)] transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      {progress.currentFile && (
        <p className="text-xs text-[var(--color-muted)] mt-2 truncate">{progress.currentFile}</p>
      )}
    </div>
  )
}
