import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Cabeceras de seguridad para TODAS las rutas. frame-ancestors 'none' +
// X-Frame-Options: DENY = anti-clickjacking. CSP como defensa en profundidad
// (React ya escapa; no usamos dangerouslySetInnerHTML).
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: https:", // favicons (Google s2) y og:image de sitios externos
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co", // auth de Supabase desde el cliente
].join('; ')

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // imagen Docker chica (estilo Dokploy)
  // Hay varios lockfiles en árboles superiores (OneDrive); fijamos la raíz
  // de tracing a este proyecto para que el standalone quede en .next/standalone.
  outputFileTracingRoot: __dirname,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  },
}

export default nextConfig
