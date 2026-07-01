import { safeFetch } from './net-guard.js'

// Sonda REAL una URL (GET, con guardia anti-SSRF, timeout y tope de bytes).
// Devuelve un resumen chico y seguro para mostrarle al developer.
export async function probe(url, { timeoutMs = 6000, maxBytes = 60_000 } = {}) {
  try {
    const { finalUrl, status, html } = await safeFetch(url, { timeoutMs, maxBytes, accept: 'application/json, text/plain, */*' })
    return { ok: status > 0 && status < 400, status, finalUrl, snippet: (html || '').slice(0, 1200) }
  } catch (e) {
    return { ok: false, status: 0, error: e.message || 'fallo de red' }
  }
}

// URL representativa de la API para verificarla: el base_url, o un endpoint absoluto.
function targetDe(api) {
  if (api?.base_url && /^https?:\/\//i.test(api.base_url)) return api.base_url
  for (const e of (api?.endpoints || []).map((x) => String(x))) {
    const abs = e.match(/https?:\/\/\S+/)
    if (abs) return abs[0]
  }
  return null
}

// Verifica la API inferida con UN GET real. "verificada" = el host respondió algo
// (status > 0); un 401/403 igual confirma que la API existe. No guarda el body.
export async function verificarApi(api) {
  if (!api?.tiene) return { verificada: false, verificada_status: 0 }
  const target = targetDe(api)
  if (!target) return { verificada: false, verificada_status: 0 }
  const r = await probe(target, { timeoutMs: 5000, maxBytes: 20_000 })
  return { verificada: r.status > 0, verificada_status: r.status }
}
