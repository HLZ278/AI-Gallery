import type { OllamaRuntimeStatus } from '../../shared/types'

interface OllamaSetupActionProps {
  status: OllamaRuntimeStatus | null
  liveStatus: OllamaRuntimeStatus | null
  busy: boolean
  onSetup: () => void
}

const phaseLabels: Record<string, string> = {
  idle: '未配置',
  downloading_installer: '下载安装包',
  installing: '安装中',
  starting: '启动服务',
  environment_ready: '环境就绪',
  pulling_model: '下载模型',
  ready: '已就绪',
  error: '失败'
}

export function OllamaSetupAction({ status, liveStatus, busy, onSetup }: OllamaSetupActionProps) {
  const current = liveStatus ?? status
  const runtimeReady = current?.runtimeReady ?? (current?.installed && current?.running)
  const progress = current?.progress ?? 0
  const message = current?.message ?? ''
  const error = current?.error
  const envBusy =
    busy && current?.phase !== 'pulling_model' && current?.phase !== 'ready' && current?.phase !== 'environment_ready'

  if (runtimeReady) {
    return (
      <div className="mt-2 space-y-1 text-xs">
        <p className="text-green-600">Ollama 运行环境已就绪（Vulkan）</p>
        {current?.ollamaModelsDir && (
          <p className="text-[var(--color-muted)] break-all">模型目录：{current.ollamaModelsDir}</p>
        )}
        <p className="text-[var(--color-muted)]">请在下方选择 Ollama 视觉模型并下载。</p>
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onSetup}
          className="px-4 py-2 rounded-apple-sm bg-[var(--color-accent)] text-white text-sm disabled:opacity-50"
        >
          {envBusy ? '配置中…' : '配置 Ollama 运行环境'}
        </button>
        {!busy && (
          <span className="text-xs text-orange-500">
            自动下载安装 Ollama 并启动 Vulkan 服务（不含模型下载）
          </span>
        )}
      </div>
      {envBusy && (
        <div className="p-3 rounded-apple-sm bg-black/5 border border-[var(--color-border)]">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="truncate pr-2">
              {phaseLabels[current?.phase ?? 'idle'] ?? '配置中'}
              {message ? ` · ${message}` : ''}
            </span>
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
      {error && !busy && <p className="text-xs text-red-500 break-all">{error}</p>}
      {current && !busy && !runtimeReady && (
        <p className="text-xs text-[var(--color-muted)]">
          状态：{current.installed ? '已安装' : '未安装'} / {current.running ? '运行中' : '未运行'}
        </p>
      )}
    </div>
  )
}
