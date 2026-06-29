'use client'
import { useState } from 'react'
import DirectorioPanel from './DirectorioPanel'

export default function Shell({ sitios: inicial, noticias }) {
  const [tab, setTab] = useState('directorio')
  const [sitios, setSitios] = useState(inicial)
  const [modal, setModal] = useState(false)

  return (
    <div className="wrap">
      <div className="bar">
        <span className="wordmark">Ve<b>Directo</b></span>
        <button className="add-btn" onClick={() => setModal(true)}>+ Agregar sitio</button>
      </div>

      <nav className="tabs">
        <button className={tab === 'directorio' ? 'tab active' : 'tab'} onClick={() => setTab('directorio')}>
          Directorio <span className="count">{sitios.length}</span>
        </button>
        <button className={tab === 'noticias' ? 'tab active' : 'tab'} onClick={() => setTab('noticias')}>
          Noticias <span className="count">{noticias.length}</span>
        </button>
      </nav>

      {tab === 'directorio' ? (
        <DirectorioPanel sitios={sitios} />
      ) : (
        <section>
          <h1 className="headline">Lo que está pasando</h1>
          <div className="list">
            {noticias.map((n) => (
              <article className="card" key={n.id}>
                <div className="row">
                  <h3>{n.titulo}</h3>
                  {n.fecha && <span className="fecha">{n.fecha}</span>}
                </div>
                {n.resumen && <p className="desc">{n.resumen}</p>}
                {n.url && <div className="meta"><a className="visit" href={n.url} target="_blank" rel="noreferrer">Leer</a></div>}
              </article>
            ))}
            {noticias.length === 0 && <p className="empty">Todavía no hay noticias.</p>}
          </div>
        </section>
      )}

      <footer className="foot">
        Para IA: <code>/llms.txt</code> · <code>/api/sitios</code> · <code>/api/sitios.md</code> · <code>/api/noticias</code>
      </footer>

      {modal && <AddModal onClose={() => setModal(false)} onAdded={(s) => setSitios((p) => [s, ...p])} />}
    </div>
  )
}

function AddModal({ onClose, onAdded }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch('/api/sitios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await r.json().catch(() => ({}))
      if (r.ok) {
        setMsg({ tipo: 'ok', texto: `"${data.sitio?.nombre || 'Sitio'}" agregado.` })
        if (data.sitio) onAdded(data.sitio)
        setUrl('')
      } else {
        setMsg({ tipo: 'err', texto: data.error || `No se pudo agregar (${r.status}).` })
      }
    } catch {
      setMsg({ tipo: 'err', texto: 'Error de red.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Agregar sitio</h2>
        <p className="hint">Pega el link. Un análisis automático extrae los datos y revisa que sea seguro.</p>
        <form className="modal-form" onSubmit={submit}>
          <input type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
          <button type="submit" disabled={busy}>{busy ? 'Analizando…' : 'Agregar'}</button>
        </form>
        {msg && <p className={`modal-msg ${msg.tipo}`}>{msg.texto}</p>}
        <div className="modal-close"><button type="button" onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  )
}
