import type {
  WorkerCaptionFromFramesPayload,
  WorkerCaptionFromPathPayload,
  WorkerDownloadPayload,
  WorkerEmbedPayload,
  WorkerInitPayload,
  WorkerRequest,
  WorkerResponse
} from './LocalInferenceProtocol'
import { LocalInferenceWorkerRuntime } from './LocalInferenceWorkerRuntime'

const runtime = new LocalInferenceWorkerRuntime()

runtime.setProgressHandler((modelId, progress) => {
  if (process.send) {
    process.send({ type: 'downloadProgress', payload: { modelId, progress } })
  }
})

async function handleRequest(req: WorkerRequest): Promise<WorkerResponse> {
  try {
    let result: unknown
    switch (req.type) {
      case 'init':
        await runtime.init(req.payload as WorkerInitPayload)
        result = { ok: true }
        break
      case 'ping':
        result = 'pong'
        break
      case 'captionFromPath':
        result = await runtime.captionFromPath(req.payload as WorkerCaptionFromPathPayload)
        break
      case 'captionFromFrames':
        result = await runtime.captionFromFrames(req.payload as WorkerCaptionFromFramesPayload)
        break
      case 'embed':
        result = await runtime.embed(req.payload as WorkerEmbedPayload)
        break
      case 'download':
        await runtime.download(req.payload as WorkerDownloadPayload)
        result = true
        break
      case 'cancelDownload':
        runtime.cancelDownload()
        result = true
        break
      case 'isCaptionReady': {
        const { modelId } = req.payload as { modelId: string }
        result = await runtime.isCaptionReady(modelId)
        break
      }
      case 'isEmbeddingReady': {
        const { modelId } = req.payload as { modelId: string }
        result = await runtime.isEmbeddingReady(modelId)
        break
      }
      case 'evictCaptionBackends':
        runtime.evictCaptionBackends()
        result = true
        break
      case 'shutdown':
        runtime.shutdown()
        result = true
        setTimeout(() => process.exit(0), 50)
        break
      default:
        throw new Error(`未知 worker 请求: ${req.type}`)
    }
    return { id: req.id, ok: true, result }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[InferenceWorker]', req.type, message)
    return { id: req.id, ok: false, error: message }
  }
}

process.on('message', (msg: WorkerRequest | { type: string }) => {
  if (!msg || typeof msg !== 'object') return
  if ('type' in msg && msg.type === 'downloadProgress') return
  const req = msg as WorkerRequest
  if (!req.id || !req.type) return
  void handleRequest(req).then((res) => {
    if (process.send) process.send(res)
  })
})

process.on('uncaughtException', (err) => {
  console.error('[InferenceWorker] uncaughtException', err)
})

process.on('unhandledRejection', (err) => {
  console.error('[InferenceWorker] unhandledRejection', err)
})
