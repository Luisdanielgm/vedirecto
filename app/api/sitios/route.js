import { listSitios, addSitio } from '../../../lib/db'
import { rateLimit, clientIp } from '../../../lib/ratelimit'
import { createClient } from '../../../lib/supabase/server'
import { ingestUrl } from '../../../lib/ingest'
import { takePreview } from '../../../lib/preview-cache'

export const dynamic = 'force-dynamic'

const CORS = { 'Access-Control-Allow-Origin': '*' }

export async function GET() {
  return Response.json(listSitios(), { headers: CORS })
}

// Alta individual. El pipeline vive en ingestUrl (compartido con el batch admin).
export async function POST(req) {
  const ip = clientIp(req)
  const rl = rateLimit(ip)
  if (!rl.ok) {
    return Response.json(
      { error: `Demasiados intentos. Probá de nuevo en ${rl.retryAfter}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  // Candado: solo logueados con Google. Falla cerrado (401, no 500).
  let user = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch (e) {
    console.error('auth check falló:', e?.message || e)
  }
  if (!user) {
    return Response.json({ error: 'Iniciá sesión con Google para agregar un sitio.' }, { status: 401 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'JSON inválido.' }, { status: 400 })
  }
  // Confirmar una previsualización por token (no re-analiza, usa lo cacheado).
  const token = (body?.token || '').toString().trim()
  if (token) {
    const cached = takePreview(token)
    if (!cached || cached.kind !== 'add') {
      return Response.json({ error: 'La previsualización expiró. Volvé a previsualizar.' }, { status: 410 })
    }
    const a = cached.analisis
    const { id, estado } = addSitio({ ...a, finalUrl: cached.finalUrl, imagen: cached.imagen })
    if (a.riesgo !== 'seguro') {
      return Response.json(
        { error: `El sitio no se publicó (riesgo: ${a.riesgo}). ${a.motivo_riesgo || ''}`.trim(), riesgo: a.riesgo },
        { status: 422 }
      )
    }
    return Response.json(
      { mensaje: `"${a.nombre}" agregado.`, id, estado, sitio: { ...a, url: cached.finalUrl, imagen: cached.imagen, id, estado } },
      { status: 201, headers: CORS }
    )
  }

  const url = (body?.url || '').toString().trim()
  if (!url) return Response.json({ error: 'Falta "url".' }, { status: 400 })

  const r = await ingestUrl(url)
  switch (r.status) {
    case 'agregado':
      return Response.json(
        { mensaje: `"${r.sitio.nombre}" agregado.`, id: r.sitio.id, estado: r.sitio.estado, sitio: r.sitio },
        { status: 201, headers: CORS }
      )
    case 'duplicado':
      return Response.json(
        { error: r.nota ? `Parece el mismo recurso que ya está: "${r.nota}".` : 'Ese sitio ya está en el directorio.' },
        { status: 409 }
      )
    case 'no-relevante':
      return Response.json({ error: `No es relevante para este directorio. ${r.nota || ''}`.trim() }, { status: 422 })
    case 'dudoso':
    case 'peligroso':
      return Response.json(
        { error: `El sitio no se publicó (riesgo: ${r.status}). ${r.nota || ''}`.trim(), riesgo: r.status },
        { status: 422 }
      )
    default:
      return Response.json({ error: r.error || 'No se pudo procesar.' }, {
        status: (r.error || '').includes('analizar') ? 502 : 400,
      })
  }
}
