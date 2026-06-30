import { getAuthedUser, isAdmin } from '../../../../lib/auth'
import { listFuentes, addFuente } from '../../../../lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getAuthedUser()
  if (!isAdmin(user)) return Response.json({ error: 'Solo admin.' }, { status: 403 })
  return Response.json(listFuentes())
}

export async function POST(req) {
  const user = await getAuthedUser()
  if (!isAdmin(user)) return Response.json({ error: 'Solo admin.' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const url = (body?.url || '').toString().trim()
  if (!url) return Response.json({ error: 'Falta "url".' }, { status: 400 })
  const { changed } = addFuente(url, (body?.nombre || '').toString().trim() || null)
  return Response.json({ ok: true, changed }, { status: 201 })
}
