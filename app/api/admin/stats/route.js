import { getAuthedUser, isAdmin } from '../../../../lib/auth'
import { estadisticas } from '../../../../lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getAuthedUser()
  if (!isAdmin(user)) return Response.json({ error: 'Solo admin.' }, { status: 403 })
  return Response.json(estadisticas())
}
