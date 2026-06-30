import { getAuthedUser, isAdmin } from '../../../../lib/auth'
import { mergeCategoria } from '../../../../lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req) {
  const user = await getAuthedUser()
  if (!isAdmin(user)) {
    return Response.json({ error: 'Solo admin.' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const de = (body?.de || '').toString().trim()
  const a = (body?.a || '').toString().trim()
  if (!de || !a) return Response.json({ error: 'Faltan "de" y "a".' }, { status: 400 })
  const merged = mergeCategoria(de, a)
  return Response.json({ merged })
}
