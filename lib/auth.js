import { timingSafeEqual } from 'node:crypto'
import { createClient } from './supabase/server'

// Usuario logueado (o null). Falla cerrado.
export async function getAuthedUser() {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return data?.user ?? null
  } catch {
    return null
  }
}

// Admin = el email logueado coincide con ADMIN_EMAIL (env de runtime, no se hornea)
// Y además el email está VERIFICADO y viene por Google. Esto evita que, si el
// proyecto Supabase tiene signup por email activo, alguien registre ADMIN_EMAIL
// por otro proveedor y escale a admin.
export function isAdmin(user) {
  const admin = process.env.ADMIN_EMAIL
  if (!admin || !user?.email) return false
  if (user.email.toLowerCase() !== admin.toLowerCase()) return false
  const verified = !!(user.email_confirmed_at || user.confirmed_at || user.user_metadata?.email_verified)
  const providers = user.app_metadata?.providers || []
  const viaGoogle = user.app_metadata?.provider === 'google' || providers.includes('google')
  return verified && viaGoogle
}

// Compara el CRON_SECRET en tiempo constante. Solo por header (nunca query string,
// que quedaría en logs de proxy/CDN).
function cronSecretOk(req) {
  const secret = process.env.CRON_SECRET
  const provided = req.headers.get('x-cron-secret') || ''
  if (!secret || !provided) return false
  const a = Buffer.from(secret)
  const b = Buffer.from(provided)
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// Autoriza /api/cron/*: header x-cron-secret válido, o sesión admin.
export async function cronAuthorized(req) {
  if (cronSecretOk(req)) return true
  return isAdmin(await getAuthedUser())
}
