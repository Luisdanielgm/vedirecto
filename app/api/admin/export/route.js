import { getAuthedUser, isAdmin } from '../../../../lib/auth'
import { listAllSitios, listNoticias } from '../../../../lib/db'

export const dynamic = 'force-dynamic'

// Backup manual: descarga TODO (sitios incl. pendientes + noticias) como JSON.
export async function GET() {
  const user = await getAuthedUser()
  if (!isAdmin(user)) {
    return Response.json({ error: 'Solo admin.' }, { status: 403 })
  }
  const data = {
    generado: new Date().toISOString(),
    sitios: listAllSitios(),
    noticias: listNoticias(),
  }
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="vedirecto-backup.json"',
      'Cache-Control': 'no-store, private', // datos internos: nunca cachear
    },
  })
}
