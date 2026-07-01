// Genera /sitemap.xml. El directorio es una sola página pública; sumamos los
// endpoints legibles por máquina para que buscadores e IAs los descubran.
const BASE = 'https://vedirecto.es'

export default function sitemap() {
  const now = new Date()
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/llms.txt`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${BASE}/api/sitios.md`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${BASE}/api/noticias.md`, lastModified: now, changeFrequency: 'daily', priority: 0.4 },
  ]
}
