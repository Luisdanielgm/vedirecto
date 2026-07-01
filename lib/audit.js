import { createHash } from 'node:crypto'
import { clientIp } from './ratelimit'
import { registrarAccion } from './db'

// Hash NO reversible de la IP (mismo criterio de privacidad que las visitas). Así
// el log de auditoría sirve para correlacionar abuso SIN guardar la IP cruda del
// colaborador: si la DB se filtra, no doxxeás a quien ayudó a cargar sitios.
function ipHash(req) {
  try {
    const salt = process.env.VISIT_SALT || 'vedirecto'
    return 'ip_' + createHash('sha256').update(`${salt}|${clientIp(req)}`).digest('hex').slice(0, 16)
  } catch {
    return null
  }
}

// Registra una acción de un usuario logueado (email + hash de IP). Nunca rompe el
// flujo principal: si falla el log, se ignora.
export function logAccion(req, email, accion, detalle = '') {
  try {
    registrarAccion(email || null, ipHash(req), accion, detalle)
  } catch {}
}
