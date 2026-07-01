import dns from 'node:dns/promises'
import net from 'node:net'
import http from 'node:http'
import https from 'node:https'

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

// Expande una IPv6 a sus 8 grupos de 16 bits. Devuelve null si es inválida.
function expandV6(x) {
  if (x.indexOf('::') !== x.lastIndexOf('::')) return null // más de un '::' → inválida
  let head, tail
  if (x.includes('::')) {
    const [h, t] = x.split('::')
    head = h ? h.split(':') : []
    tail = t ? t.split(':') : []
  } else {
    head = x.split(':')
    tail = []
  }
  const missing = 8 - (head.length + tail.length)
  if (missing < 0) return null
  const full = [...head, ...Array(missing).fill('0'), ...tail]
  if (full.length !== 8) return null
  const nums = full.map((g) => (g === '' ? 0 : parseInt(g, 16)))
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null
  return nums
}

// Modelo ALLOW-BY-EXCEPTION: solo global unicast (2000::/3) es público, y aun así
// extraemos cualquier IPv4 embebida (mapeada, compatible, 6to4, NAT64) para
// validarla como v4. Todo lo demás se rechaza por defecto.
function isPublicV6(ip) {
  let x = ip.toLowerCase().split('%')[0] // saca zone-id (fe80::1%eth0)
  // Normalizamos un sufijo IPv4-dotted (::ffff:1.2.3.4, ::1.2.3.4) a 2 grupos hex,
  // para clasificar SIEMPRE por prefijo (no como atajo frágil que confundiría un
  // global unicast con sufijo dotted, ej: 2000::1.2.3.4).
  const dm = x.match(/^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (dm) {
    const o = dm[2].split('.').map(Number)
    if (o.some((n) => n > 255)) return false
    x = dm[1] + (((o[0] << 8) | o[1]) >>> 0).toString(16) + ':' + (((o[2] << 8) | o[3]) >>> 0).toString(16)
  }

  const g = expandV6(x)
  if (!g) return false
  const v4Low = () => `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`

  // ::/96 (compatible / loopback / unspecified) → los 32 bits bajos son una IPv4
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) return isPublicV4(v4Low())
  // ::ffff:xxxx:xxxx (mapeada en hex)
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0xffff) return isPublicV4(v4Low())
  // 64:ff9b::/96 (NAT64)
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) return isPublicV4(v4Low())
  // 2002::/16 (6to4): la IPv4 está en g1:g2
  if (g[0] === 0x2002) return isPublicV4(`${g[1] >> 8}.${g[1] & 255}.${g[2] >> 8}.${g[2] & 255}`)

  if ((g[0] & 0xfe00) === 0xfc00) return false                 // fc00::/7 unique-local
  if ((g[0] & 0xffc0) === 0xfe80) return false                 // fe80::/10 link-local
  if (g[0] === 0x2001 && g[1] === 0x0db8) return false         // 2001:db8::/32 documentación
  if ((g[0] & 0xff00) === 0xff00) return false                 // ff00::/8 multicast
  if ((g[0] & 0xe000) === 0x2000) return true                  // 2000::/3 global unicast
  return false                                                 // por defecto: DENY
}

// Resuelve el hostname y devuelve UNA IP pública validada, para FIJAR la conexión
// a esa IP (cierra el DNS rebinding: se resuelve una sola vez y se conecta ahí).
export async function resolvePublicIp(hostname) {
  const lit = net.isIP(hostname)
  if (lit) {
    if (!isPublicIp(hostname)) throw new Error(`IP no permitida: ${hostname}`)
    return { address: hostname, family: lit }
  }
  let addrs
  try {
    addrs = await dns.lookup(hostname, { all: true })
  } catch {
    throw new Error(`No se pudo resolver: ${hostname}`)
  }
  if (!addrs.length) throw new Error(`Sin direcciones: ${hostname}`)
  // TODAS deben ser públicas (una interna entre varias = trampa → rechazamos).
  for (const { address } of addrs) {
    if (!isPublicIp(address)) throw new Error(`Host resuelve a IP no permitida (${address})`)
  }
  return { address: addrs[0].address, family: addrs[0].family }
}

// Compat: valida sin devolver (por si algún módulo lo usa).
export async function assertPublicHost(hostname) {
  await resolvePublicIp(hostname)
}

const ALLOWED_PORTS = new Set(['', '80', '443']) // solo web estándar (no port-scan)

// Un solo request GET contra una IP FIJADA. Sin seguir redirects (los maneja
// safeFetch, revalidando cada salto). Corta por tamaño y timeout.
function requestOnce(url, pinned, { timeoutMs, maxBytes, accept }) {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http
    let settled = false
    let killer = null
    const done = (fn, arg) => { if (!settled) { settled = true; if (killer) clearTimeout(killer); fn(arg) } }
    // lookup fijado: la conexión va EXACTAMENTE a la IP ya validada. Respeta el
    // modo `all` (Node activa autoSelectFamily por default → espera un array).
    const lookup = (_h, opts, cb) =>
      opts && opts.all
        ? cb(null, [{ address: pinned.address, family: pinned.family }])
        : cb(null, pinned.address, pinned.family)
    const req = lib.request(
      url,
      {
        method: 'GET',
        lookup,
        // SNI: solo con hostname real (setear un IP como servername es inválido).
        servername: net.isIP(url.hostname) ? undefined : url.hostname,
        headers: {
          Host: url.host,
          'User-Agent': 'VeDirectoBot/0.1 (+directorio de ayuda)',
          Accept: accept || 'text/html,application/xhtml+xml',
        },
      },
      (res) => {
        const status = res.statusCode || 0
        if ([301, 302, 303, 307, 308].includes(status)) {
          res.resume() // drena, no leemos body en redirects
          done(resolve, { status, location: res.headers.location || null })
          return
        }
        const chunks = []
        let total = 0
        res.on('data', (c) => {
          total += c.length
          if (total > maxBytes) {
            res.destroy()
            done(resolve, { status, html: Buffer.concat(chunks).toString('utf8') })
            return
          }
          chunks.push(c)
        })
        res.on('end', () => done(resolve, { status, html: Buffer.concat(chunks).toString('utf8') }))
        res.on('error', (e) => done(reject, e))
      }
    )
    // Tope ABSOLUTO de la operación (no de inactividad): un servidor que hace
    // slow-drip no puede colgar el worker indefinidamente hasta llenar maxBytes.
    killer = setTimeout(() => req.destroy(new Error('timeout')), timeoutMs)
    req.on('error', (e) => done(reject, e))
    req.end()
  })
}

// Fetch endurecido: solo http(s), solo puertos 80/443, valida y FIJA la IP en
// cada salto de redirect, corta por tamaño y timeout. Devuelve { finalUrl, status, html }.
export async function safeFetch(rawUrl, { maxRedirects = 3, timeoutMs = 8000, maxBytes = 768_000, accept } = {}) {
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('URL inválida')
  }

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Solo se permite http/https')
    if (!ALLOWED_PORTS.has(url.port)) throw new Error(`Puerto no permitido: ${url.port || '(default)'}`)
    const pinned = await resolvePublicIp(url.hostname)
    const r = await requestOnce(url, pinned, { timeoutMs, maxBytes, accept })
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      if (!r.location) return { finalUrl: url.toString(), status: r.status, html: '' }
      url = new URL(r.location, url) // valida en la próxima vuelta
      continue
    }
    return { finalUrl: url.toString(), status: r.status, html: r.html || '' }
  }
  throw new Error('Demasiados redirects')
}
