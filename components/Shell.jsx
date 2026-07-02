'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import DirectorioPanel from './DirectorioPanel'
import SiteAvatar from './SiteAvatar'
import { compartir } from '../lib/share'

// El modal (y Supabase adentro) solo se descarga cuando alguien toca "Agregar".
const AddModal = dynamic(() => import('./AddModal'), { ssr: false })

const norm = (s) => (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}
// Formatea fechas ISO (YYYY-MM-DD) de forma determinista; deja el resto como viene.
function fmtFecha(f) {
  if (!f) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f)
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}` : f
}

export default function Shell({ sitios: inicial, noticias }) {
  const [tab, setTab] = useState('directorio')
  const [sitios, setSitios] = useState(inicial)
  const [modal, setModal] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [dev, setDev] = useState(false)
  const [nvis, setNvis] = useState(10)
  const [nq, setNq] = useState('')

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => setIsAdmin(!!d.isAdmin))
      .catch(() => {})
    setDev(localStorage.getItem('vedirecto_dev') === '1')
    // PWA: con el service worker, el directorio abre aunque no haya señal.
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
    try {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'pagina' }),
        keepalive: true,
      })
    } catch {}
  }, [])

  const toggleDev = () => {
    setDev((v) => {
      const next = !v
      localStorage.setItem('vedirecto_dev', next ? '1' : '0')
      return next
    })
  }

  const onDeleted = (id) => setSitios((p) => p.filter((s) => s.id !== id))
  const onUpdated = (sitio) => setSitios((p) => p.map((s) => (s.id === sitio.id ? sitio : s)))

  const noticiasFiltradas = nq
    ? noticias.filter((n) => norm(`${n.titulo || ''} ${n.resumen || ''} ${n.fuente || ''}`).includes(norm(nq)))
    : noticias
  const noticiasMostradas = noticiasFiltradas.slice(0, nvis)
  useEffect(() => { setNvis(10) }, [nq])

  return (
    <div className="wrap">
      <div className="bar">
        <span className="wordmark">Ve<b>Directo</b></span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isAdmin && <a className="admin-link" href="/admin">Admin</a>}
          <button className="add-btn" onClick={() => setModal(true)}>+ Agregar sitio</button>
        </div>
      </div>

      <nav className="tabs">
        <button className={tab === 'directorio' ? 'tab active' : 'tab'} onClick={() => setTab('directorio')}>
          Directorio <span className="count">{sitios.length}</span>
        </button>
        {noticias.length > 0 && (
          <button className={tab === 'noticias' ? 'tab active' : 'tab'} onClick={() => setTab('noticias')}>
            Noticias <span className="count">{noticias.length}</span>
          </button>
        )}
      </nav>

      {tab === 'directorio' ? (
        <DirectorioPanel sitios={sitios} isAdmin={isAdmin} dev={dev} onDeleted={onDeleted} onUpdated={onUpdated} />
      ) : (
        <section>
          <h1 className="headline">Lo que está pasando</h1>
          {noticias.length > 5 && (
            <div className="searchbar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input className="search" placeholder="Buscar en noticias…" value={nq} onChange={(e) => setNq(e.target.value)} />
            </div>
          )}
          <div className="list">
            {noticiasMostradas.map((n) => <NewsCard key={n.id} n={n} />)}
            {noticias.length === 0 && <p className="empty">Todavía no hay noticias.</p>}
            {noticias.length > 0 && noticiasFiltradas.length === 0 && <p className="empty">Sin resultados.</p>}
          </div>
          {noticiasFiltradas.length > nvis && (
            <button className="load-more" onClick={() => setNvis((v) => v + 10)}>
              Ver más noticias <span>{noticiasFiltradas.length - nvis}</span>
            </button>
          )}
        </section>
      )}

      <footer className="foot">
        <div>Para IA: <code>/llms.txt</code> · <code>/api/sitios</code> · <code>/api/sitios.md</code> · <code>/api/noticias</code></div>
        <button className={dev ? 'dev-toggle on' : 'dev-toggle'} onClick={toggleDev} title="Muestra las APIs de los sitios en las tarjetas">
          {dev ? '◉ Modo developer' : '○ Modo developer'}
        </button>
      </footer>

      {modal && <AddModal onClose={() => setModal(false)} onAdded={(s) => setSitios((p) => [s, ...p])} />}
    </div>
  )
}

// Card de noticia: muestra el medio (con favicon) y la fecha; toda la card abre la nota.
function NewsCard({ n }) {
  const source = n.fuente || hostOf(n.url)
  const fecha = fmtFecha(n.fecha)
  const open = () => { if (n.url) window.open(n.url, '_blank', 'noopener,noreferrer') }
  return (
    <article
      className="card news-card"
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter') open() }}
      role={n.url ? 'link' : undefined}
      tabIndex={n.url ? 0 : undefined}
    >
      {(source || fecha) && (
        <div className="news-top">
          <SiteAvatar url={n.url} name={source} />
          {source && <span className="news-source">{source}</span>}
          {fecha && <span className="fecha">{fecha}</span>}
        </div>
      )}
      <h3>{n.titulo}</h3>
      {n.resumen && <p className="desc">{n.resumen}</p>}
      {n.url && (
        <div className="card-foot">
          <span className="news-read">Leer →</span>
          <button className="share-mini" onClick={(e) => { e.stopPropagation(); compartir({ titulo: n.titulo, url: n.url }) }}>
            ↗ Compartir
          </button>
        </div>
      )}
    </article>
  )
}
