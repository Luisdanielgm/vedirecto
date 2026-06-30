import { safeFetch } from './net-guard.js'
import { normalizeUrl, domainOf } from './url-utils.js'
import { getNoticiaByUrl, listFuentesActivas, touchFuente } from './db.js'
import { ingestNoticia } from './news.js'

// Palabras que delatan una nota sobre la emergencia.
const KW = /(terremoto|sismo|temblor|r[eé]plica|damnificad|desaparecid|rescate|refugio|donaci|acopio|venezuela)/i

function allLinks(html, base) {
  const out = []
  const seen = new Set()
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(html)) && out.length < 300) {
    try {
      const abs = new URL(m[1], base).toString().split('#')[0]
      if (!/^https?:/.test(abs) || seen.has(abs)) continue
      seen.add(abs)
      out.push({ url: abs, text: m[2].replace(/<[^>]+>/g, ' ').trim() })
    } catch {}
  }
  return out
}

// Recorre UNA fuente: busca links de notas del terremoto y agrega las nuevas (tope max).
export async function crawlFuente(fuente, max = 6) {
  let html
  try {
    const r = await safeFetch(fuente.url)
    html = r.html
  } catch (e) {
    return { fuente: fuente.url, agregadas: 0, error: e.message }
  }

  const dom = domainOf(fuente.url)
  const homeNorm = normalizeUrl(fuente.url)
  const candidatos = allLinks(html, fuente.url)
    .filter((l) => domainOf(l.url) === dom)
    .filter((l) => normalizeUrl(l.url) !== homeNorm)
    .filter((l) => KW.test(`${l.url} ${l.text}`))
    .filter((l) => !getNoticiaByUrl(l.url))

  let agregadas = 0
  const report = []
  for (const l of candidatos) {
    if (report.length >= max) break
    try {
      const r = await ingestNoticia(l.url)
      report.push({ url: l.url, status: r.status })
      if (r.status === 'agregada') agregadas++
    } catch (e) {
      report.push({ url: l.url, status: 'error', error: e.message })
    }
  }
  touchFuente(fuente.id)
  return { fuente: fuente.url, agregadas, intentos: report.length, report }
}

// Recorre TODAS las fuentes activas (lo llama el cron).
export async function crawlTodas(maxPorFuente = 6) {
  const out = []
  for (const f of listFuentesActivas()) {
    out.push(await crawlFuente(f, maxPorFuente))
  }
  return out
}
