import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { logAccion } from '../../../lib/audit'

// Vuelta del OAuth de Google: intercambia el code por sesión y vuelve al home.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Detrás de Traefik/Dokploy, request.url trae el host interno (0.0.0.0:3000).
  // Usamos el host reenviado para que el redirect caiga en el dominio público.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const base = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const email = data?.user?.email || data?.session?.user?.email || null
      logAccion(request, email, 'login')
      return NextResponse.redirect(`${base}/`)
    }
  }
  return NextResponse.redirect(`${base}/?auth=error`)
}
