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

export default function DirectorioPanel({ sitios }) {
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState(null) // null = Todos

  const cats = useMemo(() => {
    const set = new Set()
    sitios.forEach((s) => s.categoria && set.add(s.categoria))
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [sitios])

  const filtered = useMemo(() => {
    const q = norm(query)
    return sitios.filter((s) => {
      const hay = norm([s.nombre, s.descripcion, s.categoria, (s.tags || []).join(' ')].join(' '))
      const okQ = !q || hay.includes(q)
      const okC = !cat || s.categoria === cat
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
          <button
            className={cat === null ? 'pill active' : 'pill'}
            style={{ '--c': '#fafafa' }}
            onClick={() => setCat(null)}
          >
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

      <div className="list">
        {filtered.map((s) => (
          <article className="card" key={s.id ?? s.url}>
            <div className="row">
              <h3>{s.nombre}</h3>
              {s.categoria && <span className="cat">{s.categoria}</span>}
            </div>
            {s.descripcion && <p className="desc">{s.descripcion}</p>}
            {s.tags?.length > 0 && (
              <div className="tags">
                {s.tags.map((t) => <span className="tag" key={t}>{t}</span>)}
              </div>
            )}
            {s.url && (
              <div className="meta">
                <a className="visit" href={s.url} target="_blank" rel="noreferrer">Visitar</a>
              </div>
            )}
          </article>
        ))}
        {filtered.length === 0 && <p className="empty">No hay sitios todavía. Agregá el primero con “+ Agregar sitio”.</p>}
      </div>
    </section>
  )
}
