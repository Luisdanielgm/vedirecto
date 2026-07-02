import { readFileSync } from 'node:fs'
import { cronAuthorized } from '../../../../../lib/auth'
import { backupDb } from '../../../../../lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Descarga un snapshot FRESCO del SQLite. Pensado para que un cron EXTERNO lo
// baje fuera del VPS (un backup en el mismo volumen no es backup):
//   curl -H "x-cron-secret: $SECRET" https://vedirecto.es/api/cron/backup/download -o vedirecto.sqlite
// Autorización: header x-cron-secret (tiempo constante) o sesión admin.
export async function GET(req) {
  if (!(await cronAuthorized(req))) return Response.json({ error: 'No autorizado.' }, { status: 403 })
  try {
    const { archivo, ruta } = backupDb({ keep: 14 })
    const buf = readFileSync(ruta)
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${archivo}"`,
        'Content-Length': String(buf.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('backup download falló:', e?.message || e)
    return Response.json({ error: 'No se pudo generar el backup.' }, { status: 500 })
  }
}
