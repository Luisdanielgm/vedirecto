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

  return { finalUrl, title: ogTitle || title, ogSite, description, text }
}
