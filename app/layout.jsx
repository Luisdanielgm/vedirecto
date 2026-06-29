import './globals.css'

export const metadata = {
  metadataBase: new URL('https://vedirecto.es'),
  title: 'VeDirecto · Venezuela',
  description: 'Directorio de sitios y aplicaciones de ayuda para la emergencia del terremoto de Venezuela. Buscá, filtrá y agregá sitios.',
  openGraph: {
    title: 'VeDirecto · Venezuela',
    description: 'Directorio de sitios de ayuda para la emergencia del terremoto de Venezuela.',
    url: 'https://vedirecto.es',
    siteName: 'VeDirecto',
    locale: 'es_VE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VeDirecto · Venezuela',
    description: 'Directorio de sitios de ayuda para la emergencia del terremoto de Venezuela.',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
