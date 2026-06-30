import { getAuthedUser, isAdmin } from '../../../../lib/auth'
import { listNoticias } from '../../../../lib/db'
import { ingestNoticia } from '../../../../lib/news'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  const user = await getAuthedUser()
  if (!isAdmin(user)) return Response.json({ error: 'Solo admin.' }, { status: 403 })
  return Response.json(listNoticias())
}

export async function POST(req) {
  const user = await getAuthedUser()
  if (!isAdmin(user)) return Response.json({ error: 'Solo el admin puede agregar noticias.' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const url = (body?.url || '').toString().trim()
  if (!url) return Response.json({ error: 'Falta "url".' }, { status: 400 })

  const r = await ingestNoticia(url)
  if (r.status === 'agregada') return Response.json({ noticia: r.noticia }, { status: 201 })
  if (r.status === 'duplicada') return Response.json({ error: 'Esa noticia ya está.' }, { status: 409 })
  return Response.json({ error: r.error || 'No se pudo agregar.' }, { status: 400 })
}
