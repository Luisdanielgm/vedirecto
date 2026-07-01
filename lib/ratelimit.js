// Rate-limit en memoria por IP (ventana fija). Suficiente para una sola
// instancia Docker. CAVEAT: se reinicia con el proceso y no es distribuido;
// si algún día hay varias réplicas, mover a Redis.
const hits = new Map() // ip -> { count, reset }

export function rateLimit(ip, { max = 5, windowMs = 10 * 60 * 1000 } = {}) {
  const now = Date.now()
  // Barrido perezoso: si el Map creció, purgamos lo vencido para no fugar RAM.
  if (hits.size > 5000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k)
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

// IP real del cliente. CLAVE: detrás de Cloudflare+Traefik el PRIMER valor de
// x-forwarded-for lo controla el cliente (spoofeable) → NO se usa. Preferimos la
// cabecera que fija el proxy de confianza: CF-Connecting-IP (Cloudflare la
// sobreescribe siempre), luego x-real-ip, y como último recurso el ÚLTIMO salto
// de XFF (el que agrega el proxy más cercano), nunca el primero.
export function clientIp(req) {
  const cf = req.headers.get('cf-connecting-ip')
  if (cf) return cf.trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length) return parts[parts.length - 1]
  }
  return 'desconocida'
}

// Cupo diario por clave (se reinicia a las 00:00 UTC). Mismo caveat que rateLimit:
// en memoria, por proceso. Sirve para topes suaves anti-abuso, no como contabilidad exacta.
const daily = new Map() // key -> { count, day }

export function dailyLimit(key, max) {
  const day = new Date().toISOString().slice(0, 10)
  // Purga de días viejos (evita fuga de RAM en el Map).
  if (daily.size > 5000) for (const [k, v] of daily) if (v.day !== day) daily.delete(k)
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
