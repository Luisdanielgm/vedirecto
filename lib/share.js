// Compartir un recurso: share nativo (móvil) o WhatsApp como respaldo (desktop).
// En una emergencia, pasar un link por WhatsApp es EL caso de uso real.
export async function compartir({ titulo, url }) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: titulo, text: titulo, url })
    } catch {} // canceló el share → no hacemos nada
    return
  }
  const text = `${titulo} — ${url}`
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
}
