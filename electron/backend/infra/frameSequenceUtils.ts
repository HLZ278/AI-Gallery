/** 百炼 video 类型帧序列：至少 minCount 帧（默认 4） */
export function padFrameBuffers(frames: Buffer[], minCount: number): Buffer[] {
  if (frames.length === 0) throw new Error('无可用帧')
  if (frames.length >= minCount) return frames
  const padded = [...frames]
  while (padded.length < minCount) {
    padded.push(frames[frames.length - 1])
  }
  return padded
}

export function toDataUrls(frames: Array<{ base64: string; mimeType: string }>): string[] {
  return frames.map((f) => `data:${f.mimeType};base64,${f.base64}`)
}
