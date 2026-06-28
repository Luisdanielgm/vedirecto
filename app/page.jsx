import { listSitios, listNoticias } from '../lib/db'
import Directorio from '../components/Directorio'

export const dynamic = 'force-dynamic' // siempre lee la DB fresca

export default function Home() {
  const sitios = listSitios()
  const noticias = listNoticias()

  return (
    <div className="wrap">
      <header className="top">
        <h1>VeDirecto</h1>
        <p>Directorio de sitios de ayuda · Venezuela</p>
      </header>

      <div className="cols">
        <section>
          <Directorio inicial={sitios} />
        </section>

        <section>
          <div className="col-head">
            <h2>Noticias</h2>
            <span className="count">{noticias.length}</span>
          </div>
          <div className="list">
            {noticias.map((n) => (
              <article className="card" key={n.id}>
                <div className="row">
                  <h3>{n.titulo}</h3>
                  {n.fecha && <span className="fecha">{n.fecha}</span>}
                </div>
                {n.resumen && <p className="desc">{n.resumen}</p>}
                {n.url ? <a href={n.url} target="_blank" rel="noreferrer">Leer ↗</a> : <span className="fecha">{n.fuente}</span>}
              </article>
            ))}
            {noticias.length === 0 && <p className="empty">Todavía no hay noticias.</p>}
          </div>
        </section>
      </div>

      <footer className="foot">
        Para IA: <code>/llms.txt</code> · <code>/api/sitios</code> · <code>/api/sitios.md</code> · <code>/api/noticias</code>
      </footer>
    </div>
  )
}
