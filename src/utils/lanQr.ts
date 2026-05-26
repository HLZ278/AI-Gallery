import QRCode from 'qrcode'

export async function generateLanQrDataUrl(text: string, size = 220): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 2,
    color: { dark: '#1D1D1F', light: '#FFFFFF' }
  })
}
