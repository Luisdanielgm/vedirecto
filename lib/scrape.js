import { safeFetch } from './net-guard.js'

const decode = (s) =>
  (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .trim()

function metaContent(html, attr, value) {
  // <meta name="description" content="..."> en cualquier orden de atributos
  const re = new RegExp(
    `<meta[^>]*${attr}=["']${value}["'][^>]*content=["']([^"']*)["']`,
    'i'
  )
  const re2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${value}["']`,
    'i'
  )
  const m = html.match(re) || html.match(re2)
  return m ? decode(m[1]) : ''
}

function visibleText(html) {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
  )
}

// Baja el sitio (con guardia SSRF) y extrae lo necesario para que el LLM lo catalogue.
export async function scrapeSite(rawUrl) {
  const { finalUrl, status, html } = await safeFetch(rawUrl)
  if (status >= 400) throw new Error(`El sitio respondió ${status}`)

  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleM ? decode(titleM[1]) : ''
  const description =
    metaContent(html, 'name', 'description') || metaContent(html, 'property', 'og:description')
  const ogTitle = metaContent(html, 'property', 'og:title')
  const ogSite = metaContent(html, 'property', 'og:site_name')
  const text = visibleText(html).slice(0, 6000)

  // Imagen automática: og:image (la preview del sitio); si no hay, su favicon.
  let imagen = metaContent(html, 'property', 'og:image') || metaContent(html, 'name', 'twitter:image')
  if (!imagen) {
    const iconM = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i)
    imagen = iconM ? iconM[1] : '/favicon.ico'
  }
  try {
    imagen = new URL(imagen, finalUrl).toString() // resuelve relativas a absolutas
  } catch {
    imagen = ''
  }

  const links = extractLinks(html, finalUrl)
  return { finalUrl, title: ogTitle || title, ogSite, description, text, imagen, links }
}

// Links candidatos a docs/API/repo (donde suelen estar funcionalidades y endpoints).
function extractLinks(html, base) {
  const out = new Set()
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(html)) && out.size < 40) {
    const href = m[1]
    const hay = (href + ' ' + m[2].replace(/<[^>]+>/g, ' ')).toLowerCase()
    if (/(\bapi\b|\bdocs?\b|developer|documentaci|swagger|openapi|endpoint|github\.com)/.test(hay)) {
      try {
        const abs = new URL(href, base).toString()
        if (/^https?:/.test(abs)) out.add(abs)
      } catch {}
    }
  }
  const score = (u) => {
    u = u.toLowerCase()
    let s = 0
    if (u.includes('github.com')) s += 3
    if (/\/docs?\b|documentaci/.test(u)) s += 2
    if (/\/api\b|swagger|openapi/.test(u)) s += 2
    if (/developer/.test(u)) s += 1
    return s
  }
  return [...out].sort((a, b) => score(b) - score(a)).slice(0, 3)
}

// Trae el texto visible de una página secundaria (con guardia SSRF).
export async function fetchText(url) {
  const { html, status } = await safeFetch(url)
  if (status >= 400) return ''
  return visibleText(html).slice(0, 3500)
}

// Rutas comunes de docs/API que muchos sitios NO linkean desde la home (SPAs,
// landings de marketing). Las probamos a ciegas; las que dan 404 se descartan solas.
const COMMON_DOC_PATHS = ['/docs', '/api', '/developers', '/api-docs']

// Scrape PROFUNDO: home + páginas de docs/api/repo, para extraer mejor
// funcionalidades y APIs (que rara vez están en la home). Combina los links
// detectados con rutas conocidas (probadas a ciegas en el mismo origen).
export async function scrapeDeep(rawUrl) {
  const home = await scrapeSite(rawUrl)
  let origin = ''
  try { origin = new URL(home.finalUrl).origin } catch {}

  // Candidatos: primero rutas conocidas (más fiables para hallar la API), luego
  // los links que encontramos en la home. Deduplicado, sin repetir la propia home.
  const seen = new Set([home.finalUrl, origin + '/'])
  const candidates = []
  if (origin) for (const p of COMMON_DOC_PATHS) candidates.push(origin + p)
  for (const l of home.links || []) candidates.push(l)

  const extras = []
  for (const link of candidates) {
    if (extras.length >= 4) break
    if (seen.has(link)) continue
    seen.add(link)
    try {
      const t = await fetchText(link)
      if (t) extras.push({ url: link, text: t })
    } catch {}
  }
  return { ...home, extras }
}
