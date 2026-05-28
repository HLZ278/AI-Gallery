import { fork, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { getAppInstallDir, getModelsCacheDir } from '../infra/AppPaths'
import { configService } from './ConfigService'
import { resolveRegistryPath } from './LocalModelRegistry'
import { promptRegistry } from '../domain/PromptRegistry'
import type {
  DownloadProgressPayload,
  WorkerCaptionFromFramesPayload,
  WorkerCaptionFromPathPayload,
  WorkerDownloadPayload,
  WorkerEmbedPayload,
  WorkerEvent,
  WorkerInitPayload,
  WorkerRequest,
  WorkerResponse
} from '../workers/LocalInferenceProtocol'

const LOG_PREFIX = '[LocalInferenceBridge]'
const DEFAULT_RPC_TIMEOUT_MS = 30 * 60 * 1000
const CAPTION_TIMEOUT_MS = 15 * 60 * 1000

type Pending = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class LocalInferenceBridge {
  private child: ChildProcess | null = null
  private pending = new Map<string, Pending>()
  private nextId = 1
  private initPromise: Promise<void> | null = null
  private workerReady = false
  private progressListeners: Array<(payload: DownloadProgressPayload) => void> = []
  private restartAttempts = 0
  private maxRestartAttempts = 2

  onDownloadProgress(cb: (payload: DownloadProgressPayload) => void): () => void {
    this.progressListeners.push(cb)
    return () => {
      this.progressListeners = this.progressListeners.filter((l) => l !== cb)
    }
  }

  private emitProgress(payload: DownloadProgressPayload): void {
    for (const cb of this.progressListeners) cb(payload)
  }

  resolveWorkerScriptPath(): string {
    const candidates = [
      join(__dirname, 'localInferenceWorker.js'),
      join(__dirname, '../workers/localInferenceWorker.js'),
      join(process.cwd(), 'out/main/localInferenceWorker.js')
    ]
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
    throw new Error('localInferenceWorker.js not found')
  }

  private buildInitPayload(): WorkerInitPayload {
    return {
      modelsCacheDir: getModelsCacheDir(),
      registryPath: resolveRegistryPath(),
      promptsDir: promptRegistry.getPromptsDir(),
      appRoot: getAppInstallDir(),
      configJson: JSON.stringify(configService.load())
    }
  }

  private attachChildHandlers(proc: ChildProcess): void {
    proc.on('message', (msg: WorkerResponse | WorkerEvent) => {
      if (!msg || typeof msg !== 'object') return
      if ('type' in msg && msg.type === 'downloadProgress') {
        this.emitProgress(msg.payload as DownloadProgressPayload)
        return
      }
      const res = msg as WorkerResponse
      const pending = this.pending.get(res.id)
      if (!pending) return
      clearTimeout(pending.timer)
      this.pending.delete(res.id)
      if (res.ok) pending.resolve(res.result)
      else pending.reject(new Error(res.error ?? '推理子进程错误'))
    })

    proc.on('exit', (code, signal) => {
      console.warn(LOG_PREFIX, 'worker exited', { code, signal })
      this.child = null
      this.workerReady = false
      this.initPromise = null
      const err = new Error(`推理子进程已退出 (${code ?? signal ?? 'unknown'})`)
      for (const [, p] of this.pending) {
        clearTimeout(p.timer)
        p.reject(err)
      }
      this.pending.clear()
      if (this.restartAttempts < this.maxRestartAttempts) {
        this.restartAttempts++
        console.log(LOG_PREFIX, 'restarting worker', { attempt: this.restartAttempts })
        void this.start().catch((e) => console.error(LOG_PREFIX, 'restart failed', e))
      }
    })

    proc.on('error', (err) => {
      console.error(LOG_PREFIX, 'worker error', err)
      this.workerReady = false
      this.initPromise = null
    })
  }

  private spawnChild(): ChildProcess {
    const script = this.resolveWorkerScriptPath()
    const proc = fork(script, [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PICTURESEARCH_INFERENCE_WORKER: '1'
      },
      execArgv: []
    })
    this.attachChildHandlers(proc)
    return proc
  }

  private async waitForChildConnected(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (this.child?.connected) return
      await new Promise((r) => setTimeout(r, 50))
    }
    throw new Error('推理子进程 IPC 未就绪')
  }

  /** 直接向子进程发 RPC，不触发 ensureStarted（避免与 doStart 死锁） */
  private sendRequest<T>(
    type: WorkerRequest['type'],
    payload: unknown,
    timeoutMs = DEFAULT_RPC_TIMEOUT_MS
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.child?.connected) {
        reject(new Error('推理子进程未连接'))
        return
      }
      const id = String(this.nextId++)
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`推理子进程超时: ${type}`))
      }, timeoutMs)
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer
      })
      const msg: WorkerRequest = { id, type, payload }
      try {
        const sent = this.child.send(msg)
        if (!sent) {
          clearTimeout(timer)
          this.pending.delete(id)
          reject(new Error('推理子进程消息队列已满'))
        }
      } catch (err) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  private async ensureStarted(): Promise<void> {
    if (this.workerReady && this.child?.connected) return
    if (this.initPromise) return this.initPromise
    this.initPromise = this.doStart()
    try {
      await this.initPromise
    } catch (err) {
      this.initPromise = null
      throw err
    }
  }

  async start(): Promise<void> {
    return this.ensureStarted()
  }

  private async doStart(): Promise<void> {
    if (this.child?.connected) {
      try {
        await this.sendRequest('ping', undefined, 5000)
        await this.sendRequest('init', this.buildInitPayload(), 120_000)
        this.workerReady = true
        return
      } catch (err) {
        console.warn(LOG_PREFIX, 're-init failed, respawn worker', err)
        this.shutdown()
      }
    }

    this.child = this.spawnChild()
    await this.waitForChildConnected(10_000)
    await this.sendRequest('init', this.buildInitPayload(), 120_000)
    this.workerReady = true
    this.restartAttempts = 0
    console.log(LOG_PREFIX, 'worker ready')
  }

  private request<T>(
    type: WorkerRequest['type'],
    payload: unknown,
    timeoutMs = DEFAULT_RPC_TIMEOUT_MS
  ): Promise<T> {
    return this.ensureStarted().then(() => this.sendRequest<T>(type, payload, timeoutMs))
  }

  async ping(): Promise<string> {
    return this.request<string>('ping', undefined, 5000)
  }

  async captionFromPath(filePath: string, modelId: string, prompt: string): Promise<string> {
    const payload: WorkerCaptionFromPathPayload = { filePath, modelId, prompt }
    return this.request<string>('captionFromPath', payload, CAPTION_TIMEOUT_MS)
  }

  async captionFromFrames(modelId: string, frames: Buffer[], prompt: string): Promise<string> {
    const payload: WorkerCaptionFromFramesPayload = {
      modelId,
      prompt,
      frames: frames.map((b) => b.toString('base64'))
    }
    return this.request<string>('captionFromFrames', payload, CAPTION_TIMEOUT_MS)
  }

  async embedText(text: string, modelId: string): Promise<number[]> {
    const payload: WorkerEmbedPayload = { text, modelId }
    return this.request<number[]>('embed', payload, 120_000)
  }

  async download(modelId: string, kind: 'caption' | 'embedding'): Promise<void> {
    const payload: WorkerDownloadPayload = { modelId, kind }
    await this.request('download', payload)
  }

  cancelDownload(): void {
    if (this.child?.connected) {
      void this.sendRequest('cancelDownload', undefined, 5000).catch(() => undefined)
    }
  }

  async isCaptionReady(modelId: string): Promise<boolean> {
    return this.request<boolean>('isCaptionReady', { modelId }, 30_000)
  }

  async isEmbeddingReady(modelId: string): Promise<boolean> {
    return this.request<boolean>('isEmbeddingReady', { modelId }, 30_000)
  }

  evictCaptionBackends(): void {
    if (this.child?.connected) {
      void this.sendRequest('evictCaptionBackends', undefined, 10_000).catch(() => undefined)
    }
  }

  /** 设置保存后向子进程推送最新配置 */
  async refreshConfig(): Promise<void> {
    await this.ensureStarted()
    await this.sendRequest('init', this.buildInitPayload(), 120_000)
  }

  shutdown(): void {
    this.workerReady = false
    if (this.child?.connected) {
      try {
        this.child.send({ id: '0', type: 'shutdown' })
      } catch {
        /* ignore */
      }
    }
    this.child?.kill()
    this.child = null
    this.initPromise = null
    for (const [, p] of this.pending) {
      clearTimeout(p.timer)
      p.reject(new Error('推理子进程已关闭'))
    }
    this.pending.clear()
  }
}

export const localInferenceBridge = new LocalInferenceBridge()
