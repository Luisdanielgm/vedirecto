'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import SiteAvatar from './SiteAvatar'
import { compartir } from '../lib/share'

const PAGE = 12

const norm = (s) =>
  (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Paleta propia para las categorías (color estable por nombre).
const PALETTE = ['#e0b341', '#6ba3e0', '#e07a9b', '#5bc08a', '#c98ae0', '#e0915b', '#5bc0c0', '#d96b6b', '#8aa0e0', '#aab0b8']
function colorFor(cat) {
  let h = 0
  for (const ch of cat) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

// URL sondeable para un endpoint ("GET /api/x" + base_url → absoluta).
function probeUrlFor(ep, base) {
  const s = String(ep || '').replace(/^\s*(GET|POST|PUT|DELETE|PATCH)\s+/i, '').trim()
  const abs = s.match(/https?:\/\/\S+/)
  if (abs) return abs[0]
  if (base && s.startsWith('/')) { try { return new URL(s, base).toString() } catch {} }
  return null
}

// Botón de test en vivo (modo developer): sondea la URL vía /api/probe (proxy server-side, sin CORS).
function ApiProbe({ url }) {
  const [st, setSt] = useState(null)
  if (!url) return null
  const run = async (e) => {
    e.stopPropagation()
    setSt({ loading: true })
    try {
      const r = await fetch(`/api/probe?url=${encodeURIComponent(url)}`)
      setSt(await r.json())
    } catch {
      setSt({ error: 'Error de red' })
    }
  }
  return (
    <span className="probe">
      <button className="probe-btn" onClick={run} disabled={st?.loading}>{st?.loading ? 'Probando…' : '▶ Probar'}</button>
      {st && !st.loading && (
        <span className={`probe-res ${st.ok ? 'ok' : 'err'}`}>
          {st.error ? st.error : <>HTTP {st.status}{st.snippet ? <pre>{st.snippet.slice(0, 500)}</pre> : null}</>}
        </span>
      )}
    </span>
  )
}

export default function DirectorioPanel({ sitios, isAdmin = false, dev = false, onDeleted, onUpdated }) {
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [visible, setVisible] = useState(PAGE)
  const [sort, setSort] = useState('recientes')
  const searchRef = useRef(null)

  const borrar = async (s) => {
    if (!confirm(`¿Borrar "${s.nombre}" del directorio?`)) return
    const r = await fetch(`/api/sitios/${s.id}`, { method: 'DELETE' })
    if (r.ok) onDeleted?.(s.id)
    else alert('No se pudo borrar.')
  }

  const reindexar = async (s) => {
    setBusyId(s.id)
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
      const cr = await fetch(`/api/sitios/${s.id}/reindex`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: pd.token }),
      })
      const cd = await cr.json().catch(() => ({}))
      if (cr.ok && cd.sitio) onUpdated?.(cd.sitio)
      else alert(cd.error || 'No se pudo reindexar.')
    } finally {
      setBusyId(null)
    }
  }

  const cats = useMemo(() => {
    const m = new Map()
    sitios.forEach((s) => (s.categorias || []).forEach((c) => m.set(c, (m.get(c) || 0) + 1)))
    return [...m.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [sitios])

  const filtered = useMemo(() => {
    const q = norm(query)
    const out = sitios.filter((s) => {
      const hay = norm([s.nombre, s.descripcion, (s.categorias || []).join(' '), (s.tags || []).join(' ')].join(' '))
      const okQ = !q || hay.includes(q)
      const okC = !cat || (s.categorias || []).includes(cat)
      return okQ && okC
    })
    if (sort === 'az') out.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))
    return out
  }, [sitios, query, cat, sort])

  // Al cambiar búsqueda, categoría u orden, volver a la primera página.
  useEffect(() => { setVisible(PAGE) }, [query, cat, sort])

  // Atajo "/" para enfocar el buscador.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  const mostrados = filtered.slice(0, visible)

  return (
    <section>
      <h1 className="headline">Sitios que ayudan</h1>
      <div className="list-head">
        <p className="lead">
          {query || cat
            ? `${filtered.length} ${filtered.length === 1 ? 'resultado' : 'resultados'}${cat ? ` · ${cat}` : ''}`
            : `${sitios.length} ${sitios.length === 1 ? 'sitio' : 'sitios'} organizados por categoría.`}
        </p>
        {sitios.length > 1 && (
          <select className="sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar">
            <option value="recientes">Recientes</option>
            <option value="az">A–Z</option>
          </select>
        )}
      </div>

      <div className="searchbar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={searchRef}
          className="search"
          placeholder="Buscar por nombre o descripción…  ( / )"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {cats.length > 0 && (
        <div className="pills">
          <button className={cat === null ? 'pill active' : 'pill'} style={{ '--c': 'var(--muted)' }} onClick={() => setCat(null)}>
            Todos <span className="pill-n">{sitios.length}</span>
          </button>
          {cats.map((c) => (
            <button
              key={c.name}
              className={cat === c.name ? 'pill active' : 'pill'}
              style={{ '--c': colorFor(c.name) }}
              onClick={() => setCat(cat === c.name ? null : c.name)}
            >
              {c.name} <span className="pill-n">{c.n}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid2">
        {mostrados.map((s) => (
          <Card
            key={s.id ?? s.url}
            s={s}
            isAdmin={isAdmin}
            dev={dev}
            busy={busyId === s.id}
            onBorrar={() => borrar(s)}
            onReindex={() => reindexar(s)}
          />
        ))}
        {filtered.length === 0 && (
          sitios.length === 0 ? (
            <p className="empty">No hay sitios todavía. Agregá el primero con “+ Agregar sitio”.</p>
          ) : (
            <p className="empty">
              Sin resultados{query ? <> para “{query}”</> : cat ? <> en {cat}</> : null}.{' '}
              <button className="link-mini" onClick={() => { setQuery(''); setCat(null) }}>Limpiar filtros</button>
            </p>
          )
        )}
      </div>
      {filtered.length > visible && (
        <button className="load-more" onClick={() => setVisible((v) => v + PAGE)}>
          Mostrar más <span>{filtered.length - visible}</span>
        </button>
      )}
    </section>
  )
}

function Card({ s, isAdmin, dev, busy, onBorrar, onReindex }) {
  const [openDesc, setOpenDesc] = useState(false)
  const [openTags, setOpenTags] = useState(false)
  const [openApi, setOpenApi] = useState(false)

  const visit = () => {
    if (!s.url) return
    try {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'click', sitioId: s.id }),
        keepalive: true,
      })
    } catch {}
    window.open(s.url, '_blank', 'noopener,noreferrer')
  }
  const stop = (e) => e.stopPropagation()
  const tags = s.tags || []
  const cats = s.categorias || []
  const shownTags = openTags ? tags : tags.slice(0, 3)
  const longDesc = (s.descripcion || '').length > 120

  return (
    <article
      className="card card-link"
      onClick={visit}
      onKeyDown={(e) => { if (e.key === 'Enter') visit() }}
      role="link"
      tabIndex={0}
    >
      <div className="card-body">
        <div className="card-head-row">
          <SiteAvatar url={s.url} name={s.nombre} />
          <h3>{s.nombre}</h3>
        </div>
        {cats.length > 0 && (
          <div className="cats">
            {cats.map((c) => <span className="cat-chip" key={c} style={{ '--c': colorFor(c) }}>{c}</span>)}
          </div>
        )}

        {s.descripcion && <p className={openDesc ? 'desc' : 'desc clamp'}>{s.descripcion}</p>}
        {longDesc && (
          <button className="link-mini" onClick={(e) => { stop(e); setOpenDesc((v) => !v) }}>
            {openDesc ? 'ver menos' : 'ver más'}
          </button>
        )}

        {tags.length > 0 && (
          <div className="tags-row">
            {shownTags.map((t) => <span className="tag" key={t}>{t}</span>)}
            {tags.length > 3 && (
              <button className="tag more" onClick={(e) => { stop(e); setOpenTags((v) => !v) }}>
                {openTags ? '− menos' : `+${tags.length - 3}`}
              </button>
            )}
            <button className="share-mini" onClick={(e) => { stop(e); compartir({ titulo: s.nombre, url: s.url }) }}>
              ↗ Compartir
            </button>
          </div>
        )}

        {dev && (s.api?.tiene || (s.endpoints || []).length > 0 || s.api?.potencial) && (
          <div className="api-block" onClick={stop}>
            <button className="link-mini" onClick={() => setOpenApi((v) => !v)}>
              {openApi ? 'Ocultar API' : '⚙ Ver API'}
            </button>
            {openApi && (
              <div className="api-panel">
                {s.api?.tiene && (
                  <div className="api-verif">
                    {s.api.verificada
                      ? <span className="ok">API responde · HTTP {s.api.verificada_status}</span>
                      : s.api.verificada_status === 0
                        ? <span className="err">No respondió al verificar</span>
                        : <span className="muted">Sin verificar</span>}
                  </div>
                )}
                {!s.api?.tiene && s.api?.potencial && (
                  <div className="api-verif"><span className="warn">Podría exponer API</span>{s.api.potencial_motivo ? ` · ${s.api.potencial_motivo}` : ''}</div>
                )}
                {s.api?.base_url && <div><span className="api-k">Base</span> <code>{s.api.base_url}</code> <ApiProbe url={s.api.base_url} /></div>}
                <div><span className="api-k">Auth</span> {s.api?.auth || 'desconocida'}</div>
                {(s.endpoints || []).length > 0 && (
                  <ul className="api-eps">{s.endpoints.map((e, i) => {
                    const u = probeUrlFor(e, s.api?.base_url)
                    return <li key={i}><code>{e}</code>{u && <ApiProbe url={u} />}</li>
                  })}</ul>
                )}
                {s.api?.ejemplo && <pre className="api-ej">{s.api.ejemplo}</pre>}
                {(s.funcionalidades || []).length > 0 && (
                  <div className="api-funcs"><span className="api-k">Funciones</span> {s.funcionalidades.join(' · ')}</div>
                )}
              </div>
            )}
          </div>
        )}

        {isAdmin && (
          <div className="admin-actions" onClick={stop}>
            <button className="del" onClick={onReindex} disabled={busy}>{busy ? 'Reindexando…' : 'Reindexar'}</button>
            <button className="del" onClick={onBorrar}>Borrar</button>
          </div>
        )}
      </div>
    </article>
  )
}
