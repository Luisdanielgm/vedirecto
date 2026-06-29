'use client'
import { useEffect, useState } from 'react'

export default function AdminPage() {
  const [ready, setReady] = useState(false)
  const [admin, setAdmin] = useState(false)
  const [sitios, setSitios] = useState([])
  const [urls, setUrls] = useState('')
  const [importing, setImporting] = useState(false)
  const [report, setReport] = useState(null)

  const loadSitios = () =>
    fetch('/api/admin/sitios').then((r) => (r.ok ? r.json() : [])).then(setSitios).catch(() => {})

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => {
        setAdmin(!!d.isAdmin)
        setReady(true)
        if (d.isAdmin) loadSitios()
      })
      .catch(() => setReady(true))
  }, [])

  const importar = async () => {
    const list = urls.split('\n').map((s) => s.trim()).filter(Boolean)
    if (!list.length) return
    setImporting(true)
    setReport(null)
    try {
      const r = await fetch('/api/admin/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: list }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        setReport(d)
        setUrls('')
        loadSitios()
      } else alert(d.error || 'Error en el import.')
    } finally {
      setImporting(false)
    }
  }

  const borrar = async (s) => {
    if (!confirm(`¿Borrar "${s.nombre}"?`)) return
    const r = await fetch(`/api/sitios/${s.id}`, { method: 'DELETE' })
    if (r.ok) loadSitios()
  }
  const reindex = async (s) => {
    const r = await fetch(`/api/sitios/${s.id}/reindex`, { method: 'POST' })
    if (r.ok) loadSitios()
    else alert('No se pudo reindexar.')
  }
  const cambiarEstado = async (s, estado) => {
    const r = await fetch(`/api/sitios/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    })
    if (r.ok) loadSitios()
  }

  if (!ready) return <div className="wrap"><p className="lead">Cargando…</p></div>
  if (!admin)
    return (
      <div className="wrap">
        <h1 className="headline">Admin</h1>
        <p className="lead">No autorizado. Iniciá sesión con la cuenta admin desde la <a className="visit" href="/">home</a>.</p>
      </div>
    )

  return (
    <div className="wrap">
      <div className="bar">
        <span className="wordmark">Ve<b>Directo</b> · admin</span>
        <a className="add-btn" href="/">← Volver</a>
      </div>

      <h1 className="headline">Panel admin</h1>

      <section className="admin-section">
        <h2>Importar por lotes</h2>
        <p className="lead">Pegá URLs (una por línea, hasta 25). Cada una pasa por el mismo análisis: seguridad, relevancia y dedup.</p>
        <textarea
          className="admin-ta"
          rows={6}
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder={'https://sitio1.org\nhttps://sitio2.app'}
        />
        <button className="add-btn" onClick={importar} disabled={importing}>
          {importing ? 'Importando…' : 'Importar'}
        </button>
        {report && (
          <div className="report">
            <p className="lead">{Object.entries(report.resumen).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
            <ul>
              {report.results.map((r, i) => (
                <li key={i}>
                  <b>{r.status}</b> — {r.url}
                  {r.nota ? ` · ${r.nota}` : ''}
                  {r.error ? ` · ${r.error}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="admin-section">
        <h2>Sitios ({sitios.length})</h2>
        <div className="list">
          {sitios.map((s) => (
            <article className="card" key={s.id}>
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <h3>{s.nombre}</h3>
                <span className={`estado ${s.estado}`}>{s.estado}</span>
              </div>
              <p className="desc">{s.url}</p>
              <div className="meta">
                {s.estado !== 'publicado' && <button className="del" onClick={() => cambiarEstado(s, 'publicado')}>Publicar</button>}
                {s.estado === 'publicado' && <button className="del" onClick={() => cambiarEstado(s, 'pendiente')}>Despublicar</button>}
                <button className="del" onClick={() => reindex(s)}>Reindexar</button>
                <button className="del" onClick={() => borrar(s)}>Borrar</button>
              </div>
            </article>
          ))}
          {sitios.length === 0 && <p className="empty">No hay sitios todavía.</p>}
        </div>
      </section>
    </div>
  )
}
