import { rateLimit, clientIp } from '../../../lib/ratelimit'
import { probe } from '../../../lib/api-probe'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

// Proxy de PRUEBA para el modo developer: sondea en vivo una URL de API.
// Va server-side (evita CORS) pero con guardia anti-SSRF (safeFetch) + rate-limit.
export async function GET(req) {
  const { ok } = rateLimit(`probe:${clientIp(req)}`, { max: 20, windowMs: 60_000 })
  if (!ok) return Response.json({ error: 'Demasiadas pruebas seguidas. Esperá un momento.' }, { status: 429 })
  const url = (new URL(req.url).searchParams.get('url') || '').trim()
  if (!/^https?:\/\//i.test(url)) return Response.json({ error: 'URL inválida.' }, { status: 400 })
  const r = await probe(url, { timeoutMs: 6000, maxBytes: 60_000 })
  return Response.json(r)
}
