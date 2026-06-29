import { listSitios, listSitiosLite, addSitio } from '../../../lib/db'
import { scrapeSite } from '../../../lib/scrape'
import { analizarSitio } from '../../../lib/analyze'
import { rateLimit, clientIp } from '../../../lib/ratelimit'
import { createClient } from '../../../lib/supabase/server'
import { normalizeUrl, domainOf } from '../../../lib/url-utils'

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

  // Dedup determinista por URL normalizada (ignora www, http/https, query, barra final).
  const existentes = listSitiosLite()
  const norm = normalizeUrl(url)
  if (existentes.some((s) => normalizeUrl(s.url) === norm)) {
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
  const normFinal = normalizeUrl(scraped.finalUrl)
  if (existentes.some((s) => normalizeUrl(s.url) === normFinal)) {
    return Response.json({ error: 'Ese sitio ya está en el directorio.' }, { status: 409 })
  }

  // Sitios del MISMO dominio (subdominios/secciones) → para que la IA juzgue duplicados.
  const dom = domainOf(scraped.finalUrl)
  const sameDomain = dom
    ? existentes.filter((s) => domainOf(s.url) === dom).map((s) => ({ nombre: s.nombre, url: s.url }))
    : []

  // 2) Análisis del LLM (extracción + seguridad + relevancia + duplicado).
  let analisis
  try {
    analisis = await analizarSitio({ ...scraped, sameDomain })
  } catch (e) {
    return Response.json({ error: `No se pudo analizar el sitio: ${e.message}` }, { status: 502 })
  }

  // 2b) La IA detectó que es el mismo recurso que uno ya listado del dominio.
  if (analisis.duplicado) {
    return Response.json(
      { error: `Parece el mismo recurso que ya está${analisis.duplicado_de ? `: "${analisis.duplicado_de}"` : ''}.` },
      { status: 409 }
    )
  }

  // 2c) Filtro de relevancia: si no tiene que ver con la emergencia/ayuda, no entra.
  if (!analisis.relevante) {
    return Response.json(
      { error: `No es relevante para este directorio. ${analisis.motivo_relevancia}`.trim() },
      { status: 422 }
    )
  }

  // 3) Decisión conservadora: solo "seguro" se publica.
  if (analisis.riesgo !== 'seguro') {
    addSitio({ ...analisis, finalUrl: scraped.finalUrl, imagen: scraped.imagen }) // pendiente/rechazado (no visible)
    return Response.json(
      {
        error: `El sitio no se publicó (riesgo: ${analisis.riesgo}). ${analisis.motivo_riesgo}`,
        riesgo: analisis.riesgo,
      },
      { status: 422 }
    )
  }

  const { id, estado } = addSitio({ ...analisis, finalUrl: scraped.finalUrl, imagen: scraped.imagen })
  return Response.json(
    {
      mensaje: `"${analisis.nombre}" agregado.`,
      id,
      estado,
      sitio: { ...analisis, url: scraped.finalUrl, imagen: scraped.imagen },
    },
    { status: 201, headers: CORS }
  )
}
