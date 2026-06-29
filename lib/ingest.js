import { listSitiosLite, addSitio } from './db'
import { scrapeDeep } from './scrape'
import { analizarSitio } from './analyze'
import { normalizeUrl, domainOf } from './url-utils'

// Procesa UNA url por todo el pipeline. Devuelve un resultado uniforme que sirve
// tanto para el alta individual (route) como para el batch.
// status: agregado | duplicado | no-relevante | dudoso | peligroso | error
export async function ingestUrl(rawUrl) {
  const url = (rawUrl || '').toString().trim()
  if (!url) return { url, status: 'error', error: 'URL vacía' }

  // Se relee en cada llamada → en un batch, ve los que se agregaron antes.
  const existentes = listSitiosLite()
  const norm = normalizeUrl(url)
  if (existentes.some((s) => normalizeUrl(s.url) === norm)) return { url, status: 'duplicado' }

  let scraped
  try {
    scraped = await scrapeDeep(url)
  } catch (e) {
    return { url, status: 'error', error: `No se pudo leer: ${e.message}` }
  }

  const normFinal = normalizeUrl(scraped.finalUrl)
  if (existentes.some((s) => normalizeUrl(s.url) === normFinal)) return { url, status: 'duplicado' }

  const dom = domainOf(scraped.finalUrl)
  const sameDomain = dom
    ? existentes.filter((s) => domainOf(s.url) === dom).map((s) => ({ nombre: s.nombre, url: s.url }))
    : []

  let a
  try {
    a = await analizarSitio({ ...scraped, sameDomain })
  } catch (e) {
    return { url, status: 'error', error: `No se pudo analizar: ${e.message}` }
  }

  if (a.duplicado) return { url, status: 'duplicado', nota: a.duplicado_de }
  if (!a.relevante) return { url, status: 'no-relevante', nota: a.motivo_relevancia }

  const { id, estado } = addSitio({ ...a, finalUrl: scraped.finalUrl, imagen: scraped.imagen })
  if (a.riesgo !== 'seguro') return { url, status: a.riesgo, nota: a.motivo_riesgo } // guardado, no visible

  return { url, status: 'agregado', sitio: { ...a, url: scraped.finalUrl, imagen: scraped.imagen, id, estado } }
}
