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

// Admin = el email logueado coincide con ADMIN_EMAIL (env de runtime, no se hornea).
export function isAdmin(user) {
  const admin = process.env.ADMIN_EMAIL
  return !!(admin && user?.email && user.email.toLowerCase() === admin.toLowerCase())
}
