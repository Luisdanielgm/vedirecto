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

// Cupo diario por clave (se reinicia a las 00:00 UTC). Mismo caveat que rateLimit:
// en memoria, por proceso. Sirve para topes suaves anti-abuso, no como contabilidad exacta.
const daily = new Map() // key -> { count, day }

export function dailyLimit(key, max) {
  const day = new Date().toISOString().slice(0, 10)
  const e = daily.get(key)
  if (!e || e.day !== day) {
    daily.set(key, { count: 1, day })
    return { ok: true, remaining: max - 1 }
  }
  if (e.count >= max) {
    const now = new Date()
    const manana = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    return { ok: false, resetIn: Math.ceil((manana - now.getTime()) / 1000) }
  }
  e.count++
  return { ok: true, remaining: max - e.count }
}

// Tope de análisis con IA (cada preview/alta directa gasta un llamado a Cauce).
// Protege los créditos: primero el cupo del usuario, luego el global del día.
const MAX_ANALISIS_USUARIO = Number(process.env.MAX_ANALISIS_USUARIO_DIA) || 30
const MAX_ANALISIS_GLOBAL = Number(process.env.MAX_ANALISIS_DIA) || 200

export function analisisCap(email) {
  const u = dailyLimit(`analisis:user:${email || 'anon'}`, MAX_ANALISIS_USUARIO)
  if (!u.ok) return { ok: false, scope: 'tu cupo diario', resetIn: u.resetIn }
  const g = dailyLimit('analisis:global', MAX_ANALISIS_GLOBAL)
  if (!g.ok) return { ok: false, scope: 'el cupo diario del sitio', resetIn: g.resetIn }
  return { ok: true }
}
