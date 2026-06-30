import { registrarVisita } from '../../../lib/db'

export const dynamic = 'force-dynamic'

// Registra una visita de página o un clic a un sitio. Público, sin datos personales.
export async function POST(req) {
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
    registrarVisita(tipo, sitioId)
  } catch {}
  return new Response(null, { status: 204 })
}
