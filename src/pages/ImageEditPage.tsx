import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MediaItem, MediaType } from '../../shared/types'
import { formatImageEditExtensions, getImageEditSupportedTypes } from '../../shared/imageEditPolicy'
import { MediaGridItem } from '../components/MediaGrid'
import { ImageEditResultCard, type ImageEditDecision } from '../components/imageEdit/ImageEditResultCard'
import { useAppStore } from '../store/appStore'
import { buildImageEditSession, useImageEditStore } from '../store/imageEditStore'
import { formatFileSize, mediaTypeLabel } from '../utils/formatMedia'
import { toast } from '../store/toastStore'

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function ImageEditPage() {
  const libraries = useAppStore((s) => s.libraries)
  const config = useAppStore((s) => s.config)
  const hydrated = useImageEditStore((s) => s.hydrated)
  const libraryId = useImageEditStore((s) => s.libraryId)
  const size = useImageEditStore((s) => s.size)
  const sourceMediaIds = useImageEditStore((s) => s.sourceMediaIds)
  const messages = useImageEditStore((s) => s.messages)
  const setLibraryId = useImageEditStore((s) => s.setLibraryId)
  const setSize = useImageEditStore((s) => s.setSize)
  const setSourceMediaIds = useImageEditStore((s) => s.setSourceMediaIds)
  const setMessages = useImageEditStore((s) => s.setMessages)
  const hydrateFromSession = useImageEditStore((s) => s.hydrateFromSession)
  const setHydrated = useImageEditStore((s) => s.setHydrated)
  const resetToWelcome = useImageEditStore((s) => s.resetToWelcome)

  const [libraryImages, setLibraryImages] = useState<MediaItem[]>([])
  const [imagePage, setImagePage] = useState(1)
  const [loadingMoreImages, setLoadingMoreImages] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<MediaType[]>([])
  const [input, setInput] = useState('')
  const [editing, setEditing] = useState(false)
  const [decisionBusyId, setDecisionBusyId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const imageEditConfig = config?.imageEdit
  const maxInputImages = imageEditConfig?.maxInputImages ?? 3
  const availableSizes = imageEditConfig?.availableSizes ?? []
  const supportedMediaTypes = useMemo(
    () => (config ? getImageEditSupportedTypes(config) : []),
    [config]
  )
  const formatHint = config ? formatImageEditExtensions(config) : 'JPG/PNG/WEBP'
  const maxInputBytesLabel = imageEditConfig ? formatFileSize(imageEditConfig.maxInputBytes) : '10MB'
  const IMAGE_PAGE_SIZE = 120

  const loadLibraryImages = useCallback(
    async (page: number, append: boolean) => {
      if (!libraryId) return
      const types = selectedTypes.length ? selectedTypes : undefined
      const batch = await window.api.imageEdit.listLibraryImages(libraryId, page, IMAGE_PAGE_SIZE, types)
      setLibraryImages((prev) => (append ? [...prev, ...batch.filter((item) => !prev.some((p) => p.id === item.id))] : batch))
      setImagePage(page)
    },
    [libraryId, selectedTypes]
  )

  useEffect(() => {
    if (hydrated) return
    void window.api.imageEdit.loadSession().then(hydrateFromSession).catch(() => setHydrated(true))
  }, [hydrated, hydrateFromSession, setHydrated])

  useEffect(() => {
    if (!hydrated || libraries.length === 0) return
    if (!libraryId || !libraries.some((l) => l.id === libraryId)) {
      setLibraryId(libraries[0].id)
    }
  }, [libraries, libraryId, hydrated, setLibraryId])

  useEffect(() => {
    if (!libraryId) {
      setLibraryImages([])
      return
    }
    void loadLibraryImages(1, false)
  }, [libraryId, selectedTypes, loadLibraryImages])

  useEffect(() => {
    if (supportedMediaTypes.length === 0) return
    setSourceMediaIds((prev) => {
      const allowed = new Set(
        libraryImages.filter((item) => supportedMediaTypes.includes(item.mediaType)).map((item) => item.id)
      )
      const next = prev.filter((id) => allowed.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [libraryImages, supportedMediaTypes, setSourceMediaIds])

  useEffect(() => {
    if (!hydrated) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void window.api.imageEdit.saveSession(
        buildImageEditSession({ libraryId, size, sourceMediaIds, messages })
      )
    }, 300)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [hydrated, libraryId, size, sourceMediaIds, messages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, editing])

  const toggleSource = useCallback(
    (item: MediaItem) => {
      setSourceMediaIds((prev) => {
        if (prev.includes(item.id)) return prev.filter((id) => id !== item.id)
        if (prev.length >= maxInputImages) {
          toast(`最多选择 ${maxInputImages} 张图片`, 'error')
          return prev
        }
        return [...prev, item.id]
      })
    },
    [maxInputImages, setSourceMediaIds]
  )

  const updateAssistant = useCallback(
    (id: string, patch: Partial<(typeof messages)[number]>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id && m.role === 'assistant' ? { ...m, ...patch } : m))
      )
    },
    [setMessages]
  )

  const toggleType = (type: MediaType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const handleSend = async () => {
    const prompt = input.trim()
    if (!prompt || editing) return
    if (sourceMediaIds.length === 0) {
      toast('请先选择至少一张源图片', 'error')
      return
    }

    const userMsg = { id: createId(), role: 'user' as const, content: prompt }
    const assistantId = createId()

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant' as const, content: '正在编辑图片，请稍候...' }
    ])
    setInput('')
    setEditing(true)

    try {
      const result = await window.api.imageEdit.edit({
        sourceMediaIds,
        prompt,
        size: size || undefined
      })
      updateAssistant(assistantId, {
        content: `已完成编辑，请对比预览并选择「入库」「覆盖原图」或「拒绝」。`,
        edit: result,
        decision: 'pending' as ImageEditDecision
      })
    } catch (err) {
      updateAssistant(assistantId, {
        content: '编辑失败',
        error: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setEditing(false)
    }
  }

  const handleSaveAsNew = async (messageId: string, editId: string) => {
    setDecisionBusyId(editId)
    try {
      const acceptResult = await window.api.imageEdit.saveAsNew(editId)
      updateAssistant(messageId, {
        content: `已作为新图片保存到图库「${acceptResult.libraryName}」。`,
        decision: 'saved',
        acceptResult
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setDecisionBusyId(null)
    }
  }

  const handleOverwrite = async (messageId: string, editId: string) => {
    if (!confirm('确定覆盖第一张源图？原文件将被替换并重新分析。')) return
    setDecisionBusyId(editId)
    try {
      const overwriteResult = await window.api.imageEdit.overwrite(editId)
      updateAssistant(messageId, {
        content: `已覆盖原图「${overwriteResult.replacedOriginalPath.split(/[/\\]/).pop()}」。`,
        decision: 'overwritten',
        overwriteResult
      })
      if (libraryId) {
        const types = selectedTypes.length ? selectedTypes : undefined
        void window.api.imageEdit.listLibraryImages(libraryId, 1, 120, types).then(setLibraryImages)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setDecisionBusyId(null)
    }
  }

  const handleReject = async (messageId: string, editId: string) => {
    setDecisionBusyId(editId)
    try {
      await window.api.imageEdit.reject(editId)
      updateAssistant(messageId, {
        content: '已拒绝本次编辑，临时文件已删除。',
        decision: 'rejected'
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setDecisionBusyId(null)
    }
  }

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center text-[var(--color-muted)] text-sm">
        加载历史记录...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 glass border-b border-[var(--color-border)] space-y-3">
        <div>
          <h1 className="text-lg font-semibold">AI 图片编辑</h1>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            {imageEditConfig?.model ?? 'qwen-image-2.0-pro'} · 支持 1~{maxInputImages} 张输入 · {formatHint} · 单张 ≤{maxInputBytesLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={libraryId}
            onChange={(e) => {
              setLibraryId(e.target.value)
              setSourceMediaIds([])
              setSelectedTypes([])
            }}
            disabled={libraries.length === 0}
            className="px-3 py-1.5 rounded-apple-sm bg-[var(--color-card)] border border-[var(--color-border)] text-xs min-w-[140px]"
          >
            {libraries.length === 0 ? (
              <option value="">暂无图库</option>
            ) : (
              libraries.map((lib) => (
                <option key={lib.id} value={lib.id}>{lib.name}</option>
              ))
            )}
          </select>
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="px-3 py-1.5 rounded-apple-sm bg-[var(--color-card)] border border-[var(--color-border)] text-xs"
          >
            <option value="">跟随原图比例（推荐）</option>
            {availableSizes.map((s) => (
              <option key={s} value={s}>{s.replace('*', ' × ')}</option>
            ))}
          </select>
          <span className="text-[10px] text-[var(--color-muted)]">
            已选 {sourceMediaIds.length}/{maxInputImages} 张
          </span>
          <button
            type="button"
            onClick={() => resetToWelcome()}
            className="px-2 py-1 rounded-apple-sm border border-[var(--color-border)] text-[10px]"
          >
            清空会话
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside className="w-56 shrink-0 border-r border-[var(--color-border)] overflow-y-auto p-3 space-y-2">
          <p className="text-xs font-medium text-[var(--color-muted)] px-1">选择源图</p>
          {supportedMediaTypes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-1">
              {supportedMediaTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                    selectedTypes.includes(type)
                      ? 'bg-[var(--color-accent)] text-white border-transparent'
                      : 'border-[var(--color-border)] hover:bg-black/5'
                  }`}
                >
                  {mediaTypeLabel(type)}
                </button>
              ))}
            </div>
          )}
          {libraryImages.length === 0 ? (
            <p className="text-xs text-[var(--color-muted)] px-1">该图库暂无可编辑图片</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {libraryImages.map((item) => (
                <MediaGridItem
                  key={item.id}
                  item={item}
                  selected={sourceMediaIds.includes(item.id)}
                  onClick={() => toggleSource(item)}
                />
              ))}
            </div>
          )}
          {libraryImages.length >= imagePage * IMAGE_PAGE_SIZE && (
            <button
              type="button"
              disabled={loadingMoreImages}
              onClick={() => {
                setLoadingMoreImages(true)
                void loadLibraryImages(imagePage + 1, true).finally(() => setLoadingMoreImages(false))
              }}
              className="w-full mt-2 px-2 py-1.5 rounded-apple-sm border border-[var(--color-border)] text-[10px] disabled:opacity-50"
            >
              {loadingMoreImages ? '加载中...' : '加载更多'}
            </button>
          )}
        </aside>

        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-4">
            {messages.map((msg) =>
              msg.role === 'user' ? (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[75%] px-4 py-2.5 rounded-apple bg-[var(--color-accent)] text-white text-sm shadow-sm">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex justify-start">
                  <div className="max-w-[90%]">
                    <div className="px-4 py-2.5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] text-sm shadow-sm">
                      {msg.content}
                      {msg.error && <p className="mt-2 text-xs text-red-500">{msg.error}</p>}
                    </div>
                    {msg.edit && (
                      <ImageEditResultCard
                        edit={msg.edit}
                        status={msg.decision ?? 'pending'}
                        acceptResult={msg.acceptResult}
                        overwriteResult={msg.overwriteResult}
                        busy={decisionBusyId === msg.edit.editId}
                        onSaveAsNew={() => handleSaveAsNew(msg.id, msg.edit!.editId)}
                        onOverwrite={() => handleOverwrite(msg.id, msg.edit!.editId)}
                        onReject={() => handleReject(msg.id, msg.edit!.editId)}
                      />
                    )}
                  </div>
                </div>
              )
            )}
          </div>

          <div className="p-4 glass border-t border-[var(--color-border)]">
            <div className="flex gap-2 items-end max-w-3xl">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
                rows={2}
                placeholder="输入编辑指令，例如：把背景换成海边日落，保持人物不变..."
                disabled={editing || sourceMediaIds.length === 0}
                className="flex-1 px-4 py-3 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 text-sm resize-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={editing || !input.trim() || sourceMediaIds.length === 0}
                className="px-5 py-3 rounded-apple-sm bg-[var(--color-accent)] text-white text-sm font-medium disabled:opacity-50 shrink-0"
              >
                {editing ? '编辑中' : '编辑'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
