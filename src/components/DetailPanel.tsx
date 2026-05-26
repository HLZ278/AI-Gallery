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
  vectorScore?: number
  onClose: () => void
  onRetry?: () => void | Promise<void>
  onSearchTag?: (tag: string) => void
  onSendToEdit?: () => void
}

type Tab = 'info' | 'analysis'

export function DetailPanel({
  item,
  analysis,
  vectorScore,
  onClose,
  onRetry,
  onSearchTag,
  onSendToEdit
}: Props) {
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
            {vectorScore != null && (
              <InfoRow label="相似度" value={`${(vectorScore * 100).toFixed(1)}%`} />
            )}
            {item.geoText && <InfoRow label="GPS 坐标" value={formatGeoDisplay(item.geoText)} />}
            {item.libraryName && <InfoRow label="图库" value={item.libraryName} />}
            {item.analysisStatus === 'failed' && item.analysisError && (
              <section>
                <h4 className="text-xs font-medium text-red-500 mb-1">失败原因</h4>
                <p className="text-xs text-red-500/90 break-all">{item.analysisError}</p>
              </section>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <ActionButton onClick={() => void window.api.media.showInFolder(item.filePath)}>打开位置</ActionButton>
              <ActionButton onClick={() => void window.api.media.copyPath(item.filePath)}>复制路径</ActionButton>
              {onSendToEdit && <ActionButton onClick={onSendToEdit}>AI 编辑</ActionButton>}
            </div>
            <section className="pt-2">
              <h4 className="text-xs font-medium text-[var(--color-muted)] mb-1">文件路径</h4>
              <p className="break-all text-xs opacity-80">{item.filePath}</p>
            </section>
          </>
        ) : analysis ? (
          <>
            {analysis.analyzedAt > 0 && (
              <div className="text-[10px] text-[var(--color-muted)] space-y-0.5 pb-1 border-b border-[var(--color-border)]">
                <p>分析时间：{formatDateTime(analysis.analyzedAt)}</p>
                {analysis.modelName && <p>模型：{analysis.modelName}</p>}
                {analysis.promptVersion && <p>提示词版本：{analysis.promptVersion}</p>}
              </div>
            )}
            <Section title="描述" content={analysis.description} />
            <TagSection title="物体" tags={analysis.objects} onTagClick={onSearchTag} />
            <TagSection title="人物" tags={analysis.people} onTagClick={onSearchTag} />
            <TagSection title="IP / 角色 / 作品" tags={analysis.ipReferences} onTagClick={onSearchTag} />
            <Section title="场景" content={analysis.scene} />
            <Section title="位置" content={analysis.location} />
            <Section title="故事" content={analysis.story} />
            <TagSection title="潮流标签" tags={analysis.trendTags} onTagClick={onSearchTag} />
            {analysis.isMeme && <Section title="梗图" content="是" />}
            <Section title="氛围" content={analysis.mood} />
            <TagSection title="主色调" tags={analysis.colors} onTagClick={onSearchTag} />
            {analysis.ocrText && <Section title="图中文字" content={analysis.ocrText} />}
            {retryButton}
          </>
        ) : (
          <div className="text-center py-8 text-[var(--color-muted)]">
            <p>{item.analysisStatus === 'failed' ? '分析失败' : '尚未完成 AI 分析'}</p>
            {item.analysisStatus === 'failed' && item.analysisError && (
              <p className="text-xs text-red-500 mt-2 break-all px-2">{item.analysisError}</p>
            )}
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

function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1 rounded-apple-sm text-[10px] border border-[var(--color-border)] hover:bg-black/5 dark:hover:bg-white/10"
    >
      {children}
    </button>
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

function TagSection({
  title,
  tags,
  onTagClick
}: {
  title: string
  tags: string[]
  onTagClick?: (tag: string) => void
}) {
  if (!tags.length) return null
  return (
    <section>
      <h4 className="text-xs font-medium text-[var(--color-muted)] mb-1">{title}</h4>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) =>
          onTagClick ? (
            <button
              key={tag}
              type="button"
              onClick={() => onTagClick(tag)}
              className="px-2 py-1 text-xs rounded-apple-sm bg-black/5 dark:bg-white/10 hover:bg-[var(--color-accent)] hover:text-white transition-colors"
            >
              {tag}
            </button>
          ) : (
            <span key={tag} className="px-2 py-1 text-xs rounded-apple-sm bg-black/5 dark:bg-white/10">
              {tag}
            </span>
          )
        )}
      </div>
    </section>
  )
}
