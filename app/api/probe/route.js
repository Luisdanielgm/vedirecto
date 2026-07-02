import { rateLimit, clientIp } from '../../../lib/ratelimit'
import { probe } from '../../../lib/api-probe'
import { listSitios } from '../../../lib/db'
import { domainOf } from '../../../lib/url-utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

// Solo se puede sondear un dominio que pertenezca a un sitio del directorio
// (su URL, su api.base_url o sus endpoints absolutos). Sin esto seríamos un
// proxy GET abierto a internet con la IP del VPS.
function dominioPermitido(url) {
  const dom = domainOf(url)
  if (!dom) return false
  for (const s of listSitios()) {
    if (domainOf(s.url) === dom) return true
    if (s.api?.base_url && domainOf(s.api.base_url) === dom) return true
    for (const e of s.endpoints || []) {
      const abs = String(e).match(/https?:\/\/\S+/)
      if (abs && domainOf(abs[0]) === dom) return true
    }
  }
  return false
}

// Proxy de PRUEBA para el modo developer: sondea en vivo una URL de API.
// Va server-side (evita CORS) pero con guardia anti-SSRF (safeFetch) + rate-limit.
export async function GET(req) {
  const { ok } = rateLimit(`probe:${clientIp(req)}`, { max: 20, windowMs: 60_000 })
  if (!ok) return Response.json({ error: 'Demasiadas pruebas seguidas. Esperá un momento.' }, { status: 429 })
  const url = (new URL(req.url).searchParams.get('url') || '').trim()
  if (!/^https?:\/\//i.test(url)) return Response.json({ error: 'URL inválida.' }, { status: 400 })
  if (!dominioPermitido(url)) return Response.json({ error: 'Solo se pueden probar APIs de sitios del directorio.' }, { status: 403 })
  const r = await probe(url, { timeoutMs: 6000, maxBytes: 60_000 })
  return Response.json(r)
}
