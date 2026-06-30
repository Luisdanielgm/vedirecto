import { scrapeSite } from './scrape'
import { cauceChat } from './cauce'
import { addNoticia, getNoticiaByUrl } from './db'

const SYS = `Sos un editor. Te paso el contenido de una nota de prensa sobre el terremoto de Venezuela 2026. Devolvé SOLO un objeto JSON:
{
  "titulo": string,    // claro y sin clickbait
  "resumen": string,   // 1-2 frases en español, lo esencial
  "fecha": string,     // YYYY-MM-DD si aparece, si no ""
  "fuente": string     // nombre del medio (o dominio)
}
Respondé únicamente el JSON.`

function parseJson(raw) {
  let s = (raw || '').trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const a = s.indexOf('{')
  const b = s.lastIndexOf('}')
  if (a !== -1 && b !== -1) s = s.slice(a, b + 1)
  return JSON.parse(s)
}

// Agrega una noticia desde una URL: scrape + LLM para título/resumen/fecha/fuente.
// La cargan los admins (curado), por eso no lleva gate de seguridad/relevancia.
export async function ingestNoticia(rawUrl) {
  const url = (rawUrl || '').toString().trim()
  if (!url) return { status: 'error', error: 'URL vacía' }

  let sc
  try {
    sc = await scrapeSite(url)
  } catch (e) {
    return { status: 'error', error: `No se pudo leer: ${e.message}` }
  }
  if (getNoticiaByUrl(sc.finalUrl)) return { status: 'duplicada' }

  let p = null
  try {
    const raw = await cauceChat([
      { role: 'system', content: SYS },
      { role: 'user', content: `URL: ${sc.finalUrl}\nTítulo: ${sc.title || ''}\nMeta: ${sc.description || ''}\n\n${(sc.text || '').slice(0, 4000)}` },
    ])
    p = parseJson(raw)
  } catch {
    p = null
  }

  const titulo = String(p?.titulo || sc.title || sc.finalUrl).trim()
  const resumen = String(p?.resumen || sc.description || '').trim()
  const fecha = String(p?.fecha || '').trim()
  let fuente = String(p?.fuente || '').trim()
  if (!fuente) {
    try { fuente = new URL(sc.finalUrl).hostname.replace(/^www\./, '') } catch {}
  }

  const { id, changed } = addNoticia({ titulo, resumen, fecha, fuente, url: sc.finalUrl })
  if (!changed) return { status: 'duplicada' }
  return { status: 'agregada', noticia: { id, titulo, resumen, fecha, fuente, url: sc.finalUrl } }
}
