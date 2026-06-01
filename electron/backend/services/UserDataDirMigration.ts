import { cpSync, existsSync, renameSync, rmSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { APP_DATA_DIR_NAME, LEGACY_APP_DATA_DIR_NAME } from '../../../shared/appMeta'

const LOG_PREFIX = '[UserData]'

/** 将 %APPDATA%/YourPicture 迁移至 AiPicture（仅当新目录不存在时） */
export function migrateUserDataDirFromLegacy(): void {
  const appData = app.getPath('appData')
  const target = join(appData, APP_DATA_DIR_NAME)
  const legacy = join(appData, LEGACY_APP_DATA_DIR_NAME)
  if (existsSync(target) || !existsSync(legacy)) return

  console.log(LOG_PREFIX, 'migrating user data', { from: legacy, to: target })
  try {
    renameSync(legacy, target)
    console.log(LOG_PREFIX, 'migration done (rename)')
    return
  } catch (err) {
    console.warn(LOG_PREFIX, 'rename failed, try copy', err)
  }

  try {
    cpSync(legacy, target, { recursive: true })
    rmSync(legacy, { recursive: true, force: true })
    console.log(LOG_PREFIX, 'migration done (copy)')
  } catch (err) {
    console.error(LOG_PREFIX, 'migration failed', err)
  }
}
