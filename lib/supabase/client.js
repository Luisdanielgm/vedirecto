import { createBrowserClient } from '@supabase/ssr'

// Cliente de Supabase para el browser (misma convención que cauce).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
}
