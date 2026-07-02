import { cronAuthorized } from '../../../../lib/auth'
import { chequearSitios } from '../../../../lib/link-check'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Revisa que los sitios del directorio sigan respondiendo y marca los caídos.
// Autorización: header x-cron-secret (tiempo constante) o sesión admin.
async function correr(req) {
  if (!(await cronAuthorized(req))) return Response.json({ error: 'No autorizado.' }, { status: 403 })
  const r = await chequearSitios()
  return Response.json(r)
}

export async function POST(req) {
  return correr(req)
}
export async function GET(req) {
  return correr(req)
}
