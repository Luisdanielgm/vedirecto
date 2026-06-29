import { getAuthedUser, isAdmin } from '../../../../lib/auth'
import { listAllSitios } from '../../../../lib/db'

export const dynamic = 'force-dynamic'

// Todos los sitios (incl. pendientes/rechazados) para el dashboard admin.
export async function GET() {
  const user = await getAuthedUser()
  if (!isAdmin(user)) {
    return Response.json({ error: 'Solo admin.' }, { status: 403 })
  }
  return Response.json(listAllSitios())
}
