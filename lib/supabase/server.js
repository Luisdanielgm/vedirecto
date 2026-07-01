import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Cliente de Supabase para el servidor (lee/escribe cookies de sesión).
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            // Reforzamos SameSite=Lax y Secure (en prod) sin tocar httpOnly (que
            // el cliente de Supabase necesita gestionar). No dependemos de defaults.
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                sameSite: options?.sameSite ?? 'lax',
                secure: options?.secure ?? (process.env.NODE_ENV === 'production'),
              })
            )
          } catch {
            // Llamado desde un Server Component: se ignora.
          }
        },
      },
    }
  )
}
