import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { ImageEditSession } from '../../../shared/types'

const SESSION_FILENAME = 'imageEditSession.json'

function getSessionPath(): string {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return join(dir, SESSION_FILENAME)
}

const WELCOME: ImageEditSession['messages'][number] = {
  id: 'welcome',
  role: 'assistant',
  content:
    '从图库选择 1~3 张图片（JPG/PNG/WEBP/GIF 等，单张 ≤10MB），输入编辑指令。生成后可选择「入库」「覆盖原图」或「拒绝」。多图时按顺序传入，输出比例以最后一张为准。'
}

export class ImageEditSessionService {
  load(): ImageEditSession {
    const path = getSessionPath()
    if (!existsSync(path)) {
      return { libraryId: '', size: '', sourceMediaIds: [], messages: [WELCOME] }
    }
    try {
      const raw = JSON.parse(readFileSync(path, 'utf-8')) as ImageEditSession
      return {
        libraryId: raw.libraryId ?? '',
        size: raw.size ?? '',
        sourceMediaIds: Array.isArray(raw.sourceMediaIds) ? raw.sourceMediaIds : [],
        messages: Array.isArray(raw.messages) && raw.messages.length > 0 ? raw.messages : [WELCOME]
      }
    } catch {
      return { libraryId: '', size: '', sourceMediaIds: [], messages: [WELCOME] }
    }
  }

  save(session: ImageEditSession): void {
    writeFileSync(getSessionPath(), JSON.stringify(session, null, 2), 'utf-8')
  }
}

export const imageEditSessionService = new ImageEditSessionService()
