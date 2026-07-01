// Genera /robots.txt. Invita a los crawlers al directorio público, pero deja
// fuera el panel admin. Apunta al sitemap para descubrimiento.
const BASE = 'https://vedirecto.es'

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/admin'],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
