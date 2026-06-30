import { getAuthedUser, isAdmin } from '../../../../../lib/auth'
import { getSitioById, updateSitioContent } from '../../../../../lib/db'
import { scrapeDeep } from '../../../../../lib/scrape'
import { analizarSitio } from '../../../../../lib/analyze'
import { analizarConAgente } from '../../../../../lib/agent'
import { putPreview, takePreview } from '../../../../../lib/preview-cache'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Re-corre el pipeline (scrape + LLM) sobre un sitio existente. Solo admin.
//   body {}              → re-analiza y GUARDA (comportamiento legacy)
//   body {preview:true}  → re-analiza y devuelve qué quedaría, SIN guardar (+token)
//   body {token}         → confirma una preview previa (guarda sin re-analizar)
export async function POST(req, { params }) {
  const user = await getAuthedUser()
  if (!isAdmin(user)) {
    return Response.json({ error: 'Solo el admin puede reindexar.' }, { status: 403 })
  }
  const { id } = await params
  const sid = Number(id)
  const existing = getSitioById(sid)
  if (!existing) return Response.json({ error: 'No existe.' }, { status: 404 })

  let body = {}
  try {
    body = await req.json()
  } catch {}

  // Confirmar preview por token (sin re-analizar).
  const token = (body?.token || '').toString().trim()
  if (token) {
    const cached = takePreview(token)
    if (!cached || cached.kind !== 'reindex' || cached.id !== sid) {
      return Response.json({ error: 'La previsualización expiró. Volvé a previsualizar.' }, { status: 410 })
    }
    const sitio = updateSitioContent(sid, { ...cached.analisis, imagen: cached.imagen })
    return Response.json({ sitio })
  }

  let scraped
  try {
    scraped = await scrapeDeep(existing.url)
  } catch (e) {
    return Response.json({ error: `No se pudo leer el sitio: ${e.message}` }, { status: 400 })
  }

  let analisis
  try {
    analisis = await analizarSitio(scraped)
  } catch (e) {
    return Response.json({ error: `No se pudo analizar: ${e.message}` }, { status: 502 })
  }

  // Si la extracción simple quedó pobre, escalamos al agente (navega docs/api/github).
  const pobre =
    !analisis.descripcion ||
    (analisis.categorias?.length === 1 && analisis.categorias[0] === 'Otros') ||
    (analisis.riesgo === 'dudoso' && /no se pudo analizar/i.test(analisis.motivo_riesgo || ''))
  if (pobre) {
    try {
      const ag = await analizarConAgente(existing.url, {})
      if (ag && ag.descripcion) analisis = ag
    } catch {}
  }

  // Preview: cacheamos y devolvemos sin guardar.
  if (body?.preview) {
    const tk = putPreview({ kind: 'reindex', id: sid, analisis, imagen: scraped.imagen })
    return Response.json({ token: tk, preview: { ...analisis, url: existing.url, imagen: scraped.imagen } })
  }

  const sitio = updateSitioContent(sid, { ...analisis, imagen: scraped.imagen })
  return Response.json({ sitio })
}
