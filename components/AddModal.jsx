'use client'
import { useState, useEffect } from 'react'
import PreviewCard from './PreviewCard'
import { createClient } from '../lib/supabase/client'

// Modal de alta. Vive en su propio chunk (dynamic import desde Shell) para que
// @supabase/ssr no viaje en el bundle inicial de quien solo navega.
export default function AddModal({ onClose, onAdded }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [configured, setConfigured] = useState(true)
  const [preview, setPreview] = useState(null) // { status, token, preview, nota }

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setConfigured(false)
      setAuthReady(true)
      return
    }
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const login = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
  }

  // Paso 1: previsualizar (no guarda nada).
  const previsualizar = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setBusy(true)
    setMsg(null)
    setPreview(null)
    try {
      const r = await fetch('/api/sitios/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await r.json().catch(() => ({}))
      if (r.ok) setPreview(data)
      else setMsg({ tipo: 'err', texto: data.error || `No se pudo previsualizar (${r.status}).` })
    } catch {
      setMsg({ tipo: 'err', texto: 'Error de red.' })
    } finally {
      setBusy(false)
    }
  }

  // Paso 2: confirmar el alta usando el token de la preview.
  const confirmar = async () => {
    if (!preview?.token) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch('/api/sitios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: preview.token }),
      })
      const data = await r.json().catch(() => ({}))
      if (r.ok) {
        setMsg({ tipo: 'ok', texto: `"${data.sitio?.nombre || 'Sitio'}" agregado.` })
        if (data.sitio) onAdded(data.sitio)
        setUrl('')
        setPreview(null)
      } else {
        setMsg({ tipo: 'err', texto: data.error || `No se pudo agregar (${r.status}).` })
        setPreview(null)
      }
    } catch {
      setMsg({ tipo: 'err', texto: 'Error de red.' })
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setPreview(null)
    setMsg(null)
  }

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Agregar sitio</h2>

        {!authReady ? (
          <p className="hint">Cargando…</p>
        ) : !configured ? (
          <p className="hint">El login con Google todavía no está configurado.</p>
        ) : !user ? (
          <>
            <p className="hint">Iniciá sesión con Google para agregar un sitio. El análisis lo hace una IA, por eso pedimos login.</p>
            <p className="hint privacy-note">Al iniciar sesión registramos tu email y tu IP, solo para moderación y seguridad. De quienes solo navegan no guardamos ningún dato personal.</p>
            <button className="google-btn" onClick={login}>Iniciar sesión con Google</button>
          </>
        ) : preview ? (
          <PreviewBlock data={preview} busy={busy} onConfirm={confirmar} onBack={reset} />
        ) : (
          <>
            <p className="hint">Pega el link. Una IA lo analiza y te muestra una vista previa antes de agregarlo.</p>
            <form className="modal-form" onSubmit={previsualizar}>
              <input type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
              <button type="submit" disabled={busy}>{busy ? 'Analizando…' : 'Previsualizar'}</button>
            </form>
          </>
        )}

        {msg && <p className={`modal-msg ${msg.tipo}`}>{msg.texto}</p>}

        <div className="modal-close">
          {user && <button type="button" onClick={logout}>Cerrar sesión</button>}
          <button type="button" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// Vista previa de lo que se agregaría. Solo deja confirmar si el riesgo es seguro.
function PreviewBlock({ data, busy, onConfirm, onBack }) {
  const { status, preview: p } = data
  const actions =
    status === 'duplicado' ? (
      <button className="google-btn" onClick={onBack}>Probar otra URL</button>
    ) : (
      <div className="preview-actions">
        <button className="del" onClick={onBack} disabled={busy}>Volver</button>
        {status === 'ok' ? (
          <button className="add-btn" onClick={onConfirm} disabled={busy}>{busy ? 'Agregando…' : 'Confirmar y agregar'}</button>
        ) : (
          <span className="hint">No se puede publicar{status === 'no-relevante' ? ' (no relevante)' : ` (riesgo ${p?.riesgo})`}.</span>
        )}
      </div>
    )
  return <PreviewCard data={data}>{actions}</PreviewCard>
}
