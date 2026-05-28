import { existsSync, readdirSync } from 'fs'
import { cp, rename, rm } from 'fs/promises'
import { getLegacyModelsCacheDir, getModelsCacheDir } from '../infra/AppPaths'

const LOG_PREFIX = '[ModelsCache]'

function dirHasEntries(dir: string): boolean {
  if (!existsSync(dir)) return false
  try {
    return readdirSync(dir).length > 0
  } catch {
    return false
  }
}

/** 将旧 userData/models 迁移到安装目录 models（仅当目标为空时） */
export async function migrateModelsCacheFromLegacy(): Promise<void> {
  const legacy = getLegacyModelsCacheDir()
  const target = getModelsCacheDir()
  if (legacy === target) return
  if (!dirHasEntries(legacy)) return
  if (dirHasEntries(target)) {
    console.log(LOG_PREFIX, 'skip migration: target already has files', { target })
    return
  }

  console.log(LOG_PREFIX, 'migrating models cache', { from: legacy, to: target })
  try {
    await rename(legacy, target)
    console.log(LOG_PREFIX, 'migration done (rename)')
    return
  } catch (err) {
    console.warn(LOG_PREFIX, 'rename failed, try copy', err)
  }

  try {
    await cp(legacy, target, { recursive: true })
    await rm(legacy, { recursive: true, force: true })
    console.log(LOG_PREFIX, 'migration done (copy)')
  } catch (err) {
    console.error(LOG_PREFIX, 'migration failed', err)
  }
}
