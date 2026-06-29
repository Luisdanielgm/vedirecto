'use client'
import { useMemo, useState } from 'react'

const norm = (s) =>
  (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Paleta propia para las categorías (color estable por nombre).
const PALETTE = ['#e0b341', '#6ba3e0', '#e07a9b', '#5bc08a', '#c98ae0', '#e0915b', '#5bc0c0', '#d96b6b', '#8aa0e0', '#aab0b8']
function colorFor(cat) {
  let h = 0
  for (const ch of cat) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export default function DirectorioPanel({ sitios, isAdmin = false, onDeleted, onUpdated }) {
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const borrar = async (s) => {
    if (!confirm(`¿Borrar "${s.nombre}" del directorio?`)) return
    const r = await fetch(`/api/sitios/${s.id}`, { method: 'DELETE' })
    if (r.ok) onDeleted?.(s.id)
    else alert('No se pudo borrar.')
  }

  const reindexar = async (s) => {
    setBusyId(s.id)
    try {
      const r = await fetch(`/api/sitios/${s.id}/reindex`, { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.sitio) onUpdated?.(d.sitio)
      else alert(d.error || 'No se pudo reindexar.')
    } finally {
      setBusyId(null)
    }
  }

  const cats = useMemo(() => {
    const set = new Set()
    sitios.forEach((s) => (s.categorias || []).forEach((c) => set.add(c)))
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [sitios])

  const filtered = useMemo(() => {
    const q = norm(query)
    return sitios.filter((s) => {
      const hay = norm([s.nombre, s.descripcion, (s.categorias || []).join(' '), (s.tags || []).join(' ')].join(' '))
      const okQ = !q || hay.includes(q)
      const okC = !cat || (s.categorias || []).includes(cat)
      return okQ && okC
    })
  }, [sitios, query, cat])

  return (
    <section>
      <h1 className="headline">Sitios que ayudan</h1>
      <p className="lead">
        {sitios.length} {sitios.length === 1 ? 'sitio' : 'sitios'} organizados por categoría.
      </p>

      <div className="searchbar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          className="search"
          placeholder="Buscar por nombre o descripción…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {cats.length > 0 && (
        <div className="pills">
          <button className={cat === null ? 'pill active' : 'pill'} style={{ '--c': '#fafafa' }} onClick={() => setCat(null)}>
            Todos
          </button>
          {cats.map((c) => (
            <button
              key={c}
              className={cat === c ? 'pill active' : 'pill'}
              style={{ '--c': colorFor(c) }}
              onClick={() => setCat(cat === c ? null : c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="grid2">
        {filtered.map((s) => (
          <Card
            key={s.id ?? s.url}
            s={s}
            isAdmin={isAdmin}
            busy={busyId === s.id}
            onBorrar={() => borrar(s)}
            onReindex={() => reindexar(s)}
          />
        ))}
        {filtered.length === 0 && <p className="empty">No hay sitios todavía. Agregá el primero con “+ Agregar sitio”.</p>}
      </div>
    </section>
  )
}

function Card({ s, isAdmin, busy, onBorrar, onReindex }) {
  const [openDesc, setOpenDesc] = useState(false)
  const [openTags, setOpenTags] = useState(false)
  const [imgErr, setImgErr] = useState(false)

  const visit = () => { if (s.url) window.open(s.url, '_blank', 'noopener,noreferrer') }
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
      {s.imagen && !imgErr && (
        <img className="thumb-full" src={s.imagen} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgErr(true)} />
      )}
      <div className="card-body">
        <h3>{s.nombre}</h3>
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
