'use client'
import { useMemo, useState } from 'react'

const norm = (s) =>
  (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function DirectorioPanel({ sitios }) {
  const [query, setQuery] = useState('')
  const [activeTags, setActiveTags] = useState([])

  const allTags = useMemo(() => {
    const set = new Set()
    sitios.forEach((s) => (s.tags || []).forEach((t) => set.add(t)))
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [sitios])

  const filtered = useMemo(() => {
    const q = norm(query)
    return sitios.filter((s) => {
      const hay = norm([s.nombre, s.descripcion, s.categoria, (s.tags || []).join(' ')].join(' '))
      const okQ = !q || hay.includes(q)
      const okT = activeTags.length === 0 || (s.tags || []).some((t) => activeTags.includes(t))
      return okQ && okT
    })
  }, [sitios, query, activeTags])

  const toggleTag = (t) =>
    setActiveTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))

  return (
    <>
      <input
        className="search"
        placeholder="Buscar por nombre, descripción o etiqueta…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {allTags.length > 0 && (
        <div className="chips">
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              className={activeTags.includes(t) ? 'chip active' : 'chip'}
              onClick={() => toggleTag(t)}
            >
              {t}
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
        {filtered.length === 0 && <p className="empty">No hay sitios todavía. Agregá el primero.</p>}
      </div>
    </>
  )
}
