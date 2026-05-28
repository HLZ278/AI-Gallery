import type { AppConfig } from '../../../shared/types'

let workerConfig: AppConfig | null = null

export function setWorkerActiveConfig(config: AppConfig | null): void {
  workerConfig = config
}

export function getActiveConfig(): AppConfig {
  if (workerConfig) return workerConfig
  // 避免推理子进程静态加载 ConfigService（依赖 electron.app）
  const { configService } = require('../services/ConfigService') as typeof import('../services/ConfigService')
  return configService.load()
}

export function isWorkerConfigActive(): boolean {
  return workerConfig !== null
}
