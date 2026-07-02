// Manifest PWA: hace el sitio instalable (pantalla de inicio) y habilita el
// modo standalone. Next lo sirve en /manifest.webmanifest y lo linkea solo.
export default function manifest() {
  return {
    name: 'VeDirecto — Ayuda Venezuela',
    short_name: 'VeDirecto',
    description: 'Directorio de sitios de ayuda y noticias del terremoto de Venezuela 2026.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  }
}
