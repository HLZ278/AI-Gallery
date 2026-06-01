import { existsSync } from 'fs'
import { dirname, join } from 'path'

function useElectronApp(): typeof import('electron').app | null {
  try {
    const { app } = require('electron') as typeof import('electron')
    return app?.getPath ? app : null
  } catch {
    return null
  }
}

/** 读取打包进应用的 config/*.json（开发态与 app.asar/config/） */
export function resolveBundledConfigPath(filename: string): string {
  const fromEnv = process.env.PICTURESEARCH_APP_ROOT?.trim()
  const app = useElectronApp()
  const paths = [
    ...(fromEnv ? [join(fromEnv, 'config', filename)] : []),
    ...(app?.getAppPath ? [join(app.getAppPath(), 'config', filename)] : []),
    join(__dirname, '../../config', filename),
    join(process.cwd(), 'config', filename)
  ]
  for (const p of paths) {
    if (existsSync(p)) return p
  }
  throw new Error(`Config file not found: ${filename}`)
}

/** 应用安装/运行根目录：打包后为 exe 所在目录，开发态为项目 cwd */
export function getAppInstallDir(): string {
  const fromEnv = process.env.PICTURESEARCH_APP_ROOT?.trim()
  if (fromEnv) return fromEnv
  const app = useElectronApp()
  if (app?.isPackaged) {
    return dirname(app.getPath('exe'))
  }
  return process.cwd()
}

/** 旧版模型缓存（%APPDATA%/AiPicture/models，迁移前为 YourPicture/models） */
export function getLegacyModelsCacheDir(): string {
  const app = useElectronApp()
  if (!app) return join(getAppInstallDir(), 'models')
  return join(app.getPath('userData'), 'models')
}

/** 模型下载与缓存目录（安装目录旁 models/，ONNX） */
export function getModelsCacheDir(): string {
  const fromEnv = process.env.PICTURESEARCH_MODELS_DIR?.trim()
  if (fromEnv) return fromEnv
  return join(getAppInstallDir(), 'models')
}

/** Ollama 模型目录（与 ONNX models/ 分离，避免污染） */
export function getOllamaModelsDir(): string {
  const fromEnv = process.env.OLLAMA_MODELS?.trim()
  if (fromEnv) return fromEnv
  return join(getAppInstallDir(), 'ollama-models')
}
