import { app } from 'electron'
import { dirname, join } from 'path'

/** 应用安装/运行根目录：打包后为 exe 所在目录，开发态为项目 cwd */
export function getAppInstallDir(): string {
  if (app.isPackaged) {
    return dirname(app.getPath('exe'))
  }
  return process.cwd()
}

/** 旧版模型缓存（%APPDATA%/YourPicture/models） */
export function getLegacyModelsCacheDir(): string {
  return join(app.getPath('userData'), 'models')
}

/** 模型下载与缓存目录（安装目录旁 models/） */
export function getModelsCacheDir(): string {
  return join(getAppInstallDir(), 'models')
}
