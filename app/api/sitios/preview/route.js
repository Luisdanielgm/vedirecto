import { previewUrl } from '../../../../lib/ingest'
import { putPreview } from '../../../../lib/preview-cache'
import { rateLimit, clientIp } from '../../../../lib/ratelimit'
import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Vista previa del alta: corre scrape + análisis y devuelve qué se guardaría,
// SIN persistir. Si es guardable, deja el análisis en cache y devuelve un token
// que /api/sitios (POST) usa para confirmar sin re-analizar.
export async function POST(req) {
  const ip = clientIp(req)
  const rl = rateLimit(ip)
  if (!rl.ok) {
    return Response.json(
      { error: `Demasiados intentos. Probá de nuevo en ${rl.retryAfter}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  // Mismo candado que el alta: solo logueados (la preview gasta un llamado a Cauce).
  let user = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch (e) {
    console.error('auth check falló:', e?.message || e)
  }
  if (!user) {
    return Response.json({ error: 'Iniciá sesión con Google para previsualizar.' }, { status: 401 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'JSON inválido.' }, { status: 400 })
  }
  const url = (body?.url || '').toString().trim()
  if (!url) return Response.json({ error: 'Falta "url".' }, { status: 400 })

  const r = await previewUrl(url)
  if (r.status === 'error') return Response.json({ error: r.error || 'No se pudo procesar.' }, { status: 400 })
  if (r.status === 'duplicado') return Response.json({ status: 'duplicado', nota: r.nota || null })
  if (r.status === 'no-relevante') {
    return Response.json({ status: 'no-relevante', nota: r.nota || null, preview: previewView(r) })
  }

  // ok | dudoso | peligroso → guardable: cacheamos el análisis y devolvemos token.
  const token = putPreview({ kind: 'add', analisis: r.analisis, finalUrl: r.finalUrl, imagen: r.imagen })
  return Response.json({ status: r.status, token, preview: previewView(r) })
}

// Vista compacta para el cliente (qué se vería en la card + qué estado tendría).
function previewView(r) {
  const a = r.analisis || {}
  const estado = a.riesgo === 'seguro' ? 'publicado' : a.riesgo === 'dudoso' ? 'pendiente' : 'rechazado'
  return {
    nombre: a.nombre,
    descripcion: a.descripcion,
    url: r.finalUrl,
    imagen: r.imagen,
    categorias: a.categorias || [],
    tags: a.tags || [],
    endpoints: a.endpoints || [],
    funcionalidades: a.funcionalidades || [],
    api: a.api || null,
    riesgo: a.riesgo,
    motivo_riesgo: a.motivo_riesgo,
    relevante: a.relevante,
    motivo_relevancia: a.motivo_relevancia,
    estado,
  }
}
