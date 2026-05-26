import { networkInterfaces } from 'os'

/** 获取本机可用 IPv4 地址（排除 loopback） */
export function getLocalIPv4Addresses(): string[] {
  const nets = networkInterfaces()
  const addrs: string[] = []
  for (const iface of Object.values(nets)) {
    if (!iface) continue
    for (const net of iface) {
      const family = typeof net.family === 'string' ? net.family : net.family === 4 ? 'IPv4' : ''
      if (family === 'IPv4' && !net.internal) addrs.push(net.address)
    }
  }
  return [...new Set(addrs)]
}
