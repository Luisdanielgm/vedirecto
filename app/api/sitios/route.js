import { listSitios, getSitioByUrl, addSitio } from '../../../lib/db'
import { scrapeSite } from '../../../lib/scrape'
import { analizarSitio } from '../../../lib/analyze'
import { rateLimit, clientIp } from '../../../lib/ratelimit'
import { createClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

const CORS = { 'Access-Control-Allow-Origin': '*' }

export async function GET() {
  return Response.json(listSitios(), { headers: CORS })
}

// Alta SOLO por scraping + análisis del LLM. Flujo:
//   rate-limit por IP → validar URL → dedup → scrape (con guardia SSRF)
//   → Cauce (extrae + triage de seguridad) → decidir según riesgo.
export async function POST(req) {
  const ip = clientIp(req)
  const rl = rateLimit(ip)
  if (!rl.ok) {
    return Response.json(
      { error: `Demasiados intentos. Probá de nuevo en ${rl.retryAfter}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  // Candado: solo usuarios logueados con Google pueden gastar el LLM.
  // La sesión viaja por cookie; el servidor la valida (no se confía en el cliente).
  // Falla cerrado: cualquier error de auth = 401 (no 500).
  let user = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch (e) {
    console.error('auth check falló:', e?.message || e)
  }
  if (!user) {
    return Response.json({ error: 'Iniciá sesión con Google para agregar un sitio.' }, { status: 401 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'JSON inválido.' }, { status: 400 })
  }
  const url = (body?.url || '').toString().trim()
  if (!url) return Response.json({ error: 'Falta "url".' }, { status: 400 })

  // Dedup rápido por la URL tal cual la mandaron.
  if (getSitioByUrl(url)) {
    return Response.json({ error: 'Ese sitio ya está en el directorio.' }, { status: 409 })
  }

  // 1) Scrape con guardia SSRF.
  let scraped
  try {
    scraped = await scrapeSite(url)
  } catch (e) {
    return Response.json({ error: `No se pudo leer el sitio: ${e.message}` }, { status: 400 })
  }

  // Dedup otra vez por la URL final (tras redirects).
  if (getSitioByUrl(scraped.finalUrl)) {
    return Response.json({ error: 'Ese sitio ya está en el directorio.' }, { status: 409 })
  }

  // 2) Análisis del LLM (extracción + seguridad).
  let analisis
  try {
    analisis = await analizarSitio(scraped)
  } catch (e) {
    return Response.json({ error: `No se pudo analizar el sitio: ${e.message}` }, { status: 502 })
  }

  // 3) Decisión conservadora: solo "seguro" se publica.
  if (analisis.riesgo !== 'seguro') {
    addSitio({ ...analisis, finalUrl: scraped.finalUrl }) // queda como pendiente/rechazado (no visible)
    return Response.json(
      {
        error: `El sitio no se publicó (riesgo: ${analisis.riesgo}). ${analisis.motivo_riesgo}`,
        riesgo: analisis.riesgo,
      },
      { status: 422 }
    )
  }

  const { id, estado } = addSitio({ ...analisis, finalUrl: scraped.finalUrl })
  return Response.json(
    { mensaje: `"${analisis.nombre}" agregado.`, id, estado, sitio: { ...analisis, url: scraped.finalUrl } },
    { status: 201, headers: CORS }
  )
}
