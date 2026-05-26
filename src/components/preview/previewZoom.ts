export const PREVIEW_ZOOM_MIN = 1
export const PREVIEW_ZOOM_MAX = 5
export const PREVIEW_ZOOM_STEP = 0.25
export const PREVIEW_ZOOM_WHEEL_FACTOR = 0.0012

export function clampPreviewZoom(value: number): number {
  return Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, value))
}
