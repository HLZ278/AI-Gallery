import { app } from 'electron'
import { spawn, execFile, type ChildProcess } from 'child_process'
import { createWriteStream, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'
import type { OllamaRuntimeStatus } from '../../../shared/types'
import { getOllamaModelsDir } from '../infra/AppPaths'
import { loadOllamaRuntimeConfig } from '../infra/OllamaRuntimeConfig'
import { resolveCaptionOllamaModel } from './CaptionRuntime'

const execFileAsync = promisify(execFile)

type ProgressListener = (status: OllamaRuntimeStatus) => void

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export class OllamaRuntimeService {
  private managedProcess: ChildProcess | null = null
  private weStartedServe = false
  private setupRunning = false
  private progressListeners: ProgressListener[] = []
  private status: OllamaRuntimeStatus = this.buildStatus()

  onSetupProgress(cb: ProgressListener): () => void {
    this.progressListeners.push(cb)
    return () => {
      this.progressListeners = this.progressListeners.filter((l) => l !== cb)
    }
  }

  private emitStatus(patch?: Partial<OllamaRuntimeStatus>): void {
    if (patch?.installed !== undefined || patch?.running !== undefined) {
      const installed = patch.installed ?? this.status.installed
      const running = patch.running ?? this.status.running
      patch.runtimeReady = installed && running
    }
    this.status = { ...this.status, ...patch }
    if (this.status.installed && this.status.running) {
      this.status.runtimeReady = true
    }
    for (const cb of this.progressListeners) cb(this.status)
  }

  private buildStatus(): OllamaRuntimeStatus {
    const cfg = loadOllamaRuntimeConfig()
    const visionModel = resolveCaptionOllamaModel()
    const installed = existsSync(this.getOllamaExePath())
    return {
      installed,
      running: false,
      runtimeReady: false,
      modelReady: false,
      ollamaModelsDir: getOllamaModelsDir(),
      installPath: this.getOllamaExePath(),
      baseUrl: cfg.baseUrl,
      visionModel,
      phase: 'idle',
      progress: 0,
      message: ''
    }
  }

  getOllamaExePath(): string {
    const cfg = loadOllamaRuntimeConfig()
    const base = process.env[cfg.installDirEnv]?.trim()
    if (!base) {
      throw new Error(`环境变量 ${cfg.installDirEnv} 未设置，无法定位 Ollama`)
    }
    return join(base, ...cfg.installRelativePath.split('/'))
  }

  private buildServeEnv(): NodeJS.ProcessEnv {
    const cfg = loadOllamaRuntimeConfig()
    const modelsDir = getOllamaModelsDir()
    if (!existsSync(modelsDir)) mkdirSync(modelsDir, { recursive: true })
    return {
      ...process.env,
      ...cfg.gpuEnv,
      OLLAMA_MODELS: modelsDir
    }
  }

  async isApiReachable(): Promise<boolean> {
    const cfg = loadOllamaRuntimeConfig()
    try {
      const res = await fetch(`${cfg.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
      return res.ok
    } catch {
      return false
    }
  }

  async listLocalModels(): Promise<string[]> {
    const cfg = loadOllamaRuntimeConfig()
    const res = await fetch(`${cfg.baseUrl}/api/tags`, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`Ollama API 不可达: HTTP ${res.status}`)
    const data = (await res.json()) as { models?: Array<{ name?: string; model?: string }> }
    return (data.models ?? []).map((m) => m.name ?? m.model ?? '').filter(Boolean)
  }

  async isModelPulled(model: string): Promise<boolean> {
    if (!(await this.isApiReachable())) return false
    const names = await this.listLocalModels()
    const normalized = model.trim()
    return names.some((n) => n === normalized || n.startsWith(`${normalized}:`) || normalized.startsWith(`${n}:`))
  }

  async getStatus(): Promise<OllamaRuntimeStatus> {
    const cfg = loadOllamaRuntimeConfig()
    const visionModel = resolveCaptionOllamaModel()
    const installed = existsSync(this.getOllamaExePath())
    const running = await this.isApiReachable()
    const runtimeReady = installed && running
    let modelReady = false
    if (runtimeReady && visionModel) {
      try {
        modelReady = await this.isModelPulled(visionModel)
      } catch {
        modelReady = false
      }
    }
    this.status = {
      ...this.status,
      installed,
      running,
      runtimeReady,
      modelReady,
      ollamaModelsDir: getOllamaModelsDir(),
      installPath: this.getOllamaExePath(),
      baseUrl: cfg.baseUrl,
      visionModel,
      phase: modelReady ? 'ready' : runtimeReady ? 'environment_ready' : this.status.phase
    }
    return this.status
  }

  private async downloadInstaller(destPath: string, onProgress: (pct: number) => void): Promise<void> {
    const cfg = loadOllamaRuntimeConfig()
    const res = await fetch(cfg.installer.downloadUrl)
    if (!res.ok || !res.body) {
      throw new Error(`下载 Ollama 安装包失败: HTTP ${res.status}`)
    }
    const total = Number(res.headers.get('content-length') ?? 0)
    const reader = res.body.getReader()
    const ws = createWriteStream(destPath)
    let received = 0

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      ws.write(Buffer.from(value))
      received += value.length
      if (total > 0) onProgress(Math.min(95, Math.round((received / total) * 90)))
    }

    await new Promise<void>((resolve, reject) => {
      ws.end(() => resolve())
      ws.on('error', reject)
    })
  }

  private async installOllama(): Promise<void> {
    if (existsSync(this.getOllamaExePath())) return

    const cfg = loadOllamaRuntimeConfig()
    const installerPath = join(app.getPath('temp'), 'OllamaSetup.exe')

    this.emitStatus({ phase: 'downloading_installer', progress: 0, message: '正在下载 Ollama 安装包…', error: undefined })
    await this.downloadInstaller(installerPath, (pct) => {
      this.emitStatus({ progress: pct, message: '正在下载 Ollama 安装包…' })
    })

    this.emitStatus({ phase: 'installing', progress: 92, message: '正在安装 Ollama…' })
    await execFileAsync(installerPath, cfg.installer.silentArgs, { timeout: 600_000 })

    for (let i = 0; i < cfg.installPollMaxAttempts; i++) {
      if (existsSync(this.getOllamaExePath())) {
        this.emitStatus({ progress: 96, message: 'Ollama 安装完成', installed: true })
        return
      }
      await sleep(cfg.installPollIntervalMs)
    }
    throw new Error('Ollama 安装完成但未找到可执行文件，请重启应用后重试')
  }

  private async stopExistingOllama(): Promise<void> {
    if (process.platform !== 'win32') return
    try {
      await execFileAsync('taskkill', ['/F', '/IM', 'ollama.exe'], { timeout: 15_000 })
      await sleep(2000)
    } catch {
      /* 无进程时忽略 */
    }
  }

  private async startServe(options?: { forceRestart?: boolean }): Promise<void> {
    const cfg = loadOllamaRuntimeConfig()
    const exe = this.getOllamaExePath()
    if (!existsSync(exe)) throw new Error('Ollama 未安装')

    const forceRestart = options?.forceRestart ?? false
    if (!forceRestart && (await this.isApiReachable())) {
      this.emitStatus({
        phase: 'starting',
        progress: 98,
        message: 'Ollama 服务已在运行',
        running: true,
        installed: true
      })
      return
    }

    await this.stopExistingOllama()

    this.emitStatus({
      phase: 'starting',
      progress: 97,
      message: forceRestart ? '正在重启 Ollama（Vulkan + 模型目录）…' : '正在启动 Ollama（Vulkan）…'
    })
    const env = this.buildServeEnv()
    this.managedProcess = spawn(exe, ['serve'], {
      env,
      detached: false,
      stdio: 'ignore',
      windowsHide: true
    })
    this.weStartedServe = true
    this.managedProcess.on('exit', () => {
      this.managedProcess = null
      this.weStartedServe = false
    })

    const deadline = Date.now() + cfg.serveStartupWaitMs
    while (Date.now() < deadline) {
      if (await this.isApiReachable()) {
        this.emitStatus({ progress: 100, message: 'Ollama 服务已启动', running: true, installed: true })
        return
      }
      await sleep(500)
    }
    throw new Error('Ollama 服务启动超时，请检查防火墙或手动重启应用')
  }

  /** 仅安装并启动 Ollama 运行环境，不下载视觉模型 */
  async setup(): Promise<OllamaRuntimeStatus> {
    if (this.setupRunning) throw new Error('Ollama 配置正在进行中')
    if (process.platform !== 'win32') {
      throw new Error('AMD/Ollama 加速当前仅支持 Windows')
    }

    this.setupRunning = true
    try {
      this.emitStatus({ phase: 'downloading_installer', progress: 0, message: '准备配置 Ollama…', error: undefined })
      await this.installOllama()
      await this.startServe({ forceRestart: true })
      const visionModel = resolveCaptionOllamaModel()
      const modelReady = visionModel ? await this.isModelPulled(visionModel) : false
      this.emitStatus({
        phase: modelReady ? 'ready' : 'environment_ready',
        progress: 100,
        message: modelReady
          ? 'Ollama 运行环境与视觉模型均已就绪'
          : 'Ollama 运行环境已就绪，请选择并下载视觉模型',
        modelReady,
        error: undefined
      })
      return this.status
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.emitStatus({ phase: 'error', error: msg, message: msg })
      throw err
    } finally {
      this.setupRunning = false
    }
  }

  /** 下载指定 Ollama 视觉模型（需先完成 setup） */
  async pullVisionModel(modelTag: string): Promise<OllamaRuntimeStatus> {
    if (this.setupRunning) throw new Error('Ollama 配置正在进行中')
    const model = modelTag.trim()
    if (!model) throw new Error('未指定 Ollama 模型')

    const status = await this.getStatus()
    if (!status.runtimeReady) {
      throw new Error('请先点击「配置 Ollama 运行环境」完成安装与启动')
    }

    if (await this.isModelPulled(model)) {
      this.emitStatus({
        phase: 'ready',
        progress: 100,
        message: `模型 ${model} 已存在`,
        visionModel: model,
        modelReady: true
      })
      return this.status
    }

    this.setupRunning = true
    try {
      await this.pullModelStream(model)
      this.emitStatus({
        phase: 'ready',
        progress: 100,
        message: `模型 ${model} 已就绪`,
        visionModel: model,
        modelReady: true,
        error: undefined
      })
      return this.status
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.emitStatus({ phase: 'error', error: msg, message: msg })
      throw err
    } finally {
      this.setupRunning = false
    }
  }

  private async pullModelStream(model: string): Promise<void> {
    const cfg = loadOllamaRuntimeConfig()
    this.emitStatus({ phase: 'pulling_model', progress: 0, message: `正在下载 Ollama 模型 ${model}…` })

    const res = await fetch(`${cfg.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: true })
    })
    if (!res.ok || !res.body) {
      throw new Error(`Ollama 模型下载失败: HTTP ${res.status}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const evt = JSON.parse(line) as { status?: string; completed?: number; total?: number }
          if (typeof evt.completed === 'number' && typeof evt.total === 'number' && evt.total > 0) {
            const pct = Math.round((evt.completed / evt.total) * 100)
            this.emitStatus({
              progress: Math.min(99, pct),
              message: evt.status ? `${evt.status} (${evt.completed}/${evt.total})` : `下载中 ${pct}%`
            })
          } else if (evt.status) {
            this.emitStatus({ message: evt.status })
          }
        } catch {
          /* 忽略非 JSON 行 */
        }
      }
    }

    if (!(await this.isModelPulled(model))) {
      throw new Error(`Ollama 模型 ${model} 下载后仍未就绪`)
    }
  }

  async ensureReadyForAnalysis(): Promise<void> {
    const visionModel = resolveCaptionOllamaModel()
    if (!visionModel) {
      throw new Error('未选择 Ollama 视觉模型，请在设置中选择并下载')
    }

    const status = await this.getStatus()
    if (!status.runtimeReady) {
      throw new Error('Ollama 运行环境未就绪。请先点击「配置 Ollama 运行环境」。')
    }
    if (!status.modelReady) {
      throw new Error(`Ollama 视觉模型「${visionModel}」未下载。请在设置中选择模型并点击下载。`)
    }
  }

  shutdown(): void {
    if (this.managedProcess && this.weStartedServe) {
      try {
        this.managedProcess.kill()
      } catch {
        /* ignore */
      }
      this.managedProcess = null
      this.weStartedServe = false
    }
  }
}

export const ollamaRuntimeService = new OllamaRuntimeService()
