import { cronAuthorized } from '../../../../lib/auth'
import { backupDb, podarVisitas, podarAuditoria } from '../../../../lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Snapshot del SQLite al volumen (DATA_DIR/backups) + poda de datos viejos.
// Autorización: header x-cron-secret == CRON_SECRET (tiempo constante), o sesión admin.
async function correr(req) {
  if (!(await cronAuthorized(req))) return Response.json({ error: 'No autorizado.' }, { status: 403 })
  const keep = Number(new URL(req.url).searchParams.get('keep')) || 14
  try {
    const r = backupDb({ keep })
    const visitasPodadas = podarVisitas(90)
    const auditoriaPodada = podarAuditoria(180)
    return Response.json({ ok: true, ...r, visitasPodadas, auditoriaPodada })
  } catch (e) {
    console.error('backup falló:', e?.message || e)
    return Response.json({ ok: false, error: 'No se pudo completar el backup.' }, { status: 500 })
  }
}

export async function POST(req) {
  return correr(req)
}
export async function GET(req) {
  return correr(req)
}
