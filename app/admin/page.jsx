'use client'
import { useEffect, useState } from 'react'
import PreviewCard from '../../components/PreviewCard'

// Caído = no conecta / no existe / servidor roto. Un 403/401/429 NO cuenta
// (bloqueo de bots). Debe coincidir con esCaido() de lib/link-check.js.
const esCaido = (st) => st === 0 || st === 404 || st === 410 || st >= 500

// Resumen "agregado: 3 · saltado: 2 · duplicado: 1" para el cierre de la cola.
function resumenEstados(res) {
  const c = {}
  for (const r of res) c[r.status] = (c[r.status] || 0) + 1
  return Object.entries(c).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'sin resultados'
}

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
  const [fuentes, setFuentes] = useState([])
  const [fuenteUrl, setFuenteUrl] = useState('')
  const [fuenteNombre, setFuenteNombre] = useState('')
  const [refrescando, setRefrescando] = useState(false)
  const [revisando, setRevisando] = useState(false)
  // Cola de revisión 1-por-1 del batch (analiza lazy cada URL al llegar a ella).
  const [colaUrls, setColaUrls] = useState(null) // array activo, o null = inactiva
  const [colaIdx, setColaIdx] = useState(0)
  const [colaCur, setColaCur] = useState(null) // preview de la URL actual
  const [colaLoading, setColaLoading] = useState(false)
  const [colaSaving, setColaSaving] = useState(false)
  const [colaRes, setColaRes] = useState([]) // [{url, status}]

  const loadSitios = () =>
    fetch('/api/admin/sitios').then((r) => (r.ok ? r.json() : [])).then(setSitios).catch(() => {})
  const loadStats = () =>
    fetch('/api/admin/stats').then((r) => (r.ok ? r.json() : null)).then(setStats).catch(() => {})
  const loadNoticias = () =>
    fetch('/api/admin/noticias').then((r) => (r.ok ? r.json() : [])).then(setNoticias).catch(() => {})
  const loadAudit = () =>
    fetch('/api/admin/audit').then((r) => (r.ok ? r.json() : [])).then(setAudit).catch(() => {})
  const loadFuentes = () =>
    fetch('/api/admin/fuentes').then((r) => (r.ok ? r.json() : [])).then(setFuentes).catch(() => {})

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
          loadFuentes()
        }
      })
      .catch(() => setReady(true))
  }, [])

  const agregarFuente = async () => {
    const u = fuenteUrl.trim()
    if (!u) return
    const r = await fetch('/api/admin/fuentes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: u, nombre: fuenteNombre.trim() }),
    })
    if (r.ok) {
      setFuenteUrl('')
      setFuenteNombre('')
      loadFuentes()
    } else {
      const d = await r.json().catch(() => ({}))
      alert(d.error || 'No se pudo agregar la fuente.')
    }
  }
  const borrarFuente = async (f) => {
    if (!confirm(`¿Borrar la fuente "${f.nombre || f.url}"?`)) return
    const r = await fetch(`/api/admin/fuentes/${f.id}`, { method: 'DELETE' })
    if (r.ok) loadFuentes()
  }
  const refrescarNoticias = async () => {
    setRefrescando(true)
    try {
      const r = await fetch('/api/cron/noticias', { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        alert(`Listo: ${d.total ?? 0} noticias nuevas.`)
        loadNoticias()
        loadFuentes()
      } else alert(d.error || 'No se pudo refrescar.')
    } finally {
      setRefrescando(false)
    }
  }

  const revisarEnlaces = async () => {
    setRevisando(true)
    try {
      const r = await fetch('/api/cron/enlaces', { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        alert(`Revisados: ${d.revisados ?? 0} · caídos: ${d.caidos ?? 0}${d.caidos ? '\n\n' + d.lista.map((x) => `• ${x.nombre} (HTTP ${x.status})`).join('\n') : ''}`)
        loadSitios()
      } else alert(d.error || 'No se pudo revisar.')
    } finally {
      setRevisando(false)
    }
  }

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

  // --- Cola de revisión 1-por-1 ---
  const iniciarCola = () => {
    const seen = new Set()
    const list = []
    for (const raw of urls.split('\n').map((s) => s.trim()).filter(Boolean)) {
      const k = raw.toLowerCase().replace(/\/+$/, '')
      if (seen.has(k)) continue
      seen.add(k)
      list.push(raw)
    }
    if (!list.length) return
    setReport(null)
    setColaRes([])
    setColaCur(null)
    setColaIdx(0)
    setColaUrls(list)
  }

  // Analiza la URL actual recién cuando se llega a ella (no las 25 de golpe).
  useEffect(() => {
    if (!colaUrls || colaIdx >= colaUrls.length || colaCur || colaLoading) return
    let cancel = false
    setColaLoading(true)
    fetch('/api/sitios/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: colaUrls[colaIdx] }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, http: r.status, d })))
      .then(({ ok, http, d }) => {
        if (cancel) return
        setColaCur(ok ? d : { status: 'error', error: d.error || `Error ${http}` })
      })
      .catch(() => { if (!cancel) setColaCur({ status: 'error', error: 'Error de red.' }) })
      .finally(() => { if (!cancel) setColaLoading(false) })
    return () => { cancel = true }
  }, [colaUrls, colaIdx, colaCur, colaLoading])

  const avanzarCola = (estado) => {
    setColaRes((prev) => [...prev, { url: colaUrls[colaIdx], status: estado }])
    setColaCur(null)
    setColaIdx((i) => i + 1)
  }
  const agregarCola = async () => {
    if (!colaCur?.token) return
    setColaSaving(true)
    try {
      const r = await fetch('/api/sitios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: colaCur.token }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) loadSitios()
      avanzarCola(r.ok ? 'agregado' : (d.riesgo || 'error'))
    } finally {
      setColaSaving(false)
    }
  }
  const cerrarCola = () => {
    setColaUrls(null)
    setColaIdx(0)
    setColaCur(null)
    setColaRes([])
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
              <div className="stat"><span className="stat-n">{stats.unicosHoy ?? 0}</span><span className="stat-l">visitantes únicos hoy</span></div>
              <div className="stat"><span className="stat-n">{stats.totalClicks}</span><span className="stat-l">clics a sitios</span></div>
            </div>
            {stats.porDia?.length > 0 && (
              <div className="stats-dias">
                {stats.porDia.map((d) => (
                  <div className="dia" key={d.dia} title={`${d.u ?? 0} visitantes únicos`}><span>{d.dia.slice(5)}</span><b>{d.n}</b>{d.u != null && <small>{d.u} únicos</small>}</div>
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
        {colaUrls ? (
          colaIdx >= colaUrls.length ? (
            <div className="report">
              <p className="lead">Cola terminada. {resumenEstados(colaRes)}</p>
              <ul>
                {colaRes.map((r, i) => <li key={i}><b>{r.status}</b> — {r.url}</li>)}
              </ul>
              <button className="add-btn" onClick={cerrarCola}>Cerrar</button>
            </div>
          ) : (
            <div>
              <p className="lead">
                Revisando <b>{colaIdx + 1} / {colaUrls.length}</b> · <span className="preview-url">{colaUrls[colaIdx]}</span>
              </p>
              {colaLoading || !colaCur ? (
                <p className="lead">Analizando…</p>
              ) : (
                <PreviewCard data={colaCur}>
                  <div className="preview-actions">
                    <button className="del" onClick={() => avanzarCola('saltado')} disabled={colaSaving}>Saltar</button>
                    {colaCur.status === 'ok' ? (
                      <button className="add-btn" onClick={agregarCola} disabled={colaSaving}>{colaSaving ? 'Agregando…' : 'Agregar'}</button>
                    ) : (
                      <span className="hint">No se agrega ({colaCur.status}).</span>
                    )}
                  </div>
                </PreviewCard>
              )}
              <div style={{ marginTop: 12 }}>
                <button className="del" onClick={cerrarCola}>Terminar cola</button>
              </div>
            </div>
          )
        ) : (
          <>
            <p className="lead">Pegá URLs (una por línea, hasta 25). Cada una pasa por el mismo análisis: seguridad, relevancia y dedup.</p>
            <textarea
              className="admin-ta"
              rows={6}
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder={'https://sitio1.org\nhttps://sitio2.app'}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="add-btn" onClick={importar} disabled={importing}>
                {importing ? 'Importando…' : 'Importar directo'}
              </button>
              <button className="add-btn" onClick={iniciarCola} style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--border-strong)' }}>
                Revisar 1 por 1
              </button>
            </div>
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
          </>
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
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          Sitios ({sitios.length})
          <button className="del" onClick={revisarEnlaces} disabled={revisando} style={{ fontSize: 13 }}>
            {revisando ? 'Revisando…' : '↻ Revisar enlaces'}
          </button>
        </h2>
        <div className="list">
          {sitios.map((s) => (
            <article className="card" key={s.id}>
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <h3>{s.nombre}</h3>
                <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {esCaido(s.http_status) && (
                    <span className="estado rechazado" title={`Último chequeo: ${s.ultimo_check || '—'}`}>caído {s.http_status}</span>
                  )}
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

      <section className="admin-section">
        <h2>Fuentes de noticias ({fuentes.length})</h2>
        <p className="lead">Medios cuya portada se revisa para traer notas del terremoto. <b>Refrescar</b> recorre todas y agrega lo nuevo (un cron puede hacerlo solo).</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={fuenteUrl}
            onChange={(e) => setFuenteUrl(e.target.value)}
            placeholder="https://medio.com (portada o sección terremoto)"
            style={{ flex: '2 1 240px', minWidth: 0, padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '14px' }}
          />
          <input
            value={fuenteNombre}
            onChange={(e) => setFuenteNombre(e.target.value)}
            placeholder="nombre (opcional)"
            style={{ flex: '1 1 140px', minWidth: 0, padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '14px' }}
          />
          <button className="add-btn" onClick={agregarFuente}>Agregar fuente</button>
          <button className="add-btn" onClick={refrescarNoticias} disabled={refrescando} style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--border-strong)' }}>
            {refrescando ? 'Refrescando…' : '↻ Refrescar noticias'}
          </button>
        </div>
        <div className="list" style={{ marginTop: 14 }}>
          {fuentes.map((f) => (
            <article className="card" key={f.id}>
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <h3>{f.nombre || f.url}</h3>
                <button className="del" onClick={() => borrarFuente(f)}>Borrar</button>
              </div>
              <p className="desc">{f.url}{f.ultimo ? ` · último: ${f.ultimo.slice(0, 16).replace('T', ' ')}` : ''}</p>
            </article>
          ))}
          {fuentes.length === 0 && <p className="empty">No hay fuentes. Agregá una (ej: la portada de un medio).</p>}
        </div>
      </section>
    </div>
  )
}
