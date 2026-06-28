import './globals.css'
import { Playfair_Display } from 'next/font/google'

const serif = Playfair_Display({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-serif',
  display: 'swap',
})

export const metadata = {
  title: 'VeDirecto · Venezuela',
  description: 'Directorio de sitios y aplicaciones de ayuda, con noticias. Buscá, filtrá y agregá sitios.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={serif.variable}>
      <body>{children}</body>
    </html>
  )
}
