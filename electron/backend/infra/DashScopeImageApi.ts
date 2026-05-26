import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { configService } from '../services/ConfigService'

export interface DashScopeImageOutput {
  tempFilePath: string
  width: number
  height: number
  requestId?: string
}

interface DashScopeImageResponse {
  output?: {
    choices?: Array<{
      message?: {
        content?: Array<{ image?: string }>
      }
    }>
  }
  usage?: {
    width?: number
    height?: number
  }
  request_id?: string
  code?: string
  message?: string
}

export interface DashScopeImageCallOptions {
  model: string
  endpoint: string
  timeoutMs: number
  content: Array<{ text: string } | { image: string }>
  parameters: Record<string, unknown>
  tempBasename: string
  tempSubdir: string
  errorPrefix: string
}

function getTempDir(subdir: string): string {
  const dir = join(app.getPath('userData'), subdir)
  mkdirSync(dir, { recursive: true })
  return dir
}

function extractImageUrl(payload: DashScopeImageResponse): string {
  const content = payload.output?.choices?.[0]?.message?.content
  if (!Array.isArray(content)) {
    throw new Error(payload.message ?? '响应缺少图片内容')
  }
  for (const part of content) {
    if (part.image) return part.image
  }
  throw new Error(payload.message ?? '响应中未找到图片 URL')
}

export async function callDashScopeImageApi(options: DashScopeImageCallOptions): Promise<DashScopeImageOutput> {
  const apiKey = configService.load().llm.apiKey?.trim()
  if (!apiKey) throw new Error('请先在设置中配置 API Key')

  const response = await fetch(options.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: options.model,
      input: {
        messages: [
          {
            role: 'user',
            content: options.content
          }
        ]
      },
      parameters: options.parameters
    }),
    signal: AbortSignal.timeout(options.timeoutMs)
  })

  const payload = (await response.json()) as DashScopeImageResponse
  if (!response.ok || payload.code) {
    throw new Error(payload.message ?? `${options.errorPrefix} (${response.status})`)
  }

  const imageUrl = extractImageUrl(payload)
  const imageRes = await fetch(imageUrl, { signal: AbortSignal.timeout(options.timeoutMs) })
  if (!imageRes.ok) throw new Error(`下载生成图片失败 (${imageRes.status})`)

  const buffer = Buffer.from(await imageRes.arrayBuffer())
  const tempFilePath = join(getTempDir(options.tempSubdir), `${options.tempBasename}.png`)
  writeFileSync(tempFilePath, buffer)

  return {
    tempFilePath,
    width: payload.usage?.width ?? 0,
    height: payload.usage?.height ?? 0,
    requestId: payload.request_id
  }
}
