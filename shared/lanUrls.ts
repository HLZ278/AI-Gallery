/** 构建局域网手机端首页 URL */
export function buildLanPageUrl(host: string, port: number, token: string): string {
  return `http://${host}:${port}/?token=${encodeURIComponent(token)}`
}

/** 构建局域网媒体预览页 URL（扫码打开预览页，含下载按钮） */
export function buildLanMediaViewUrl(host: string, port: number, token: string, mediaId: string): string {
  return `http://${host}:${port}/view/${encodeURIComponent(mediaId)}?token=${encodeURIComponent(token)}`
}

/** @deprecated 直接文件 URL，仅用于预览页内下载按钮 */
export function buildLanMediaDownloadUrl(host: string, port: number, token: string, mediaId: string): string {
  return `http://${host}:${port}/api/media/${encodeURIComponent(mediaId)}/file?token=${encodeURIComponent(token)}`
}

/** 构建局域网媒体 inline 预览 URL（GIF/视频播放） */
export function buildLanMediaPreviewUrl(host: string, port: number, token: string, mediaId: string): string {
  return `${buildLanMediaDownloadUrl(host, port, token, mediaId)}&inline=1`
}

/** 相对路径（手机网页内使用） */
export function buildLanMediaPath(mediaId: string, kind: 'file' | 'thumb' = 'file'): string {
  return `/api/media/${encodeURIComponent(mediaId)}/${kind}`
}
