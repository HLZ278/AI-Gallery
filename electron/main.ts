import { app, BrowserWindow, shell, ipcMain, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { APP_DATA_DIR_NAME, APP_DISPLAY_NAME } from '../shared/appMeta'
import { registerIpcHandlers } from './ipc/handlers'
import { closeDb } from './backend/db/DatabaseManager'
import { lanServerService } from './backend/services/LanServerService'
import { libraryWatcherService } from './backend/services/LibraryWatcherService'
import { configService } from './backend/services/ConfigService'
import { syncReadyMarkersFromCache } from './backend/services/LocalModelReady'
import { localInferenceBridge } from './backend/services/LocalInferenceBridge'
import { localModelService } from './backend/services/LocalModelService'
import { migrateModelsCacheFromLegacy } from './backend/services/ModelsCacheMigration'

let mainWindow: BrowserWindow | null = null

app.setPath('userData', join(app.getPath('appData'), APP_DATA_DIR_NAME))

function resolveAppIconPath(): string | undefined {
  const candidates = app.isPackaged
    ? [join(process.resourcesPath, 'icon.png')]
    : [
        join(process.cwd(), 'build/icon.png'),
        join(__dirname, '../../build/icon.png')
      ]
  return candidates.find((p) => existsSync(p))
}

function loadAppIcon() {
  const iconPath = resolveAppIconPath()
  if (!iconPath) return undefined
  const image = nativeImage.createFromPath(iconPath)
  return image.isEmpty() ? undefined : image
}

function createWindow(): void {
  const icon = loadAppIcon()
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: false,
    frame: false,
    title: APP_DISPLAY_NAME,
    titleBarStyle: 'hidden',
    backgroundColor: '#F5F5F7',
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.yourpicture.app')
  }
  await migrateModelsCacheFromLegacy()
  configService.load()
  localModelService.evictCaptionBackends()
  syncReadyMarkersFromCache()
  void localInferenceBridge.start().catch((err) => console.error('Inference worker start failed:', err))
  registerIpcHandlers()
  lanServerService.applyConfig().catch((err) => console.error('LAN server start failed:', err))
  libraryWatcherService.start().catch((err) => console.error('Library watcher start failed:', err))
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.on('window:close', () => mainWindow?.close())
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  localInferenceBridge.shutdown()
})

app.on('window-all-closed', () => {
  void libraryWatcherService.stop()
  lanServerService.stop()
  localInferenceBridge.shutdown()
  closeDb()
  if (process.platform !== 'darwin') app.quit()
})

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
