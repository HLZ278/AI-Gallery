import { useCallback, useEffect, useRef, useState } from 'react'
import { ImageGenResultCard, type GenerationDecision } from '../components/imageGen/ImageGenResultCard'
import { useAppStore } from '../store/appStore'
import { buildImageGenSession, useImageGenStore } from '../store/imageGenStore'

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function ImageGenPage() {
  const libraries = useAppStore((s) => s.libraries)
  const config = useAppStore((s) => s.config)
  const hydrated = useImageGenStore((s) => s.hydrated)
  const libraryId = useImageGenStore((s) => s.libraryId)
  const size = useImageGenStore((s) => s.size)
  const messages = useImageGenStore((s) => s.messages)
  const setLibraryId = useImageGenStore((s) => s.setLibraryId)
  const setSize = useImageGenStore((s) => s.setSize)
  const setMessages = useImageGenStore((s) => s.setMessages)
  const hydrateFromSession = useImageGenStore((s) => s.hydrateFromSession)
  const setHydrated = useImageGenStore((s) => s.setHydrated)

  const [input, setInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [decisionBusyId, setDecisionBusyId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const availableSizes = config?.imageGen.availableSizes ?? []
  const defaultSize = config?.imageGen.size ?? '1024*1024'

  useEffect(() => {
    if (hydrated) return
    void window.api.imageGen.loadSession().then((session) => {
      hydrateFromSession(session)
    }).catch(() => setHydrated(true))
  }, [hydrated, hydrateFromSession, setHydrated])

  useEffect(() => {
    if (!hydrated) return
    if (!size && defaultSize) setSize(defaultSize)
  }, [defaultSize, size, hydrated, setSize])

  useEffect(() => {
    if (!hydrated || libraries.length === 0) return
    if (!libraryId || !libraries.some((l) => l.id === libraryId)) {
      setLibraryId(libraries[0].id)
    }
  }, [libraries, libraryId, hydrated, setLibraryId])

  useEffect(() => {
    if (!hydrated) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void window.api.imageGen.saveSession(buildImageGenSession({ libraryId, size, messages }))
    }, 300)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [hydrated, libraryId, size, messages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, generating])

  const updateAssistant = useCallback(
    (id: string, patch: Partial<(typeof messages)[number]>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id && m.role === 'assistant' ? { ...m, ...patch } : m))
      )
    },
    [setMessages]
  )

  const handleSend = async () => {
    const prompt = input.trim()
    if (!prompt || generating) return
    if (libraries.length === 0) {
      alert('请先在图库页面添加一个目录')
      return
    }

    const userMsg = { id: createId(), role: 'user' as const, content: prompt }
    const assistantId = createId()
    const targetLibrary = libraryId
      ? libraries.find((l) => l.id === libraryId)
      : libraries[0]

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant' as const, content: '正在生成图片，请稍候...' }
    ])
    setInput('')
    setGenerating(true)

    try {
      const result = await window.api.imageGen.generate({
        prompt,
        libraryId: targetLibrary?.id,
        size: size || undefined
      })
      updateAssistant(assistantId, {
        content: `已根据你的描述生成图片。请预览并选择是否保存到图库「${result.libraryName}」。`,
        generation: result,
        decision: 'pending' as GenerationDecision
      })
    } catch (err) {
      updateAssistant(assistantId, {
        content: '生成失败',
        error: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleAccept = async (messageId: string, generationId: string) => {
    setDecisionBusyId(generationId)
    try {
      const acceptResult = await window.api.imageGen.accept(generationId)
      updateAssistant(messageId, {
        content: `图片已保存到图库「${acceptResult.libraryName}」。`,
        decision: 'accepted',
        acceptResult
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setDecisionBusyId(null)
    }
  }

  const handleReject = async (messageId: string, generationId: string) => {
    setDecisionBusyId(generationId)
    try {
      await window.api.imageGen.reject(generationId)
      updateAssistant(messageId, {
        content: '已拒绝本次生成，临时文件已删除。',
        decision: 'rejected'
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setDecisionBusyId(null)
    }
  }

  const selectedLibrary = libraries.find((l) => l.id === libraryId)

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
          <h1 className="text-lg font-semibold">文生图</h1>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            基于 {config?.imageGen.model ?? '文生图模型'} · 生成后需确认才会写入图库
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={libraryId}
            onChange={(e) => setLibraryId(e.target.value)}
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
            {(availableSizes.length > 0 ? availableSizes : [defaultSize]).map((s) => (
              <option key={s} value={s}>{s.replace('*', ' × ')}</option>
            ))}
          </select>
          {selectedLibrary && (
            <span className="text-[10px] text-[var(--color-muted)] truncate max-w-xs">
              保存路径：{selectedLibrary.rootPath}
              {config?.imageGen.saveSubfolder ? ` / ${config.imageGen.saveSubfolder}` : ''}
            </span>
          )}
        </div>
      </div>

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
              <div className="max-w-[85%]">
                <div className="px-4 py-2.5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] text-sm shadow-sm">
                  {msg.content}
                  {msg.error && (
                    <p className="mt-2 text-xs text-red-500">{msg.error}</p>
                  )}
                </div>
                {msg.generation && (
                  <ImageGenResultCard
                    result={msg.generation}
                    status={msg.decision ?? 'pending'}
                    acceptResult={msg.acceptResult}
                    busy={decisionBusyId === msg.generation.generationId}
                    onAccept={() => handleAccept(msg.id, msg.generation!.generationId)}
                    onReject={() => handleReject(msg.id, msg.generation!.generationId)}
                  />
                )}
              </div>
            </div>
          )
        )}
      </div>

      <div className="p-4 glass border-t border-[var(--color-border)]">
        <div className="flex gap-2 items-end max-w-3xl mx-auto">
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
            placeholder="描述你想生成的画面，例如：日落时分的海边，暖色调，电影感..."
            disabled={generating || libraries.length === 0}
            className="flex-1 px-4 py-3 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 text-sm resize-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={generating || !input.trim() || libraries.length === 0}
            className="px-5 py-3 rounded-apple-sm bg-[var(--color-accent)] text-white text-sm font-medium disabled:opacity-50 shrink-0"
          >
            {generating ? '生成中' : '生成'}
          </button>
        </div>
        <p className="text-[10px] text-[var(--color-muted)] text-center mt-2">
          Enter 发送 · Shift+Enter 换行 · 历史记录自动保存
        </p>
      </div>
    </div>
  )
}
