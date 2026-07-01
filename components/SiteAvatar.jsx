'use client'
import { useState } from 'react'

// Colores estables por nombre para el avatar de respaldo.
const PALETTE = ['#e0b341', '#6ba3e0', '#e07a9b', '#5bc08a', '#c98ae0', '#e0915b', '#5bc0c0', '#d96b6b', '#8aa0e0', '#aab0b8']
function colorFor(s) {
  let h = 0
  for (const ch of s || '?') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}
function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

// Avatar de un sitio: inicial de color (instantánea) con el favicon superpuesto.
// Si el favicon carga, se muestra; si da 404, queda la inicial. Sin huecos.
export default function SiteAvatar({ url, name, size = 18 }) {
  const [ok, setOk] = useState(false)
  const host = hostOf(url)
  const src = host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : ''
  const label = (name || host || '?').trim().charAt(0).toUpperCase()
  return (
    <span className="avatar" style={{ width: size, height: size, background: ok ? 'transparent' : colorFor(name || host) }}>
      {!ok && <span className="avatar-letter">{label}</span>}
      {src && (
        <img src={src} alt="" loading="lazy" onLoad={() => setOk(true)} onError={() => setOk(false)} style={{ opacity: ok ? 1 : 0 }} />
      )}
    </span>
  )
}
