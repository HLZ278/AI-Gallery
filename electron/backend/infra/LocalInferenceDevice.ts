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

/** 解析用户配置；默认 cpu。Windows 下 dml 对 Qwen VL generate 不稳定，统一走 cpu */
export function resolveInferenceDevicePreference(
  preference: InferenceDevicePreference | undefined
): ResolvedInferenceDevice {
  if (preference === 'cuda') return 'cuda'
  if (preference === 'dml') {
    logInferenceDevice('inferenceDevice=dml 已映射为 cpu（Qwen VL 在 DirectML 上易失败）')
    return 'cpu'
  }
  return 'cpu'
}

export function inferenceDeviceFallbackOrder(primary: ResolvedInferenceDevice): ResolvedInferenceDevice[] {
  const all: ResolvedInferenceDevice[] = ['cpu', 'cuda', 'dml']
  const rest = all.filter((d) => d !== primary)
  return [primary, ...rest]
}

export function logInferenceDevice(message: string, extra?: unknown): void {
  if (extra !== undefined) console.log(LOG_PREFIX, message, extra)
  else console.log(LOG_PREFIX, message)
}

/** DirectML 在 Qwen VL generate 阶段常见的无效参数错误 */
export function isDmlRuntimeInferenceError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes('DmlExecutionProvider') ||
    msg.includes('MultiHeadAttention') ||
    msg.includes('80070057')
  )
}
