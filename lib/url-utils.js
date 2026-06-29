// Normaliza una URL para dedup: ignora protocolo, www, query, fragmento y barra
// final. Así https://www.x.com/?utm=1 y http://x.com/ cuentan como el MISMO.
export function normalizeUrl(raw) {
  let u
  try {
    u = new URL(raw)
  } catch {
    return (raw || '').trim().toLowerCase()
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  const path = u.pathname.replace(/\/+$/, '') // saca barras finales
  return `https://${host}${path}`
}

// SLDs de segundo nivel comunes (para .com.ve, .gob.ve, .org.ar, etc.).
const SLD = new Set(['com', 'org', 'net', 'gob', 'gov', 'edu', 'co', 'info', 'web', 'mil'])

// Dominio registrable aproximado (sin PSL completo): x.com, x.com.ve, etc.
// Permite detectar que mapa.x.app y x.app/seccion son el MISMO dominio.
export function registrableDomain(host) {
  host = (host || '').toLowerCase().replace(/^www\./, '')
  const parts = host.split('.').filter(Boolean)
  if (parts.length <= 2) return host
  const tld = parts[parts.length - 1]
  const sld = parts[parts.length - 2]
  if (tld.length === 2 && SLD.has(sld)) return parts.slice(-3).join('.')
  return parts.slice(-2).join('.')
}

export function domainOf(rawUrl) {
  try {
    return registrableDomain(new URL(rawUrl).hostname)
  } catch {
    return ''
  }
}
