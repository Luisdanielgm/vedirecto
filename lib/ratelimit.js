// Rate-limit en memoria por IP (ventana fija). Suficiente para una sola
// instancia Docker. CAVEAT: se reinicia con el proceso y no es distribuido;
// si algún día hay varias réplicas, mover a Redis.
const hits = new Map() // ip -> { count, reset }

export function rateLimit(ip, { max = 5, windowMs = 10 * 60 * 1000 } = {}) {
  const now = Date.now()
  const e = hits.get(ip)
  if (!e || now > e.reset) {
    hits.set(ip, { count: 1, reset: now + windowMs })
    return { ok: true, remaining: max - 1 }
  }
  if (e.count >= max) {
    return { ok: false, retryAfter: Math.ceil((e.reset - now) / 1000) }
  }
  e.count++
  return { ok: true, remaining: max - e.count }
}

export function clientIp(req) {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'desconocida'
}
