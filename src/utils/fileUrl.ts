export function toFileUrl(filePath: string): string {
  return `file://${filePath.replace(/\\/g, '/')}`
}

export function fileNameFromPath(filePath: string): string {
  return filePath.split(/[/\\]/).pop() ?? filePath
}
