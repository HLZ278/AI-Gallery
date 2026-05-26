import { clipboard, nativeImage } from 'electron'
import { execFileSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'
import type { MediaType } from '../../../shared/types'

const IMAGE_TYPES: MediaType[] = ['photo', 'gif', 'live_photo', 'panorama', 'burst']

export function isImageMediaType(mediaType: MediaType): boolean {
  return IMAGE_TYPES.includes(mediaType)
}

function buildWindowsDropFilesBuffer(filePaths: string[]): Buffer {
  const DROPFILES_SIZE = 20
  const header = Buffer.alloc(DROPFILES_SIZE)
  header.writeUInt32LE(DROPFILES_SIZE, 0)
  header.writeInt32LE(0, 4)
  header.writeInt32LE(0, 8)
  header.writeUInt32LE(0, 12)
  header.writeUInt32LE(1, 16)

  const normalized = filePaths.map((p) => resolve(p))
  const listBody = normalized.map((p) => `${p}\0`).join('')
  const listBuffer = Buffer.from(`${listBody}\0`, 'utf16le')

  return Buffer.concat([header, listBuffer])
}

function writeWindowsClipboardWithImage(filePath: string, image: Electron.NativeImage) {
  clipboard.write({ image, text: '' })
  clipboard.writeBuffer('CF_HDROP', buildWindowsDropFilesBuffer([filePath]))
}

function copySingleImageForExternalPaste(filePath: string): void {
  const image = nativeImage.createFromPath(filePath)
  if (image.isEmpty()) {
    copyFilesToClipboard([filePath])
    return
  }

  if (process.platform === 'win32') {
    writeWindowsClipboardWithImage(filePath, image)
    return
  }

  if (process.platform === 'darwin') {
    clipboard.write({ image })
    const escaped = filePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    execFileSync('osascript', ['-e', `set the clipboard to (POSIX file "${escaped}")`])
    return
  }

  clipboard.write({ image })
}

export function copyFilesToClipboard(filePaths: string[]): void {
  const existing = filePaths.filter((p) => existsSync(p))
  if (existing.length === 0) throw new Error('文件不存在，无法复制')

  if (process.platform === 'win32') {
    clipboard.writeBuffer('CF_HDROP', buildWindowsDropFilesBuffer(existing))
    return
  }

  if (process.platform === 'darwin') {
    if (existing.length === 1) {
      const escaped = existing[0].replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      execFileSync('osascript', ['-e', `set the clipboard to (POSIX file "${escaped}")`])
      return
    }
    const script = existing
      .map((p) => `POSIX file "${p.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
      .join(', ')
    execFileSync('osascript', ['-e', `set the clipboard to {${script}}`])
    return
  }

  clipboard.write({ text: existing.join('\n') })
}

export interface ClipboardMediaItem {
  filePath: string
  mediaType: MediaType
}

export function copyMediaItemsToClipboard(items: ClipboardMediaItem[]): void {
  const existing = items.filter((i) => existsSync(i.filePath))
  if (existing.length === 0) throw new Error('文件不存在，无法复制')

  if (existing.length === 1 && isImageMediaType(existing[0].mediaType)) {
    copySingleImageForExternalPaste(existing[0].filePath)
    return
  }

  copyFilesToClipboard(existing.map((i) => i.filePath))
}
