import dns from 'node:dns/promises'
import net from 'node:net'

// --- Clasificación de IPs: solo permitimos direcciones públicas ---------------
// Bloquea loopback, privadas, link-local (incluye 169.254.169.254 = metadata
// de cloud), CGNAT, reservadas y multicast. Esto es el corazón anti-SSRF.

export function isPublicIp(ip) {
  const v = net.isIP(ip)
  if (v === 4) return isPublicV4(ip)
  if (v === 6) return isPublicV6(ip)
  return false
}

function isPublicV4(ip) {
  const o = ip.split('.').map(Number)
  if (o.length !== 4 || o.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false
  const [a, b] = o
  if (a === 0 || a === 10 || a === 127) return false          // this-net, privada, loopback
  if (a === 169 && b === 254) return false                    // link-local + metadata cloud
  if (a === 192 && b === 168) return false                    // privada
  if (a === 172 && b >= 16 && b <= 31) return false           // privada
  if (a === 100 && b >= 64 && b <= 127) return false          // CGNAT
  if (a === 192 && b === 0) return false                      // 192.0.0/24, 192.0.2 (test)
  if (a === 198 && (b === 18 || b === 19)) return false       // benchmark
  if (a === 198 && b === 51) return false                     // 198.51.100 test
  if (a === 203 && b === 0) return false                      // 203.0.113 test
  if (a >= 224) return false                                  // multicast + reservado
  return true
}

function isPublicV6(ip) {
  const x = ip.toLowerCase()
  if (x === '::1' || x === '::') return false                 // loopback / unspecified
  if (x.startsWith('fe80') || x.startsWith('fe9') || x.startsWith('fea') || x.startsWith('feb')) return false // link-local
  if (x.startsWith('fc') || x.startsWith('fd')) return false  // unique-local
  // IPv4 mapeada (::ffff:1.2.3.4) → validar la v4 embebida
  const m = x.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (m) return isPublicV4(m[1])
  if (x.startsWith('2001:db8')) return false                  // documentación
  return true
}

// Resuelve el hostname y exige que TODAS las IPs sean públicas.
export async function assertPublicHost(hostname) {
  if (net.isIP(hostname)) {
    if (!isPublicIp(hostname)) throw new Error(`IP no permitida: ${hostname}`)
    return
  }
  let addrs
  try {
    addrs = await dns.lookup(hostname, { all: true })
  } catch {
    throw new Error(`No se pudo resolver: ${hostname}`)
  }
  if (addrs.length === 0) throw new Error(`Sin direcciones: ${hostname}`)
  for (const { address } of addrs) {
    if (!isPublicIp(address)) throw new Error(`Host resuelve a IP no permitida (${address})`)
  }
}

async function readCapped(res, maxBytes) {
  if (!res.body) return ''
  const reader = res.body.getReader()
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > maxBytes) {
      await reader.cancel()
      break
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

// Fetch endurecido: solo http(s), valida cada salto de redirect contra la
// guardia, corta por tamaño y timeout. Devuelve { finalUrl, status, html }.
export async function safeFetch(rawUrl, { maxRedirects = 3, timeoutMs = 8000, maxBytes = 2_000_000 } = {}) {
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('URL inválida')
  }

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Solo se permite http/https')
    }
    await assertPublicHost(url.hostname)

    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'VeDirectoBot/0.1 (+directorio de ayuda)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location')
      if (!loc) break
      url = new URL(loc, url) // valida en la próxima vuelta
      continue
    }
    return { finalUrl: url.toString(), status: res.status, html: await readCapped(res, maxBytes) }
  }
  throw new Error('Demasiados redirects')
}
