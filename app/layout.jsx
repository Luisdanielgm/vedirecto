import './globals.css'

export const metadata = {
  title: 'VeDirecto · Venezuela',
  description: 'Directorio de sitios y aplicaciones de ayuda, con noticias. Buscá, filtrá y agregá sitios.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
