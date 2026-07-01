import { cronAuthorized } from '../../../../lib/auth'
import { crawlTodas } from '../../../../lib/news-crawler'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Recorre las fuentes y agrega noticias nuevas.
// Autorización: header x-cron-secret == CRON_SECRET (tiempo constante), o sesión admin.
async function correr(req) {
  if (!(await cronAuthorized(req))) return Response.json({ error: 'No autorizado.' }, { status: 403 })
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
