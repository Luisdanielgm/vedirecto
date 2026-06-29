import { getAuthedUser, isAdmin } from '../../../../../lib/auth'
import { getSitioById, updateSitioContent } from '../../../../../lib/db'
import { scrapeDeep } from '../../../../../lib/scrape'
import { analizarSitio } from '../../../../../lib/analyze'

export const dynamic = 'force-dynamic'

// Re-corre el pipeline (scrape + LLM) sobre un sitio existente y actualiza su
// ficha (imagen, categorías, descripción...). Solo admin (gasta un llamado a Cauce).
export async function POST(_req, { params }) {
  const user = await getAuthedUser()
  if (!isAdmin(user)) {
    return Response.json({ error: 'Solo el admin puede reindexar.' }, { status: 403 })
  }
  const { id } = await params
  const existing = getSitioById(Number(id))
  if (!existing) return Response.json({ error: 'No existe.' }, { status: 404 })

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

  const sitio = updateSitioContent(Number(id), { ...analisis, imagen: scraped.imagen })
  return Response.json({ sitio })
}
