import { dirname, join } from 'path'

function useElectronApp(): typeof import('electron').app | null {
  try {
    const { app } = require('electron') as typeof import('electron')
    return app?.getPath ? app : null
  } catch {
    return null
  }
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

/** 旧版模型缓存（%APPDATA%/YourPicture/models） */
export function getLegacyModelsCacheDir(): string {
  const app = useElectronApp()
  if (!app) return join(getAppInstallDir(), 'models')
  return join(app.getPath('userData'), 'models')
}

/** 模型下载与缓存目录（安装目录旁 models/） */
export function getModelsCacheDir(): string {
  const fromEnv = process.env.PICTURESEARCH_MODELS_DIR?.trim()
  if (fromEnv) return fromEnv
  return join(getAppInstallDir(), 'models')
}
