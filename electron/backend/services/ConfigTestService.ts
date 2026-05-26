import OpenAI from 'openai'
import { configService } from './ConfigService'

export async function testLlmConnection(): Promise<{ ok: boolean; message: string }> {
  const config = configService.load()
  if (!config.llm.apiKey.trim()) {
    return { ok: false, message: '请先填写 API Key' }
  }

  const client = new OpenAI({
    apiKey: config.llm.apiKey,
    baseURL: config.llm.baseUrl,
    timeout: Math.min(config.llm.timeoutMs, 30000)
  })

  try {
    const response = await client.chat.completions.create({
      model: config.llm.model,
      messages: [{ role: 'user', content: '回复 OK' }],
      max_tokens: 8
    })
    const text = response.choices[0]?.message?.content?.trim()
    return { ok: true, message: text ? `连接成功：${text}` : '连接成功' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `连接失败：${message}` }
  }
}
