const EXIF_GPS_PICK = [
  'GPSLatitude',
  'GPSLongitude',
  'GPSLatitudeRef',
  'GPSLongitudeRef',
  'GPSAltitude',
  'GPSAltitudeRef'
] as const

export const EXIF_GPS_FIELDS = EXIF_GPS_PICK

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function applyHemisphere(value: number, ref: unknown, negativeRef: string): number {
  if (typeof ref === 'string' && ref.toUpperCase() === negativeRef) return -Math.abs(value)
  return value
}

function formatCoordinate(value: number): string {
  return value.toFixed(6).replace(/\.?0+$/, '')
}

export function buildExifGeoText(exifJson: string | null | undefined): string {
  if (!exifJson?.trim()) return ''

  let exif: Record<string, unknown>
  try {
    exif = JSON.parse(exifJson) as Record<string, unknown>
  } catch {
    return ''
  }

  const lat = toFiniteNumber(exif.GPSLatitude ?? exif.latitude)
  const lon = toFiniteNumber(exif.GPSLongitude ?? exif.longitude)
  if (lat == null || lon == null) return ''

  const latSigned = applyHemisphere(lat, exif.GPSLatitudeRef, 'S')
  const lonSigned = applyHemisphere(lon, exif.GPSLongitudeRef, 'W')
  const latText = formatCoordinate(latSigned)
  const lonText = formatCoordinate(lonSigned)

  const parts = [
    `GPS ${latText} ${lonText}`,
    `${latText},${lonText}`,
    `纬度 ${latText}`,
    `经度 ${lonText}`,
    `坐标 ${latText} ${lonText}`
  ]

  const altitude = toFiniteNumber(exif.GPSAltitude)
  if (altitude != null) {
    const altText = formatCoordinate(altitude)
    parts.push(`海拔 ${altText} 米`)
  }

  return parts.join(' ')
}
