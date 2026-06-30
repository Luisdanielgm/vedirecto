import { clientIp } from './ratelimit'
import { registrarAccion } from './db'

// Registra una acción de un usuario logueado (email + IP). Nunca rompe el flujo
// principal: si falla el log, se ignora.
export function logAccion(req, email, accion, detalle = '') {
  try {
    registrarAccion(email || null, clientIp(req), accion, detalle)
  } catch {}
}
