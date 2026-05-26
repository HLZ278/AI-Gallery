import { useEffect, useState, type ReactNode } from 'react'
import type { AnalysisResult, MediaItem } from '../../shared/types'
import {
  analysisStatusLabel,
  formatDateTime,
  formatDuration,
  formatFileSize,
  formatResolution,
  formatGeoDisplay,
  mediaTypeLabel
} from '../utils/formatMedia'
import { fileNameFromPath } from '../utils/fileUrl'

interface Props {
  item: MediaItem
  analysis: AnalysisResult | null
  onClose: () => void
  onRetry?: () => void | Promise<void>
}

type Tab = 'info' | 'analysis'

export function DetailPanel({ item, analysis, onClose, onRetry }: Props) {
  const [tab, setTab] = useState<Tab>('info')
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    setIsRetrying(false)
  }, [item.id])

  useEffect(() => {
    if (isRetrying && (item.analysisStatus === 'done' || item.analysisStatus === 'failed')) {
      setIsRetrying(false)
    }
  }, [item.analysisStatus, isRetrying])

  const isAnalyzing = isRetrying || item.analysisStatus === 'processing'

  const handleRetry = async () => {
    if (!onRetry || isAnalyzing) return
    setIsRetrying(true)
    try {
      await onRetry()
    } catch {
      setIsRetrying(false)
    }
  }

  const retryButton = onRetry ? (
    <RetryAnalysisButton
      onClick={handleRetry}
      disabled={isAnalyzing}
      label={isAnalyzing ? '分析中' : '重新分析'}
    />
  ) : null

  return (
    <aside className="w-80 glass border-l border-[var(--color-border)] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
        <h3 className="font-semibold text-sm truncate pr-2">{fileNameFromPath(item.filePath)}</h3>
        <button type="button" onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-text)] shrink-0">
          ✕
        </button>
      </div>

      <div className="flex border-b border-[var(--color-border)]">
        <TabButton active={tab === 'info'} onClick={() => setTab('info')}>
          属性
        </TabButton>
        <TabButton active={tab === 'analysis'} onClick={() => setTab('analysis')}>
          AI 分析
        </TabButton>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
        {tab === 'info' ? (
          <>
            <InfoRow label="类型" value={mediaTypeLabel(item.mediaType)} />
            <InfoRow label="大小" value={formatFileSize(item.fileSize)} />
            <InfoRow label="分辨率" value={formatResolution(item.width, item.height)} />
            {(item.mediaType === 'video' || item.mediaType === 'gif') && (
              <InfoRow label="时长" value={formatDuration(item.durationMs)} />
            )}
            {item.mediaType === 'gif' && item.frameCount != null && item.frameCount > 0 && (
              <InfoRow label="帧数" value={String(item.frameCount)} />
            )}
            <InfoRow label="拍摄时间" value={formatDateTime(item.takenAt)} />
            <InfoRow label="导入时间" value={formatDateTime(item.importedAt)} />
            <InfoRow label="分析状态" value={analysisStatusLabel(item.analysisStatus)} />
            {item.geoText && <InfoRow label="GPS 坐标" value={formatGeoDisplay(item.geoText)} />}
            {item.libraryName && <InfoRow label="图库" value={item.libraryName} />}
            <section className="pt-2">
              <h4 className="text-xs font-medium text-[var(--color-muted)] mb-1">文件路径</h4>
              <p className="break-all text-xs opacity-80">{item.filePath}</p>
            </section>
          </>
        ) : analysis ? (
          <>
            <Section title="描述" content={analysis.description} />
            <TagSection title="物体" tags={analysis.objects} />
            <TagSection title="人物" tags={analysis.people} />
            <Section title="场景" content={analysis.scene} />
            <Section title="位置" content={analysis.location} />
            <Section title="故事" content={analysis.story} />
            <TagSection title="潮流标签" tags={analysis.trendTags} />
            <Section title="氛围" content={analysis.mood} />
            {analysis.ocrText && <Section title="图中文字" content={analysis.ocrText} />}
            {retryButton}
          </>
        ) : (
          <div className="text-center py-8 text-[var(--color-muted)]">
            <p>尚未完成 AI 分析</p>
            {retryButton && <div className="mt-3">{retryButton}</div>}
          </div>
        )}
      </div>
    </aside>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
        active
          ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
          : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
      }`}
    >
      {children}
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-[var(--color-muted)] shrink-0">{label}</span>
      <span className="text-right break-all">{value}</span>
    </div>
  )
}

function Section({ title, content }: { title: string; content: string }) {
  if (!content) return null
  return (
    <section>
      <h4 className="text-xs font-medium text-[var(--color-muted)] mb-1">{title}</h4>
      <p>{content}</p>
    </section>
  )
}

function RetryAnalysisButton({
  onClick,
  disabled,
  label,
  className = 'pt-2'
}: {
  onClick: () => void
  disabled: boolean
  label: string
  className?: string
}) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="w-full px-4 py-2 rounded-apple-sm bg-[var(--color-accent)] text-white text-xs disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {label}
      </button>
    </div>
  )
}

function TagSection({ title, tags }: { title: string; tags: string[] }) {
  if (!tags.length) return null
  return (
    <section>
      <h4 className="text-xs font-medium text-[var(--color-muted)] mb-1">{title}</h4>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span key={tag} className="px-2 py-1 text-xs rounded-apple-sm bg-black/5 dark:bg-white/10">
            {tag}
          </span>
        ))}
      </div>
    </section>
  )
}
