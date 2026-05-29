import { useEffect, useState } from 'react'
import type {
  AppConfig,
  ConfigRuntimeInfo,
  LocalModelStatus,
  LocalModelsRegistry,
  OllamaRuntimeStatus,
  OllamaVisionModelEntry
} from '../../shared/types'
import { toast } from '../store/toastStore'
import { confirmAction } from '../store/confirmStore'
import { useAppStore } from '../store/appStore'
import { resolveTheme } from '../utils/theme'
import { ModelDownloadAction } from '../components/ModelDownloadAction'
import { OllamaSetupAction } from '../components/OllamaSetupAction'

export function SettingsPage() {
  const config = useAppStore((s) => s.config)
  const setConfig = useAppStore((s) => s.setConfig)
  const setTheme = useAppStore((s) => s.setTheme)
  const [form, setForm] = useState<AppConfig | null>(null)
  const [saved, setSaved] = useState(false)
  const [embedStats, setEmbedStats] = useState<{
    total: number
    indexed: number
    pending: number
    staleModel?: number
    enabled?: boolean
  } | null>(null)
  const [localModelStatus, setLocalModelStatus] = useState<LocalModelStatus | null>(null)
  const [modelRegistry, setModelRegistry] = useState<LocalModelsRegistry | null>(null)
  const [modelDownloadBusy, setModelDownloadBusy] = useState(false)
  const [modelDownloadProgress, setModelDownloadProgress] = useState<{ modelId: string; progress: number } | null>(
    null
  )
  const [modelMsg, setModelMsg] = useState('')
  const [embedBusy, setEmbedBusy] = useState(false)
  const [embedMsg, setEmbedMsg] = useState('')
  const [lanMsg, setLanMsg] = useState('')
  const [llmTestMsg, setLlmTestMsg] = useState('')
  const [llmTesting, setLlmTesting] = useState(false)
  const [ollamaSetupBusy, setOllamaSetupBusy] = useState(false)
  const [ollamaLiveStatus, setOllamaLiveStatus] = useState<OllamaRuntimeStatus | null>(null)
  const [ollamaStatus, setOllamaStatus] = useState<OllamaRuntimeStatus | null>(null)
  const [ollamaVisionCatalog, setOllamaVisionCatalog] = useState<OllamaVisionModelEntry[]>([])
  const [runtimeInfo, setRuntimeInfo] = useState<ConfigRuntimeInfo | null>(null)

  const refreshEmbedStats = async () => {
    setEmbedStats(await window.api.embedding.getStats())
  }

  const refreshOllamaStatus = async () => {
    try {
      setOllamaStatus(await window.api.ollama.getStatus())
    } catch {
      setOllamaStatus(null)
    }
  }

  const refreshLocalModelStatus = async () => {
    try {
      setLocalModelStatus(await window.api.localModel.getStatus())
    } catch {
      setLocalModelStatus(null)
    }
    await refreshOllamaStatus()
  }

  useEffect(() => {
    if (config) setForm(JSON.parse(JSON.stringify(config)))
    void refreshEmbedStats()
    void refreshLocalModelStatus()
    window.api.localModel.getRegistry().then(setModelRegistry).catch(() => null)
    window.api.ollama.getVisionCatalog().then(setOllamaVisionCatalog).catch(() => null)
    window.api.config.getRuntimeInfo().then(setRuntimeInfo).catch(() => null)
    const unsubDownload = window.api.localModel.onDownloadProgress((payload) => {
      setModelDownloadProgress(payload)
    })
    const unsubOllama = window.api.ollama.onSetupProgress((status) => {
      setOllamaLiveStatus(status)
    })
    return () => {
      unsubDownload()
      unsubOllama()
    }
  }, [config])

  if (!form) return <div className="p-6">加载中...</div>

  const isAmdInference = form.localModels?.inferenceDevice === 'amd'
  const inferenceDeviceOptions = runtimeInfo?.inferenceDevices ?? []

  const updateLlm = (key: keyof AppConfig['llm'], value: string | number) => {
    setForm({ ...form, llm: { ...form.llm, [key]: value } })
  }

  const updateAnalysis = (key: keyof AppConfig['analysis'], value: string | number | boolean) => {
    setForm({ ...form, analysis: { ...form.analysis, [key]: value } })
  }

  const updateUi = (key: keyof AppConfig['ui'], value: string | number) => {
    setForm({ ...form, ui: { ...form.ui, [key]: value } })
  }

  const updateEmbedding = (key: keyof AppConfig['embedding'], value: string | number | boolean) => {
    setForm({ ...form, embedding: { ...form.embedding, [key]: value } })
  }

  const updateLocalModels = (key: keyof AppConfig['localModels'], value: string | boolean) => {
    setForm({ ...form, localModels: { ...form.localModels, [key]: value } })
  }

  const updateImageGen = (key: keyof AppConfig['imageGen'], value: string | number | boolean) => {
    setForm({ ...form, imageGen: { ...form.imageGen, [key]: value } })
  }

  const updateImageEdit = (key: keyof AppConfig['imageEdit'], value: string | number | boolean) => {
    setForm({ ...form, imageEdit: { ...form.imageEdit, [key]: value } })
  }

  const updateLanServer = (key: keyof AppConfig['lanServer'], value: string | number | boolean) => {
    setForm({ ...form, lanServer: { ...form.lanServer, [key]: value } })
  }

  const handleRegenerateLanToken = async () => {
    try {
      const token = await window.api.lanServer.regenerateToken()
      setForm((prev) => (prev ? { ...prev, lanServer: { ...prev.lanServer, token } } : prev))
      setLanMsg(`已生成新令牌：${token}，请重新复制导入页链接`)
    } catch (err) {
      setLanMsg(`失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const runEmbedTask = async (task: 'backfill' | 'rebuild') => {
    setEmbedBusy(true)
    setEmbedMsg('')
    try {
      const res =
        task === 'backfill' ? await window.api.embedding.backfill() : await window.api.embedding.rebuild()
      const action = task === 'backfill' ? '补建' : '重建'
      setEmbedMsg(`${action}完成：成功 ${res.indexed} 条，失败 ${res.failed} 条`)
      await refreshEmbedStats()
    } catch (err) {
      setEmbedMsg(`失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setEmbedBusy(false)
    }
  }

  const handleBackfill = () => runEmbedTask('backfill')

  const handleRebuild = async () => {
    const isCloudEmbed = form?.embedding.provider === 'cloud'
    const warn = isCloudEmbed
      ? '将清空现有向量索引并全部重新建立，可能需要较长时间并消耗 API 额度，是否继续？'
      : '将清空现有向量索引并使用本地模型全部重新建立，是否继续？'
    const ok = await confirmAction({ message: warn, danger: true, confirmLabel: '重新建立' })
    if (!ok) return
    runEmbedTask('rebuild')
  }

  const handleOllamaSetup = async () => {
    setOllamaSetupBusy(true)
    setModelMsg('')
    try {
      await window.api.config.save(form)
      setConfig(form)
      await window.api.ollama.setup()
      setModelMsg('Ollama 运行环境已就绪')
      await refreshOllamaStatus()
      await refreshLocalModelStatus()
      toast('Ollama 运行环境已就绪，请选择并下载视觉模型', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setModelMsg(`Ollama 配置失败：${msg}`)
      toast(msg, 'error')
    } finally {
      setOllamaSetupBusy(false)
      setOllamaLiveStatus(null)
    }
  }

  const handleDownloadModel = async (modelId: string, kind: 'caption' | 'embedding') => {
    if (kind === 'caption' && isAmdInference) {
      await window.api.config.save(form)
      setConfig(form)
    }
    setModelDownloadBusy(true)
    setModelMsg('')
    setModelDownloadProgress({ modelId, progress: 0 })
    try {
      await window.api.localModel.download(modelId, kind)
      setModelDownloadProgress({ modelId, progress: 100 })
      setModelMsg('模型下载完成')
      await refreshLocalModelStatus()
      toast('模型下载完成', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setModelMsg(`下载失败：${msg}`)
      toast(msg, 'error')
    } finally {
      setModelDownloadBusy(false)
      setModelDownloadProgress(null)
    }
  }

  const findModelStatus = (modelId: string, kind: 'caption' | 'embedding') =>
    localModelStatus?.items.find((i) => i.id === modelId && i.kind === kind)

  const selectedCaptionModel = modelRegistry?.caption.find((m) => m.id === form?.analysis.localCaptionModelId)
  const selectedEmbeddingModel = modelRegistry?.embedding.find((m) => m.id === form?.embedding.localModelId)
  const selectedOllamaVision = ollamaVisionCatalog.find((m) => m.tag === form.localModels.ollamaVisionModelTag)
  const ollamaRuntimeStatus = ollamaLiveStatus ?? ollamaStatus ?? localModelStatus?.ollama ?? null
  const ollamaRuntimeReady = ollamaRuntimeStatus?.runtimeReady ?? false
  const ollamaModelReady =
    Boolean(ollamaRuntimeStatus?.modelReady) &&
    ollamaRuntimeStatus?.visionModel === form.localModels.ollamaVisionModelTag

  const handleSave = async () => {
    await window.api.config.save(form)
    setConfig(form)
    setTheme(resolveTheme(form.ui.theme))
    await refreshEmbedStats()
    setLanMsg('设置已保存，局域网服务已自动重启')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTestLlm = async () => {
    setLlmTesting(true)
    setLlmTestMsg('')
    try {
      const res = await window.api.config.testLlm()
      setLlmTestMsg(res.message)
    } catch (err) {
      setLlmTestMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setLlmTesting(false)
    }
  }

  const handleReset = async () => {
    const defaults = await window.api.config.getDefaults()
    setForm(defaults)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-2">设置</h1>
      <p className="text-sm text-[var(--color-muted)] mb-6">配置大模型 API 与分析参数（所有值均可自定义，无硬编码）</p>

      <section className="mb-6 p-5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] space-y-4">
        <h2 className="font-semibold">大模型 API</h2>
        <p className="text-xs text-[var(--color-muted)]">支持 OpenAI 兼容协议（如 DashScope、OpenAI、本地代理等）</p>

        <Field label="API Key">
          <input
            type="password"
            value={form.llm.apiKey}
            onChange={(e) => updateLlm('apiKey', e.target.value)}
            placeholder="在阿里云 DashScope 控制台获取"
            className="field-input"
          />
        </Field>
        <Field label="Base URL">
          <input
            type="url"
            value={form.llm.baseUrl}
            onChange={(e) => updateLlm('baseUrl', e.target.value)}
            className="field-input"
          />
        </Field>
        <Field label="Model">
          <input
            type="text"
            value={form.llm.model}
            onChange={(e) => updateLlm('model', e.target.value)}
            placeholder="需支持视觉能力的模型，如 qwen-vl-max"
            className="field-input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="分析并发数">
            <input
              type="number"
              min={1}
              max={16}
              value={form.llm.maxConcurrency}
              onChange={(e) => updateLlm('maxConcurrency', Number(e.target.value))}
              className="field-input"
            />
            <p className="text-[10px] text-[var(--color-muted)] mt-1">
              同时分析多张图片（1~16），越大越快，但受 API 限速与网络影响，建议 4~8
            </p>
          </Field>
          <Field label="超时 (ms)">
            <input
              type="number"
              value={form.llm.timeoutMs}
              onChange={(e) => updateLlm('timeoutMs', Number(e.target.value))}
              className="field-input"
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={() => void handleTestLlm()}
          disabled={llmTesting}
          className="px-4 py-2 rounded-apple-sm border border-[var(--color-accent)] text-[var(--color-accent)] text-sm disabled:opacity-50"
        >
          {llmTesting ? '测试中...' : '测试 API 连接'}
        </button>
        {llmTestMsg && <p className="text-xs text-[var(--color-accent)]">{llmTestMsg}</p>}
        <p className="text-[10px] text-[var(--color-muted)]">视觉分析建议使用 qwen-vl-max 等支持看图的模型</p>
      </section>

      <section className="mb-6 p-5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] space-y-4">
        <h2 className="font-semibold">本地端侧分析</h2>
        <p className="text-xs text-[var(--color-muted)]">
          本地描述为 Qwen 视觉语言模型（推荐 Qwen3-VL 2B，约 4.5GB），提问对齐 image_analysis；大模型建议并发 1。向量用 BGE 中文。名人/IP/梗请用「云端增强分析」。
        </p>
        <Field label="HF 只读 Token（可选）">
          <input
            type="password"
            value={form.localModels?.hfToken ?? ''}
            onChange={(e) => updateLocalModels('hfToken', e.target.value)}
            placeholder="一般留空；若仍 401 可在 huggingface.co/settings/tokens 创建 read token"
            className="field-input"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.localModels?.ignoreEnvHfToken ?? true}
            onChange={(e) => updateLocalModels('ignoreEnvHfToken', e.target.checked)}
          />
          下载时忽略系统环境变量中的 HF_TOKEN（避免无效 token 导致 401）
        </label>
        <Field label="模型下载源（Hugging Face 镜像）">
          <input
            type="url"
            value={form.localModels?.remoteHost ?? ''}
            onChange={(e) => updateLocalModels('remoteHost', e.target.value)}
            placeholder="留空则用环境变量 HF_ENDPOINT；国内建议 https://hf-mirror.com"
            className="field-input"
          />
          <p className="text-[10px] text-[var(--color-muted)] mt-1">
            无法访问 huggingface.co 时填写镜像。公开 ONNX 模型一般无需 HF 账号；下载地址形如：…/onnx-community/Qwen3-VL-2B-Instruct-ONNX/resolve/main/…
            {localModelStatus?.effectiveRemoteHost && (
              <> · 当前生效：{localModelStatus.effectiveRemoteHost}</>
            )}
          </p>
        </Field>
        <Field label="默认分析模式">
          <select
            value={form.analysis.defaultMode}
            onChange={(e) => updateAnalysis('defaultMode', e.target.value)}
            className="field-input"
          >
            <option value="local">本地（推荐，省 token）</option>
            <option value="cloud">云端（消耗 API）</option>
          </select>
        </Field>
        <Field label="本地推理设备">
          <select
            value={form.localModels?.inferenceDevice ?? 'wasm'}
            onChange={(e) => {
              updateLocalModels('inferenceDevice', e.target.value)
              if (e.target.value === 'amd') void refreshOllamaStatus()
            }}
            className="field-input"
          >
            {inferenceDeviceOptions.map((device) => (
              <option key={device.id} value={device.id}>
                {device.label}
              </option>
            ))}
          </select>
          {isAmdInference && (
            <OllamaSetupAction
              status={ollamaRuntimeStatus}
              liveStatus={ollamaLiveStatus}
              busy={ollamaSetupBusy}
              onSetup={() => void handleOllamaSetup()}
            />
          )}
        </Field>
        <Field label="本地描述模型">
          {!isAmdInference ? (
            <>
              <select
                value={form.analysis.localCaptionModelId}
                onChange={(e) => updateAnalysis('localCaptionModelId', e.target.value)}
                className="field-input"
              >
                {(modelRegistry?.caption ?? []).map((m) => {
                  const st = localModelStatus?.items.find((i) => i.id === m.id && i.kind === 'caption')
                  const prefix = m.recommended ? '【推荐】' : ''
                  return (
                    <option key={m.id} value={m.id}>
                      {prefix}
                      {m.label} {st?.ready ? '（已就绪）' : '（未下载）'}
                    </option>
                  )
                })}
              </select>
              {selectedCaptionModel && (
                <ModelDownloadAction
                  modelId={selectedCaptionModel.id}
                  kind="caption"
                  label={selectedCaptionModel.label}
                  estimatedSizeMb={selectedCaptionModel.estimatedSizeMb}
                  status={findModelStatus(selectedCaptionModel.id, 'caption')}
                  liveProgress={modelDownloadProgress}
                  busy={modelDownloadBusy}
                  onDownload={(id, kind) => void handleDownloadModel(id, kind)}
                />
              )}
            </>
          ) : (
            <>
              <select
                value={form.localModels.ollamaVisionModelTag}
                onChange={(e) => updateLocalModels('ollamaVisionModelTag', e.target.value)}
                className="field-input"
              >
                {ollamaVisionCatalog.map((m) => {
                  const prefix = m.recommended ? '【推荐】' : ''
                  const ready =
                    ollamaModelReady && m.tag === form.localModels.ollamaVisionModelTag
                  return (
                    <option key={m.tag} value={m.tag}>
                      {prefix}
                      {m.label} {ready ? '（已就绪）' : '（未下载）'}
                    </option>
                  )
                })}
              </select>
              {selectedOllamaVision && (
                <ModelDownloadAction
                  modelId={form.analysis.localCaptionModelId}
                  kind="caption"
                  label={selectedOllamaVision.label}
                  estimatedSizeMb={selectedOllamaVision.estimatedSizeMb}
                  status={{
                    id: form.analysis.localCaptionModelId,
                    label: selectedOllamaVision.label,
                    kind: 'caption',
                    ready: ollamaModelReady,
                    downloading: modelDownloadBusy,
                    progress: modelDownloadProgress?.modelId === form.analysis.localCaptionModelId
                      ? modelDownloadProgress.progress
                      : undefined
                  }}
                  liveProgress={modelDownloadProgress}
                  busy={modelDownloadBusy}
                  disabled={!ollamaRuntimeReady}
                  disabledHint="请先点击上方「配置 Ollama 运行环境」"
                  onDownload={(id, kind) => void handleDownloadModel(id, kind)}
                />
              )}
              {!ollamaRuntimeReady && (
                <p className="mt-2 text-xs text-orange-500">
                  请先在上方「本地推理设备」中配置 Ollama 运行环境，再下载视觉模型。
                </p>
              )}
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                Ollama 模型与 ONNX 权重分开存储。切换模型后下载时会自动保存设置。
              </p>
            </>
          )}
        </Field>
        <Field label="本地分析并发">
          <input
            type="number"
            min={1}
            max={8}
            value={form.analysis.localConcurrency}
            onChange={(e) => updateAnalysis('localConcurrency', Number(e.target.value))}
            className="field-input"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.analysis.fallbackToCloudWhenLocalUnavailable}
            onChange={(e) => updateAnalysis('fallbackToCloudWhenLocalUnavailable', e.target.checked)}
          />
          本地模型未就绪时自动回退云端分析（需 API Key，推荐开启）
        </label>
        {localModelStatus && (
          <div className="text-xs text-[var(--color-muted)] space-y-1 pt-1 border-t border-[var(--color-border)]">
            <p>模型目录：{localModelStatus.modelsDir}</p>
            {localModelStatus.ollamaModelsDir && (
              <p>Ollama 模型目录：{localModelStatus.ollamaModelsDir}</p>
            )}
            <p>缓存约 {localModelStatus.cacheSizeMb} MB</p>
            {!localModelStatus.allReady && (
              <p className="text-orange-500">部分模型未下载，本地分析/向量可能不可用</p>
            )}
          </div>
        )}
        {modelMsg && <p className="text-xs text-[var(--color-accent)]">{modelMsg}</p>}
      </section>

      <section className="mb-6 p-5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] space-y-4">
        <h2 className="font-semibold">分析参数</h2>
        <p className="text-[10px] text-[var(--color-muted)]">云端增强使用最新提示词；升级应用后请对旧图片重新分析以更新识别结果</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="图片最大边长 (px)">
            <input
              type="number"
              value={form.analysis.maxImageEdgePx}
              onChange={(e) => updateAnalysis('maxImageEdgePx', Number(e.target.value))}
              className="field-input"
            />
          </Field>
          <Field label="视频抽帧数">
            <input
              type="number"
              min={4}
              max={32}
              value={form.analysis.videoFrameCount}
              onChange={(e) => updateAnalysis('videoFrameCount', Number(e.target.value))}
              className="field-input"
            />
          </Field>
          <Field label="GIF 抽帧数">
            <input
              type="number"
              min={4}
              max={32}
              value={form.analysis.gifFrameCount}
              onChange={(e) => updateAnalysis('gifFrameCount', Number(e.target.value))}
              className="field-input"
            />
          </Field>
          <Field label="帧序列 fps（百炼 video API）">
            <input
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={form.analysis.sequenceFrameFps}
              onChange={(e) => updateAnalysis('sequenceFrameFps', Number(e.target.value))}
              className="field-input"
            />
          </Field>
        </div>
        <p className="text-[10px] text-[var(--color-muted)]">
          视频与 GIF 使用百炼 OpenAI 兼容 <code>type: video</code> 帧序列 API 分析，至少 {form.analysis.sequenceMinFrames} 帧
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.analysis.skipIfHashUnchanged}
            onChange={(e) => updateAnalysis('skipIfHashUnchanged', e.target.checked)}
          />
          文件未变更时跳过重复分析
        </label>
      </section>

      <section className="mb-6 p-5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] space-y-4">
        <h2 className="font-semibold">向量语义搜索</h2>
        <p className="text-xs text-[var(--color-muted)]">
          将分析文本转为向量；可选择本地模型（零 token）或云端 Embedding API
        </p>
        <Field label="向量提供方">
          <select
            value={form.embedding.provider}
            onChange={(e) => updateEmbedding('provider', e.target.value)}
            className="field-input"
          >
            <option value="local">本地（推荐）</option>
            <option value="cloud">云端 API</option>
          </select>
        </Field>
        {form.embedding.provider === 'local' ? (
          <Field label="本地向量模型">
            <select
              value={form.embedding.localModelId}
              onChange={(e) => updateEmbedding('localModelId', e.target.value)}
              className="field-input"
            >
              {(modelRegistry?.embedding ?? []).map((m) => {
                const st = localModelStatus?.items.find((i) => i.id === m.id && i.kind === 'embedding')
                return (
                  <option key={m.id} value={m.id}>
                    {m.label} {st?.ready ? '（已就绪）' : '（未下载）'}
                  </option>
                )
              })}
            </select>
            {selectedEmbeddingModel && (
              <ModelDownloadAction
                modelId={selectedEmbeddingModel.id}
                kind="embedding"
                label={selectedEmbeddingModel.label}
                estimatedSizeMb={selectedEmbeddingModel.estimatedSizeMb}
                status={findModelStatus(selectedEmbeddingModel.id, 'embedding')}
                liveProgress={modelDownloadProgress}
                busy={modelDownloadBusy}
                onDownload={(id, kind) => void handleDownloadModel(id, kind)}
              />
            )}
          </Field>
        ) : (
          <Field label="云端 Embedding Model">
            <input
              type="text"
              value={form.embedding.model}
              onChange={(e) => updateEmbedding('model', e.target.value)}
              placeholder="如 text-embedding-v3（DashScope）"
              className="field-input"
            />
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.embedding.enabled}
            onChange={(e) => updateEmbedding('enabled', e.target.checked)}
          />
          启用向量索引
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.embedding.autoIndexOnAnalysis}
            onChange={(e) => updateEmbedding('autoIndexOnAnalysis', e.target.checked)}
          />
          分析完成后自动建立向量
        </label>
        <div className="grid grid-cols-2 gap-4">
          <Field label="最低相似度 (0~1)">
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={form.embedding.minScore}
              onChange={(e) => updateEmbedding('minScore', Number(e.target.value))}
              className="field-input"
            />
          </Field>
          <Field label="最多返回条数">
            <input
              type="number"
              min={10}
              value={form.embedding.topK}
              onChange={(e) => updateEmbedding('topK', Number(e.target.value))}
              className="field-input"
            />
          </Field>
        </div>
        {embedStats && (
          <div className="text-xs text-[var(--color-muted)] space-y-1">
            <p>
              向量索引：已索引 {embedStats.indexed} / {embedStats.total}，待建 {embedStats.pending}
            </p>
            {!embedStats.enabled && (
              <p className="text-orange-500">向量索引已关闭，搜索页「向量语义」模式不可用</p>
            )}
            {embedStats.staleModel != null && embedStats.staleModel > 0 && (
              <p className="text-orange-500">
                有 {embedStats.staleModel} 条旧模型索引，请点击「重新建立向量索引」更新
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleBackfill}
            disabled={embedBusy || !form.embedding.enabled}
            className="px-4 py-2 rounded-apple-sm border border-[var(--color-accent)] text-[var(--color-accent)] text-sm disabled:opacity-50"
          >
            {embedBusy ? '处理中...' : '补建向量索引（仅缺失）'}
          </button>
          <button
            type="button"
            onClick={handleRebuild}
            disabled={embedBusy || !form.embedding.enabled}
            className="px-4 py-2 rounded-apple-sm border border-orange-500 text-orange-500 text-sm disabled:opacity-50"
          >
            {embedBusy ? '处理中...' : '重新建立向量索引（全部）'}
          </button>
        </div>
        <p className="text-[10px] text-[var(--color-muted)]">
          补建仅处理尚未索引的图片；更换 Embedding 模型或搜索异常时，请使用「重新建立」清空后全量重建
        </p>
        {embedMsg && <p className="text-xs text-[var(--color-accent)]">{embedMsg}</p>}
      </section>

      <section className="mb-6 p-5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] space-y-4">
        <h2 className="font-semibold">局域网传输</h2>
        <p className="text-xs text-[var(--color-muted)]">
          启动本地 HTTP 服务，同一 WiFi 下的手机可上传照片到图库，或浏览并下载电脑图库中的图片。首次启动自动生成访问令牌。
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.lanServer.enabled}
            onChange={(e) => updateLanServer('enabled', e.target.checked)}
          />
          启用局域网传输服务
        </label>
        <div className="grid grid-cols-2 gap-4">
          <Field label="端口">
            <input
              type="number"
              min={1024}
              max={65535}
              value={form.lanServer.port}
              onChange={(e) => updateLanServer('port', Number(e.target.value))}
              className="field-input"
            />
          </Field>
          <Field label="上传子目录（相对图库根路径）">
            <input
              type="text"
              value={form.lanServer.uploadSubfolder}
              onChange={(e) => updateLanServer('uploadSubfolder', e.target.value)}
              className="field-input"
            />
          </Field>
        </div>
        <Field label="访问令牌（留空则自动生成）">
          <input
            type="text"
            value={form.lanServer.token}
            onChange={(e) => updateLanServer('token', e.target.value)}
            placeholder="8 位十六进制"
            className="field-input font-mono text-sm"
          />
        </Field>
        <button
          type="button"
          onClick={handleRegenerateLanToken}
          className="px-4 py-2 rounded-apple-sm border border-[var(--color-border)] text-sm"
        >
          重新生成访问令牌
        </button>
        {lanMsg && <p className="text-xs text-[var(--color-accent)]">{lanMsg}</p>}
        <p className="text-[10px] text-[var(--color-muted)]">修改端口或开关后请点击底部「保存设置」以重启局域网服务。</p>
        <p className="text-[10px] text-[var(--color-muted)]">
          Windows 防火墙可能拦截首次访问，请在弹窗中允许专用网络。仅建议在可信局域网内使用。
        </p>
      </section>

      <section className="mb-6 p-5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] space-y-4">
        <h2 className="font-semibold">文生图</h2>
        <p className="text-xs text-[var(--color-muted)]">
          使用阿里云百炼原生 API（与上方视觉分析 API 共用 Key）。北京地域 endpoint 见
          {' '}
          <a
            href="https://help.aliyun.com/zh/model-studio/qwen-image-api"
            className="text-[var(--color-accent)] underline"
            target="_blank"
            rel="noreferrer"
          >
            官方文档
          </a>
        </p>
        <Field label="Model">
          <input
            type="text"
            value={form.imageGen.model}
            onChange={(e) => updateImageGen('model', e.target.value)}
            className="field-input"
          />
        </Field>
        <Field label="Endpoint">
          <input
            type="url"
            value={form.imageGen.endpoint}
            onChange={(e) => updateImageGen('endpoint', e.target.value)}
            className="field-input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="默认尺寸">
            <input
              type="text"
              value={form.imageGen.size}
              onChange={(e) => updateImageGen('size', e.target.value)}
              placeholder="1024*1024"
              className="field-input"
            />
          </Field>
          <Field label="超时 (ms)">
            <input
              type="number"
              value={form.imageGen.timeoutMs}
              onChange={(e) => updateImageGen('timeoutMs', Number(e.target.value))}
              className="field-input"
            />
          </Field>
        </div>
        <Field label="保存子目录（相对图库根路径）">
          <input
            type="text"
            value={form.imageGen.saveSubfolder}
            onChange={(e) => updateImageGen('saveSubfolder', e.target.value)}
            placeholder="generated"
            className="field-input"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.imageGen.promptExtend}
            onChange={(e) => updateImageGen('promptExtend', e.target.checked)}
          />
          开启 Prompt 智能改写（prompt_extend）
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.imageGen.watermark}
            onChange={(e) => updateImageGen('watermark', e.target.checked)}
          />
          添加 Qwen-Image 水印
        </label>
      </section>

      <section className="mb-6 p-5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] space-y-4">
        <h2 className="font-semibold">AI 图片编辑</h2>
        <p className="text-xs text-[var(--color-muted)]">
          基于
          {' '}
          <a
            href="https://help.aliyun.com/zh/model-studio/qwen-image-edit-api"
            className="text-[var(--color-accent)] underline"
            target="_blank"
            rel="noreferrer"
          >
            Qwen-Image-Edit API
          </a>
          ，支持 1~3 张输入图 + 编辑指令，输出 PNG
        </p>
        <Field label="Model">
          <input
            type="text"
            value={form.imageEdit.model}
            onChange={(e) => updateImageEdit('model', e.target.value)}
            className="field-input"
          />
        </Field>
        <Field label="Endpoint">
          <input
            type="url"
            value={form.imageEdit.endpoint}
            onChange={(e) => updateImageEdit('endpoint', e.target.value)}
            className="field-input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="输出尺寸（留空跟随原图）">
            <input
              type="text"
              value={form.imageEdit.size}
              onChange={(e) => updateImageEdit('size', e.target.value)}
              placeholder="1024*1024"
              className="field-input"
            />
          </Field>
          <Field label="最大输入张数">
            <input
              type="number"
              min={1}
              max={3}
              value={form.imageEdit.maxInputImages}
              onChange={(e) => updateImageEdit('maxInputImages', Number(e.target.value))}
              className="field-input"
            />
          </Field>
        </div>
        <Field label="入库子目录">
          <input
            type="text"
            value={form.imageEdit.saveSubfolder}
            onChange={(e) => updateImageEdit('saveSubfolder', e.target.value)}
            className="field-input"
          />
        </Field>
      </section>

      <section className="mb-6 p-5 rounded-apple bg-[var(--color-card)] border border-[var(--color-border)] space-y-4">
        <h2 className="font-semibold">界面</h2>
        <Field label="主题">
          <select
            value={form.ui.theme}
            onChange={(e) => updateUi('theme', e.target.value)}
            className="field-input"
          >
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </Field>
        <Field label="网格列最小宽度 (px)">
          <input
            type="number"
            min={120}
            max={320}
            value={form.ui.gridColumnMinWidth}
            onChange={(e) => updateUi('gridColumnMinWidth', Number(e.target.value))}
            className="field-input"
          />
        </Field>
      </section>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="px-5 py-2.5 rounded-apple-sm bg-[var(--color-accent)] text-white font-medium"
        >
          {saved ? '已保存 ✓' : '保存设置'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="px-5 py-2.5 rounded-apple-sm border border-[var(--color-border)]"
        >
          恢复默认
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium mb-1 block">{label}</span>
      {children}
    </label>
  )
}
