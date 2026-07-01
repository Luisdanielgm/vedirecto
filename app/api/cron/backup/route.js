import { getAuthedUser, isAdmin } from '../../../../lib/auth'
import { backupDb } from '../../../../lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Snapshot del SQLite al volumen (DATA_DIR/backups), con rotación.
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
  const keep = Number(new URL(req.url).searchParams.get('keep')) || 14
  try {
    const r = backupDb({ keep })
    return Response.json({ ok: true, ...r })
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || 'Falló el backup.' }, { status: 500 })
  }
}

export async function POST(req) {
  return correr(req)
}
export async function GET(req) {
  return correr(req)
}
