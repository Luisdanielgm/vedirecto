import { getAuthedUser, isAdmin } from '../../../../lib/auth'
import { deleteSitio, setEstado } from '../../../../lib/db'

export const dynamic = 'force-dynamic'

export async function DELETE(_req, { params }) {
  const user = await getAuthedUser()
  if (!isAdmin(user)) {
    return Response.json({ error: 'Solo el admin puede borrar sitios.' }, { status: 403 })
  }
  const { id } = await params
  const ok = deleteSitio(Number(id))
  return Response.json({ deleted: ok }, { status: ok ? 200 : 404 })
}

// Aprobar/rechazar (cambiar estado) — admin.
export async function PATCH(req, { params }) {
  const user = await getAuthedUser()
  if (!isAdmin(user)) {
    return Response.json({ error: 'Solo el admin.' }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const estado = body?.estado
  if (!['publicado', 'pendiente', 'rechazado'].includes(estado)) {
    return Response.json({ error: 'estado inválido.' }, { status: 400 })
  }
  const ok = setEstado(Number(id), estado)
  return Response.json({ ok }, { status: ok ? 200 : 404 })
}
