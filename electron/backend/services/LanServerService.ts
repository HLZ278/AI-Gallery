import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs'
import { basename, extname, join, normalize, resolve } from 'path'
import { randomBytes } from 'crypto'
import { hostname } from 'os'
import { app, BrowserWindow } from 'electron'
import { getDb } from '../db/DatabaseManager'
import { mapMediaRow, MEDIA_JOIN } from '../domain/MediaMapper'
import { getLocalIPv4Addresses } from '../infra/networkAddresses'
import { buildLanMobilePageHtml } from '../infra/lanMobilePage'
import { buildLanViewPageHtml } from '../infra/lanViewPage'
import { buildLanPageUrl } from '../../../shared/lanUrls'
import { configService } from './ConfigService'
import { libraryService } from './LibraryService'
import { importSingleFile, shouldQueueAnalysis } from './ImportHelper'
import { analysisQueue } from '../domain/AnalysisQueue'
import { APP_DISPLAY_NAME } from '../../../shared/appMeta'
import type { LanServerStatus } from '../../../shared/types'

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.bmp': 'image/bmp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo'
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > maxBytes) {
        reject(new Error('文件过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolveBody(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function safeFilename(name: string): string {
  const decoded = decodeURIComponent(name)
  return basename(decoded).replace(/[^\w.\-()\u4e00-\u9fff\s]/g, '_') || 'upload.bin'
}

function uniqueUploadPath(uploadDir: string, fileName: string): string {
  const stamp = `${Date.now()}-${randomBytes(3).toString('hex')}`
  return join(uploadDir, `lan-${stamp}-${fileName}`)
}

function getToken(req: IncomingMessage, url: URL): string | null {
  return url.searchParams.get('token') || (req.headers['x-lan-token'] as string | undefined) || null
}

export class LanServerService {
  private server: Server | null = null
  private runningPort: number | null = null

  getStatus(): LanServerStatus {
    const config = configService.load()
    const token = this.ensureToken(false)
    const addresses = getLocalIPv4Addresses()
    const port = config.lanServer.port
    const running = this.server !== null
    const urls = running ? addresses.map((ip) => buildLanPageUrl(ip, port, token)) : []
    return {
      enabled: config.lanServer.enabled,
      running,
      port,
      token,
      addresses,
      urls,
      hostname: hostname()
    }
  }

  async applyConfig(): Promise<void> {
    const config = configService.load()
    if (!config.lanServer.enabled) {
      this.stop()
      return
    }
    this.ensureToken(true)
    await this.start(config.lanServer.port)
  }

  async start(port?: number): Promise<void> {
    const config = configService.load()
    const listenPort = port ?? config.lanServer.port
    if (this.server && this.runningPort === listenPort) return

    this.stop()
    await new Promise<void>((resolveStart, reject) => {
      const server = createServer((req, res) => {
        this.handleRequest(req, res).catch((err) => {
          console.error('LAN server error:', err)
          if (!res.headersSent) json(res, 500, { error: err instanceof Error ? err.message : String(err) })
        })
      })
      server.on('error', reject)
      server.listen(listenPort, '0.0.0.0', () => {
        this.server = server
        this.runningPort = listenPort
        console.log(`LAN server listening on 0.0.0.0:${listenPort}`)
        resolveStart()
      })
    })
  }

  stop(): void {
    if (!this.server) return
    this.server.close()
    this.server = null
    this.runningPort = null
  }

  regenerateToken(): string {
    const config = configService.load()
    const token = randomBytes(4).toString('hex')
    configService.save({ ...config, lanServer: { ...config.lanServer, token } })
    return token
  }

  private ensureToken(persistIfEmpty: boolean): string {
    const config = configService.load()
    if (config.lanServer.token) return config.lanServer.token
    const token = randomBytes(4).toString('hex')
    if (persistIfEmpty) {
      configService.save({ ...config, lanServer: { ...config.lanServer, token } })
    }
    return token
  }

  private isAuthorized(req: IncomingMessage, url: URL): boolean {
    const expected = this.ensureToken(false)
    const provided = getToken(req, url)
    return !!provided && provided === expected
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const pathname = url.pathname

    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(buildLanMobilePageHtml())
      return
    }

    const viewMatch = pathname.match(/^\/view\/([^/]+)$/)
    if (req.method === 'GET' && viewMatch) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(buildLanViewPageHtml())
      return
    }

    const metaMatch = pathname.match(/^\/api\/media\/([^/]+)\/meta$/)
    if (req.method === 'GET' && metaMatch) {
      if (!this.isAuthorized(req, url)) {
        json(res, 401, { error: '未授权' })
        return
      }
      this.serveMediaMeta(res, metaMatch[1])
      return
    }

    if (req.method === 'GET' && pathname === '/api/status') {
      if (!this.isAuthorized(req, url)) {
        json(res, 401, { error: '未授权' })
        return
      }
      const config = configService.load()
      json(res, 200, {
        appName: APP_DISPLAY_NAME,
        hostname: hostname(),
        pageSize: config.lanServer.pageSize,
        downloadIntervalMs: config.lanServer.downloadIntervalMs,
        libraries: libraryService.list()
      })
      return
    }

    if (req.method === 'GET' && pathname === '/api/media') {
      if (!this.isAuthorized(req, url)) {
        json(res, 401, { error: '未授权' })
        return
      }
      const libraryId = url.searchParams.get('libraryId')
      if (!libraryId) {
        json(res, 400, { error: '缺少 libraryId' })
        return
      }
      const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
      const config = configService.load()
      const pageSize = Math.min(120, Math.max(1, Number(url.searchParams.get('pageSize') ?? config.lanServer.pageSize)))
      const offset = (page - 1) * pageSize

      const db = getDb()
      const totalRow = db.prepare('SELECT COUNT(*) as cnt FROM media_items WHERE library_id = ?').get(libraryId) as {
        cnt: number
      }
      const rows = db
        .prepare(
          `
      SELECT m.*, l.name as library_name, md.duration_ms, md.frame_count FROM media_items m
      ${MEDIA_JOIN}
      WHERE m.library_id = ?
      ORDER BY m.taken_at DESC, m.imported_at DESC
      LIMIT ? OFFSET ?
    `
        )
        .all(libraryId, pageSize, offset) as Array<Record<string, unknown>>

      const items = rows.map(mapMediaRow).map((item) => ({
        id: item.id,
        fileName: basename(item.filePath),
        mediaType: item.mediaType,
        width: item.width,
        height: item.height,
        fileSize: item.fileSize
      }))
      json(res, 200, { items, total: totalRow.cnt, page, pageSize })
      return
    }

    const thumbMatch = pathname.match(/^\/api\/media\/([^/]+)\/thumb$/)
    if (req.method === 'GET' && thumbMatch) {
      if (!this.isAuthorized(req, url)) {
        json(res, 401, { error: '未授权' })
        return
      }
      await this.serveMediaFile(res, thumbMatch[1], 'thumb')
      return
    }

    const fileMatch = pathname.match(/^\/api\/media\/([^/]+)\/file$/)
    if (req.method === 'GET' && fileMatch) {
      if (!this.isAuthorized(req, url)) {
        json(res, 401, { error: '未授权' })
        return
      }
      await this.serveMediaFile(res, fileMatch[1], 'file', url.searchParams.get('inline') === '1')
      return
    }

    if (req.method === 'POST' && pathname === '/api/upload') {
      if (!this.isAuthorized(req, url)) {
        json(res, 401, { error: '未授权' })
        return
      }
      await this.handleUpload(req, res)
      return
    }

    json(res, 404, { error: 'Not found' })
  }

  private serveMediaMeta(res: ServerResponse, mediaId: string): void {
    const row = getDb()
      .prepare(
        `
      SELECT m.id, m.file_path, m.media_type, m.width, m.height, m.file_size
      FROM media_items m WHERE m.id = ?
    `
      )
      .get(mediaId) as Record<string, unknown> | undefined

    if (!row) {
      json(res, 404, { error: '媒体不存在' })
      return
    }

    json(res, 200, {
      id: row.id,
      fileName: basename(row.file_path as string),
      mediaType: row.media_type,
      width: row.width,
      height: row.height,
      fileSize: row.file_size
    })
  }

  private async serveMediaFile(
    res: ServerResponse,
    mediaId: string,
    kind: 'thumb' | 'file',
    inline = false
  ): Promise<void> {
    const row = getDb()
      .prepare(
        `
      SELECT m.*, l.root_path as library_root FROM media_items m
      JOIN libraries l ON l.id = m.library_id
      WHERE m.id = ?
    `
      )
      .get(mediaId) as Record<string, unknown> | undefined

    if (!row) {
      json(res, 404, { error: '媒体不存在' })
      return
    }

    const filePath = kind === 'thumb' && row.thumb_path ? (row.thumb_path as string) : (row.file_path as string)
    if (!this.isPathAllowed(filePath, row.library_root as string)) {
      json(res, 403, { error: '路径不允许' })
      return
    }
    if (!existsSync(filePath)) {
      json(res, 404, { error: '文件不存在' })
      return
    }

    const ext = extname(filePath).toLowerCase()
    const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream'
    const fileName = basename(row.file_path as string)
    const headers: Record<string, string> = { 'Content-Type': mime }
    if (kind === 'file') {
      if (inline) {
        headers['Content-Disposition'] = `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`
      } else {
        headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
      }
    }
    res.writeHead(200, headers)
    createReadStream(filePath).pipe(res)
  }

  private isPathAllowed(filePath: string, libraryRoot: string): boolean {
    const resolved = normalize(resolve(filePath))
    const root = normalize(resolve(libraryRoot))
    if (resolved.startsWith(root)) return true
    const userData = normalize(resolve(app.getPath('userData')))
    return resolved.startsWith(userData)
  }

  private async handleUpload(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const config = configService.load()
    const libraryId = req.headers['x-library-id'] as string | undefined
    const rawName = req.headers['x-filename'] as string | undefined
    if (!libraryId || !rawName) {
      json(res, 400, { error: '缺少 X-Library-Id 或 X-Filename' })
      return
    }

    const library = libraryService.get(libraryId)
    if (!library) {
      json(res, 404, { error: '图库不存在' })
      return
    }

    const fileName = safeFilename(rawName)
    const ext = extname(fileName).toLowerCase()
    if (!config.lanServer.allowedExtensions.includes(ext)) {
      json(res, 400, { error: `不支持的文件类型 ${ext}` })
      return
    }

    let body: Buffer
    try {
      body = await readBody(req, config.lanServer.maxUploadBytes)
    } catch (err) {
      json(res, 413, { error: err instanceof Error ? err.message : '上传过大' })
      return
    }

    if (body.length === 0) {
      json(res, 400, { error: '空文件' })
      return
    }

    const uploadDir = join(library.rootPath, config.lanServer.uploadSubfolder)
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true })

    const targetPath = uniqueUploadPath(uploadDir, fileName)
    writeFileSync(targetPath, body)

    const result = await importSingleFile(libraryId, targetPath)
    if (shouldQueueAnalysis(result)) await analysisQueue.start()

    this.notifyUploadComplete({ libraryId, fileName, imported: result.action !== 'skipped' })

    json(res, 200, { ok: true, imported: result.action !== 'skipped', path: targetPath })
  }

  private notifyUploadComplete(payload: { libraryId: string; fileName: string; imported: boolean }): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('lanServer:uploadComplete', payload)
    }
  }
}

export const lanServerService = new LanServerService()
