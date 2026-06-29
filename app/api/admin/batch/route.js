import { getAuthedUser, isAdmin } from '../../../../lib/auth'
import { ingestUrl } from '../../../../lib/ingest'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX = 25 // tope por request (evita timeouts); pegá en tandas si tenés más
const CONC = 3 // concurrencia (no martillar Cauce ni los sitios)

export async function POST(req) {
  const user = await getAuthedUser()
  if (!isAdmin(user)) {
    return Response.json({ error: 'Solo el admin puede importar por lotes.' }, { status: 403 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const urls = [...new Set((Array.isArray(body?.urls) ? body.urls : [])
    .map((u) => String(u).trim())
    .filter(Boolean))]
  if (urls.length === 0) return Response.json({ error: 'Pasá una lista de URLs.' }, { status: 400 })
  if (urls.length > MAX) {
    return Response.json({ error: `Máximo ${MAX} por tanda (mandaste ${urls.length}). Pegá en partes.` }, { status: 400 })
  }

  // Procesa en olas de CONC para limitar concurrencia.
  const results = []
  for (let i = 0; i < urls.length; i += CONC) {
    const ola = urls.slice(i, i + CONC)
    const res = await Promise.all(ola.map((u) => ingestUrl(u).catch((e) => ({ url: u, status: 'error', error: String(e?.message || e) }))))
    results.push(...res)
  }

  const resumen = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  return Response.json({ resumen, results })
}
