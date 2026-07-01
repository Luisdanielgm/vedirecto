import { createHash } from 'node:crypto'
import { registrarVisita } from '../../../lib/db'
import { clientIp, rateLimit } from '../../../lib/ratelimit'

export const dynamic = 'force-dynamic'

// Identificador de visitante para contar ÚNICOS sin guardar la IP: hash NO
// reversible sha256(salt | día | ip), truncado. Rota cada día (no se puede
// correlacionar a la misma persona entre días). Esto NO es un registro de IPs.
function visitanteHash(req) {
  try {
    const ip = clientIp(req)
    const dia = new Date().toISOString().slice(0, 10)
    const salt = process.env.VISIT_SALT || 'vedirecto'
    return createHash('sha256').update(`${salt}|${dia}|${ip}`).digest('hex').slice(0, 16)
  } catch {
    return null
  }
}

// Registra una visita de página o un clic a un sitio. Público, sin datos personales.
export async function POST(req) {
  // Límite generoso anti-spam: evita que inflen la tabla `visitas`. Un humano
  // navegando no lo roza; un bot machacando el endpoint, sí. Clave namespaced
  // ('track:') para no compartir contador con el alta de sitios.
  const rl = rateLimit(`track:${clientIp(req)}`, { max: 120, windowMs: 60 * 1000 })
  if (!rl.ok) return new Response(null, { status: 204 }) // se descarta en silencio

  let b
  try {
    b = await req.json()
  } catch {
    return new Response(null, { status: 400 })
  }
  const tipo = b?.tipo === 'click' ? 'click' : b?.tipo === 'pagina' ? 'pagina' : null
  if (!tipo) return new Response(null, { status: 400 })
  const sitioId = Number.isInteger(b?.sitioId) ? b.sitioId : null
  try {
    registrarVisita(tipo, sitioId, visitanteHash(req))
  } catch {}
  return new Response(null, { status: 204 })
}
