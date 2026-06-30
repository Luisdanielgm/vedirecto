import { listSitiosLite, addSitio } from './db'
import { scrapeDeep } from './scrape'
import { analizarSitio } from './analyze'
import { normalizeUrl, domainOf } from './url-utils'

// Núcleo compartido: dedup + scrape profundo + análisis. NO guarda nada.
// status: error | duplicado | no-relevante | ok | dudoso | peligroso
// (ok/dudoso/peligroso traen `analisis`, `finalUrl` e `imagen`).
async function analyzeUrl(rawUrl) {
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

  const base = { url, analisis: a, finalUrl: scraped.finalUrl, imagen: scraped.imagen }
  if (a.duplicado) return { ...base, status: 'duplicado', nota: a.duplicado_de }
  if (!a.relevante) return { ...base, status: 'no-relevante', nota: a.motivo_relevancia }
  // seguro → ok ; dudoso/peligroso conservan su nombre (se guardan, no se publican)
  return { ...base, status: a.riesgo === 'seguro' ? 'ok' : a.riesgo, nota: a.motivo_riesgo }
}

// Previsualización: corre el pipeline y devuelve el resultado SIN guardar.
export async function previewUrl(rawUrl) {
  return analyzeUrl(rawUrl)
}

// Procesa UNA url por todo el pipeline y la GUARDA. Resultado uniforme que sirve
// tanto para el alta individual (route) como para el batch.
// status: agregado | duplicado | no-relevante | dudoso | peligroso | error
export async function ingestUrl(rawUrl) {
  const r = await analyzeUrl(rawUrl)
  if (r.status === 'error') return { url: r.url, status: 'error', error: r.error }
  if (r.status === 'duplicado') return { url: r.url, status: 'duplicado', nota: r.nota }
  if (r.status === 'no-relevante') return { url: r.url, status: 'no-relevante', nota: r.nota }

  // ok | dudoso | peligroso → todos se guardan (estado se deriva del riesgo).
  const a = r.analisis
  const { id, estado } = addSitio({ ...a, finalUrl: r.finalUrl, imagen: r.imagen })
  if (a.riesgo !== 'seguro') return { url: r.url, status: a.riesgo, nota: a.motivo_riesgo } // guardado, no visible

  return { url: r.url, status: 'agregado', sitio: { ...a, url: r.finalUrl, imagen: r.imagen, id, estado } }
}
