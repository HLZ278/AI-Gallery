import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { platform } from 'process'
import type { InferenceDevicePreference } from '../../../shared/types'

const LOG_PREFIX = '[LocalInference]'

/** 应用内解析后的推理设备（Node 环境映射为 ONNX 的 cpu / cuda） */
export type ResolvedInferenceDevice = 'cpu' | 'cuda'

interface InferenceDeviceMeta {
  labels: Record<ResolvedInferenceDevice, string>
  preferenceLabels?: Record<InferenceDevicePreference, string>
  platformOptions?: Record<string, InferenceDevicePreference[]>
  hints: Record<string, string>
}

let deviceMeta: InferenceDeviceMeta | null = null

function resolveConfigPath(filename: string): string {
  const paths = [
    join(process.env.PICTURESEARCH_APP_ROOT ?? process.cwd(), 'config', filename),
    join(__dirname, '../../../config', filename),
    join(process.cwd(), 'config', filename)
  ]
  for (const p of paths) {
    if (existsSync(p)) return p
  }
  throw new Error(`Config file not found: ${filename}`)
}

function loadDeviceMeta(): InferenceDeviceMeta {
  if (deviceMeta) return deviceMeta
  const raw = JSON.parse(readFileSync(resolveConfigPath('inference-devices.json'), 'utf-8')) as InferenceDeviceMeta
  deviceMeta = raw
  return raw
}

/** 传给 @huggingface/transformers 的 device（wasm 配置项映射为 cpu） */
export function toTransformersOnnxDevice(device: ResolvedInferenceDevice): 'cpu' | 'cuda' {
  return device
}

export function resolveInferenceDevicePreference(
  preference: InferenceDevicePreference | undefined
): ResolvedInferenceDevice {
  return preference === 'cuda' ? 'cuda' : 'cpu'
}

/** AMD 视觉分析走 Ollama，不走 ONNX 推理子进程 */
export function usesOllamaCaption(preference: InferenceDevicePreference | undefined): boolean {
  return preference === 'amd'
}

export function inferenceDevicePreferenceLabel(preference: InferenceDevicePreference | undefined): string {
  const meta = loadDeviceMeta()
  const key = preference ?? 'wasm'
  return meta.preferenceLabels?.[key] ?? meta.labels[resolveInferenceDevicePreference(preference)] ?? key
}

export function listAvailableInferenceDevices(osPlatform: string = platform): InferenceDevicePreference[] {
  const meta = loadDeviceMeta()
  return meta.platformOptions?.[osPlatform] ?? ['wasm', 'cuda', 'amd']
}

export function isInferenceDeviceAvailable(
  preference: InferenceDevicePreference,
  osPlatform: string = platform
): boolean {
  return listAvailableInferenceDevices(osPlatform).includes(preference)
}

/** 按用户配置决定尝试的设备（无静默回退） */
export function inferenceDeviceCandidates(
  preference: InferenceDevicePreference | undefined
): ResolvedInferenceDevice[] {
  return [resolveInferenceDevicePreference(preference)]
}

export function inferenceDeviceLabel(device: ResolvedInferenceDevice): string {
  const meta = loadDeviceMeta()
  return meta.labels[device] ?? device
}

function hintForLoadFailure(
  preference: InferenceDevicePreference | undefined,
  device: ResolvedInferenceDevice
): string | undefined {
  const meta = loadDeviceMeta()
  if (device === 'cuda' && platform === 'win32') {
    return meta.hints.cuda_unsupported_platform
  }
  if (device === 'cuda') {
    return meta.hints.cuda_load_failed
  }
  if (preference === 'cuda') {
    return meta.hints.explicit_no_fallback
  }
  return undefined
}

export function buildInferenceDeviceLoadError(
  preference: InferenceDevicePreference | undefined,
  device: ResolvedInferenceDevice,
  cause: unknown
): Error {
  const causeMsg = cause instanceof Error ? cause.message : String(cause)
  const label = inferenceDeviceLabel(device)
  const hint = hintForLoadFailure(preference, device)
  const parts = [`本地推理设备「${label}」加载失败：${causeMsg}`]
  if (hint) parts.push(hint)
  return new Error(parts.join('\n'))
}

export function buildInferenceDeviceRuntimeError(
  preference: InferenceDevicePreference | undefined,
  device: ResolvedInferenceDevice,
  cause: unknown
): Error {
  const causeMsg = cause instanceof Error ? cause.message : String(cause)
  const label = inferenceDeviceLabel(device)
  const hint = hintForLoadFailure(preference, device)
  const parts = [`本地推理设备「${label}」运行失败：${causeMsg}`]
  if (hint) parts.push(hint)
  return new Error(parts.join('\n'))
}

export function logInferenceDevice(message: string, extra?: unknown): void {
  if (extra !== undefined) console.log(LOG_PREFIX, message, extra)
  else console.log(LOG_PREFIX, message)
}

/** CUDA 执行提供程序在加载/推理阶段常见的错误 */
export function isGpuRuntimeInferenceError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes('CudaExecutionProvider') ||
    msg.includes('CUDA') ||
    msg.includes("Can't append execution provider: cuda") ||
    msg.includes('Unsupported device')
  )
}
