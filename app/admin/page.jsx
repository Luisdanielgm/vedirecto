'use client'
import { useEffect, useState } from 'react'

export default function AdminPage() {
  const [ready, setReady] = useState(false)
  const [admin, setAdmin] = useState(false)
  const [sitios, setSitios] = useState([])
  const [urls, setUrls] = useState('')
  const [importing, setImporting] = useState(false)
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(null)
  const [stats, setStats] = useState(null)
  const [audit, setAudit] = useState([])
  const [noticias, setNoticias] = useState([])
  const [noticiaUrl, setNoticiaUrl] = useState('')
  const [addingNoticia, setAddingNoticia] = useState(false)
  const [catDe, setCatDe] = useState('')
  const [catA, setCatA] = useState('')

  const loadSitios = () =>
    fetch('/api/admin/sitios').then((r) => (r.ok ? r.json() : [])).then(setSitios).catch(() => {})
  const loadStats = () =>
    fetch('/api/admin/stats').then((r) => (r.ok ? r.json() : null)).then(setStats).catch(() => {})
  const loadNoticias = () =>
    fetch('/api/admin/noticias').then((r) => (r.ok ? r.json() : [])).then(setNoticias).catch(() => {})
  const loadAudit = () =>
    fetch('/api/admin/audit').then((r) => (r.ok ? r.json() : [])).then(setAudit).catch(() => {})

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => {
        setAdmin(!!d.isAdmin)
        setReady(true)
        if (d.isAdmin) {
          loadSitios()
          loadStats()
          loadNoticias()
          loadAudit()
        }
      })
      .catch(() => setReady(true))
  }, [])

  const agregarNoticia = async () => {
    const u = noticiaUrl.trim()
    if (!u) return
    setAddingNoticia(true)
    try {
      const r = await fetch('/api/admin/noticias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        setNoticiaUrl('')
        loadNoticias()
      } else alert(d.error || 'No se pudo agregar la noticia.')
    } finally {
      setAddingNoticia(false)
    }
  }
  const borrarNoticia = async (n) => {
    if (!confirm(`¿Borrar "${n.titulo}"?`)) return
    const r = await fetch(`/api/admin/noticias/${n.id}`, { method: 'DELETE' })
    if (r.ok) loadNoticias()
  }

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
    setBusy(s.id)
    try {
      // Paso 1: preview (no guarda).
      const pr = await fetch(`/api/sitios/${s.id}/reindex`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preview: true }),
      })
      const pd = await pr.json().catch(() => ({}))
      if (!pr.ok || !pd.token) { alert(pd.error || 'No se pudo previsualizar.'); return }
      const a = pd.preview || {}
      const apiInfo = a.api?.tiene ? `API: sí (${(a.endpoints || []).length} endpoints)` : 'API: no'
      if (!confirm(`Reindex de "${a.nombre}"\nRiesgo: ${a.riesgo}\nCategorías: ${(a.categorias || []).join(', ')}\n${apiInfo}\n\n¿Guardar los cambios?`)) return
      // Paso 2: confirmar por token (sin re-analizar).
      const r = await fetch(`/api/sitios/${s.id}/reindex`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: pd.token }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.sitio) {
        alert(`Reindexado: riesgo "${d.sitio.riesgo}".${d.sitio.riesgo === 'seguro' ? ' Ya podés Publicarlo.' : ''}`)
        loadSitios()
      } else alert(d.error || 'No se pudo reindexar.')
    } finally {
      setBusy(null)
    }
  }
  const cambiarEstado = async (s, estado) => {
    const r = await fetch(`/api/sitios/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    })
    if (r.ok) loadSitios()
  }
  const fusionar = async () => {
    if (!catDe.trim() || !catA.trim()) return
    const r = await fetch('/api/admin/merge-categoria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ de: catDe.trim(), a: catA.trim() }),
    })
    const d = await r.json().catch(() => ({}))
    if (r.ok) {
      alert(`Fusionados ${d.merged} sitios: "${catDe}" → "${catA}"`)
      setCatDe('')
      setCatA('')
      loadSitios()
    } else alert(d.error || 'No se pudo fusionar.')
  }

  if (!ready) return <div className="wrap"><p className="lead">Cargando…</p></div>
  if (!admin)
    return (
      <div className="wrap">
        <h1 className="headline">Admin</h1>
        <p className="lead">No autorizado. Iniciá sesión con la cuenta admin desde la <a className="visit" href="/">home</a>.</p>
      </div>
    )

  const cats = [...new Set(sitios.flatMap((s) => s.categorias || []))].sort((a, b) => a.localeCompare(b, 'es'))

  return (
    <div className="wrap">
      <div className="bar">
        <span className="wordmark">Ve<b>Directo</b> · admin</span>
        <a className="add-btn" href="/">← Volver</a>
      </div>

      <h1 className="headline">Panel admin</h1>

      <section className="admin-section">
        <h2>Visitas</h2>
        {!stats ? (
          <p className="lead">Cargando métricas…</p>
        ) : (
          <>
            <div className="stats-row">
              <div className="stat"><span className="stat-n">{stats.total}</span><span className="stat-l">visitas a la página</span></div>
              <div className="stat"><span className="stat-n">{stats.totalClicks}</span><span className="stat-l">clics a sitios</span></div>
            </div>
            {stats.porDia?.length > 0 && (
              <div className="stats-dias">
                {stats.porDia.map((d) => (
                  <div className="dia" key={d.dia}><span>{d.dia.slice(5)}</span><b>{d.n}</b></div>
                ))}
              </div>
            )}
            {stats.topSitios?.length > 0 && (
              <div className="top-sitios">
                <div className="top-title">Más clickeados</div>
                {stats.topSitios.map((t, i) => (
                  <div className="top-row" key={i}><span>{t.nombre || '(borrado)'}</span><b>{t.n}</b></div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="admin-section">
        <h2>Accesos (auditoría)</h2>
        <p className="lead">Login y altas de usuarios registrados (email + IP). Solo para moderación y seguridad.</p>
        {audit.length === 0 ? (
          <p className="empty">Sin registros todavía.</p>
        ) : (
          <div className="report">
            <ul>
              {audit.map((a) => (
                <li key={a.id}>
                  <b>{a.accion}</b> — {a.email || 'anónimo'} · {a.ip || '—'}
                  {a.detalle ? ` · ${a.detalle}` : ''} · {a.creado}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

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
        <h2>Fusionar categorías</h2>
        <p className="lead">Uní una duplicada en otra (ej: "Personas Desaparecidas" → "Desaparecidos"). Instantáneo, sin gastar Cauce.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            list="cats-list"
            value={catDe}
            onChange={(e) => setCatDe(e.target.value)}
            placeholder="de (categoría a unir)"
            style={{ flex: '1 1 200px', minWidth: 0, padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '14px' }}
          />
          <span style={{ color: 'var(--muted)' }}>→</span>
          <input
            list="cats-list"
            value={catA}
            onChange={(e) => setCatA(e.target.value)}
            placeholder="a (categoría destino)"
            style={{ flex: '1 1 200px', minWidth: 0, padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '14px' }}
          />
          <datalist id="cats-list">{cats.map((c) => <option key={c} value={c} />)}</datalist>
          <button className="add-btn" onClick={fusionar}>Fusionar</button>
        </div>
        {cats.length > 0 && <p className="lead" style={{ marginTop: 10, fontSize: 13 }}>Actuales: {cats.join(' · ')}</p>}
      </section>

      <section className="admin-section">
        <h2>Sitios ({sitios.length})</h2>
        <div className="list">
          {sitios.map((s) => (
            <article className="card" key={s.id}>
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <h3>{s.nombre}</h3>
                <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {s.riesgo && s.riesgo !== 'seguro' && <span className="estado">{s.riesgo}</span>}
                  <span className={`estado ${s.estado}`}>{s.estado}</span>
                </span>
              </div>
              <p className="desc">{s.url}</p>
              <div className="meta">
                {s.estado !== 'publicado' && <button className="del" onClick={() => cambiarEstado(s, 'publicado')}>Publicar</button>}
                {s.estado === 'publicado' && <button className="del" onClick={() => cambiarEstado(s, 'pendiente')}>Despublicar</button>}
                <button className="del" onClick={() => reindex(s)} disabled={busy === s.id}>
                  {busy === s.id ? 'Reindexando…' : 'Reindexar'}
                </button>
                <button className="del" onClick={() => borrar(s)}>Borrar</button>
              </div>
            </article>
          ))}
          {sitios.length === 0 && <p className="empty">No hay sitios todavía.</p>}
        </div>
      </section>

      <section className="admin-section">
        <h2>Noticias ({noticias.length})</h2>
        <p className="lead">Pegá el link de una nota; la IA extrae título, resumen y fecha.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={noticiaUrl}
            onChange={(e) => setNoticiaUrl(e.target.value)}
            placeholder="https://medio.com/nota…"
            style={{ flex: 1, minWidth: 0, padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '14px' }}
          />
          <button className="add-btn" onClick={agregarNoticia} disabled={addingNoticia}>
            {addingNoticia ? 'Agregando…' : 'Agregar noticia'}
          </button>
        </div>
        <div className="list" style={{ marginTop: 14 }}>
          {noticias.map((n) => (
            <article className="card" key={n.id}>
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <h3>{n.titulo}</h3>
                {n.fecha && <span className="fecha">{n.fecha}</span>}
              </div>
              {n.resumen && <p className="desc">{n.resumen}</p>}
              <div className="meta">
                {n.url && <a className="visit" href={n.url} target="_blank" rel="noreferrer">Ver</a>}
                <button className="del" onClick={() => borrarNoticia(n)}>Borrar</button>
              </div>
            </article>
          ))}
          {noticias.length === 0 && <p className="empty">No hay noticias todavía.</p>}
        </div>
      </section>
    </div>
  )
}
