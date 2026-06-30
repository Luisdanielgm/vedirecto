import { getAuthedUser, isAdmin } from '../../../../lib/auth'
import { crawlTodas } from '../../../../lib/news-crawler'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Recorre las fuentes y agrega noticias nuevas.
// Autorización: header x-cron-secret (o ?secret=) == CRON_SECRET, o sesión admin.
async function autorizado(req) {
  const secret = process.env.CRON_SECRET
  const provided = req.headers.get('x-cron-secret') || new URL(req.url).searchParams.get('secret') || ''
  if (secret && provided && provided === secret) return true
  const user = await getAuthedUser()
  return isAdmin(user)
}

async function correr(req) {
  if (!(await autorizado(req))) return Response.json({ error: 'No autorizado.' }, { status: 403 })
  const fuentes = await crawlTodas()
  const total = fuentes.reduce((a, r) => a + (r.agregadas || 0), 0)
  return Response.json({ total, fuentes })
}

export async function POST(req) {
  return correr(req)
}
export async function GET(req) {
  return correr(req)
}
