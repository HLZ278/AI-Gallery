import { readFileSync } from 'fs'
import { loadOllamaRuntimeConfig } from '../OllamaRuntimeConfig'

export interface OllamaChatResult {
  content: string
  ms: number
}

export async function ollamaChat(params: {
  model: string
  prompt: string
  imagePath?: string
  imageBuffer?: Buffer
  numPredict?: number
}): Promise<OllamaChatResult> {
  const cfg = loadOllamaRuntimeConfig()
  let b64: string
  if (params.imageBuffer) {
    b64 = params.imageBuffer.toString('base64')
  } else if (params.imagePath) {
    b64 = readFileSync(params.imagePath).toString('base64')
  } else {
    throw new Error('Ollama 视觉请求缺少图片')
  }

  const numPredict = params.numPredict ?? cfg.chatRequest?.defaultNumPredict
  const body: Record<string, unknown> = {
    model: params.model,
    messages: [{ role: 'user', content: params.prompt, images: [b64] }],
    stream: false
  }
  if (cfg.chatRequest?.think === false) {
    body.think = false
  }
  if (typeof numPredict === 'number' && numPredict > 0) {
    body.options = { num_predict: numPredict }
  }

  const t0 = Date.now()
  console.log(`[Ollama] 开始分析 model=${params.model} promptLen=${params.prompt.length} imageB64=${Math.round(b64.length / 1024)}KB`)

  const res = await fetch(`${cfg.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(cfg.timeoutMs)
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama HTTP ${res.status}: ${text}`)
  }

  const data = (await res.json()) as { message?: { content?: string; thinking?: string } }
  const ms = Date.now() - t0
  let content = data.message?.content?.trim() ?? ''

  if (!content && data.message?.thinking?.trim()) {
    throw new Error(
      'Ollama 返回内容为空（模型可能处于 Thinking 模式）。请在设置中选择带 Instruct 后缀的视觉模型并重新下载。'
    )
  }

  console.log(`[Ollama] 分析完成 model=${params.model} ms=${ms} contentLen=${content.length}`)
  return { content, ms }
}
