import type { AppConfig } from '../../../shared/types'

let workerConfig: AppConfig | null = null
let mainConfigLoader: (() => AppConfig) | null = null

export function setWorkerActiveConfig(config: AppConfig | null): void {
  workerConfig = config
}

/** 主进程启动时注册，避免动态 require 在打包 chunk 中路径失效 */
export function setMainConfigLoader(loader: () => AppConfig): void {
  mainConfigLoader = loader
}

export function getActiveConfig(): AppConfig {
  if (workerConfig) return workerConfig
  if (mainConfigLoader) return mainConfigLoader()
  throw new Error('ActiveConfig: 主进程配置加载器未初始化')
}

export function isWorkerConfigActive(): boolean {
  return workerConfig !== null
}
