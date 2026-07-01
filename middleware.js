import { NextResponse } from 'next/server'

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// CSRF: en mutaciones de la API exigimos MISMO ORIGEN. El browser siempre manda
// el header Origin en peticiones cross-site, y no puede falsearlo; si no coincide
// con nuestro host, lo rechazamos. Excepción: /api/cron/* son server-to-server
// (sin Origin) y ya están protegidos por CRON_SECRET.
export function middleware(req) {
  const { pathname } = req.nextUrl
  if (MUTATING.has(req.method) && !pathname.startsWith('/api/cron/')) {
    const origin = req.headers.get('origin')
    // Hosts aceptados: el canónico (SITE_URL) + el reenviado por el proxy + el
    // propio. Incluir SITE_URL evita cortar TODO el alta si Traefik no manda
    // x-forwarded-host (si no, caería al host interno y nunca matchearía).
    const expected = new Set()
    try { if (process.env.SITE_URL) expected.add(new URL(process.env.SITE_URL).host) } catch {}
    const xfh = req.headers.get('x-forwarded-host')
    if (xfh) expected.add(xfh)
    const host = req.headers.get('host')
    if (host) expected.add(host)
    let originHost = null
    try {
      originHost = origin ? new URL(origin).host : null
    } catch {}
    if (!originHost || !expected.has(originHost)) {
      return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 })
    }
  }
  return NextResponse.next()
}

export const config = { matcher: '/api/:path*' }
