import { getAuthedUser, isAdmin } from '../../../../../lib/auth'
import { deleteFuente } from '../../../../../lib/db'

export const dynamic = 'force-dynamic'

export async function DELETE(_req, { params }) {
  const user = await getAuthedUser()
  if (!isAdmin(user)) return Response.json({ error: 'Solo admin.' }, { status: 403 })
  const { id } = await params
  const ok = deleteFuente(Number(id))
  return Response.json({ deleted: ok }, { status: ok ? 200 : 404 })
}
