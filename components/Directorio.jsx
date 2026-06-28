'use client'
import { useMemo, useState } from 'react'

const norm = (s) =>
  (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function Directorio({ inicial }) {
  const [sitios, setSitios] = useState(inicial)
  const [query, setQuery] = useState('')
  const [activeTags, setActiveTags] = useState([])
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState(null) // {tipo, texto}

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

  const refresh = async () => {
    const r = await fetch('/api/sitios')
    if (r.ok) setSitios(await r.json())
  }

  const agregar = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setAdding(true)
    setMsg(null)
    try {
      const r = await fetch('/api/sitios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await r.json().catch(() => ({}))
      if (r.ok) {
        setMsg({ tipo: 'ok', texto: data.mensaje || 'Sitio agregado.' })
        setUrl('')
        refresh()
      } else {
        setMsg({ tipo: 'err', texto: data.error || `No se pudo agregar (${r.status}).` })
      }
    } catch {
      setMsg({ tipo: 'err', texto: 'Error de red.' })
    } finally {
      setAdding(false)
    }
  }

  return (
    <>
      <div className="col-head">
        <h2>Directorio</h2>
        <span className="count">{filtered.length} de {sitios.length}</span>
      </div>

      <form className="add" onSubmit={agregar}>
        <input
          type="url"
          placeholder="Pegá el link de un sitio para agregarlo…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button type="submit" disabled={adding}>{adding ? 'Analizando…' : 'Agregar'}</button>
      </form>
      {msg && <p className={`add-msg ${msg.tipo}`}>{msg.texto}</p>}

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
          <article className="card" key={s.id}>
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
            <div className="meta">
              {s.url && <a href={s.url} target="_blank" rel="noreferrer">Visitar ↗</a>}
              {s.riesgo && s.riesgo !== 'sin-analizar' && (
                <span className={`riesgo ${s.riesgo}`}>{s.riesgo}</span>
              )}
            </div>
          </article>
        ))}
        {filtered.length === 0 && <p className="empty">No hay resultados.</p>}
      </div>
    </>
  )
}
