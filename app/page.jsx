import { listSitios, listNoticias } from '../lib/db'
import Shell from '../components/Shell'

export const dynamic = 'force-dynamic' // siempre lee la DB fresca

export default function Home() {
  return <Shell sitios={listSitios()} noticias={listNoticias()} />
}
