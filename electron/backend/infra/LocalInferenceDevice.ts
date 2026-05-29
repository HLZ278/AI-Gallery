import { platform } from 'process'
import type { InferenceDevicePreference } from '../../../shared/types'

const LOG_PREFIX = '[LocalInference]'

/** 应用内解析后的推理设备（Node 环境会映射为 ONNX 的 cpu / cuda / dml） */
export type ResolvedInferenceDevice = 'cpu' | 'cuda' | 'dml'

/**
 * 传给 @huggingface/transformers 的 device。
 * Node/Electron 仅支持 cpu、cuda、dml，不支持 wasm。
 */
export function toTransformersOnnxDevice(device: ResolvedInferenceDevice): 'cpu' | 'cuda' | 'dml' {
  return device
}

/** 解析用户配置；auto 在 Windows 优先 DirectML（AMD/Intel 独显/核显），失败时由加载逻辑回退 CPU */
export function resolveInferenceDevicePreference(
  preference: InferenceDevicePreference | undefined
): ResolvedInferenceDevice {
  switch (preference) {
    case 'cuda':
      return 'cuda'
    case 'dml':
      return 'dml'
    case 'auto':
      if (platform === 'win32') return 'dml'
      if (platform === 'linux') return 'cuda'
      return 'cpu'
    case 'wasm':
    default:
      return 'cpu'
  }
}

export function inferenceDeviceFallbackOrder(primary: ResolvedInferenceDevice): ResolvedInferenceDevice[] {
  switch (primary) {
    case 'dml':
      return ['dml', 'cpu']
    case 'cuda':
      return ['cuda', 'cpu']
    default:
      return ['cpu']
  }
}

export function logInferenceDevice(message: string, extra?: unknown): void {
  if (extra !== undefined) console.log(LOG_PREFIX, message, extra)
  else console.log(LOG_PREFIX, message)
}

/** DirectML 在 Qwen VL 加载/推理阶段常见的错误 */
export function isDmlRuntimeInferenceError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes('DmlExecutionProvider') ||
    msg.includes('DirectML') ||
    msg.includes('MultiHeadAttention') ||
    msg.includes('80070057') ||
    msg.includes("Can't append execution provider: dml") ||
    msg.includes('Unsupported device')
  )
}
