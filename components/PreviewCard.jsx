'use client'

// Card de vista previa de un sitio analizado (sin guardar). Las acciones las
// pone quien la usa (Confirmar/Volver en el alta; Agregar/Saltar en la cola).
export default function PreviewCard({ data, children }) {
  const { status, nota, preview: p } = data || {}

  if (status === 'duplicado') {
    return (
      <div className="preview-card">
        <p className="modal-msg err">{nota ? `Mismo recurso que ya está: "${nota}".` : 'Ya está en el directorio.'}</p>
        {children}
      </div>
    )
  }
  if (!p) {
    return (
      <div className="preview-card">
        <p className="modal-msg err">{data?.error || 'No se pudo previsualizar.'}</p>
        {children}
      </div>
    )
  }

  const tieneApi = p.api?.tiene || (p.endpoints || []).length > 0
  return (
    <div className="preview-card">
      <div className="preview-head">
        <h3>{p.nombre}</h3>
        <span className={`estado ${p.estado}`}>{p.estado}</span>
      </div>
      <p className="preview-url">{p.url}</p>
      {p.categorias?.length > 0 && (
        <div className="preview-cats">{p.categorias.map((c) => <span className="cat-chip" key={c}>{c}</span>)}</div>
      )}
      {p.descripcion && <p className="preview-desc">{p.descripcion}</p>}

      <div className={`preview-riesgo ${p.riesgo}`}>
        <b>Riesgo: {p.riesgo}</b>{p.motivo_riesgo ? ` — ${p.motivo_riesgo}` : ''}
      </div>
      {status === 'no-relevante' && (
        <div className="preview-riesgo dudoso"><b>No relevante</b>{nota ? ` — ${nota}` : ''}</div>
      )}

      {tieneApi && (
        <div className="preview-api">
          <b>API {p.api?.auth ? `(${p.api.auth})` : ''}</b>
          {(p.endpoints || []).length > 0 && (
            <ul>{p.endpoints.map((e, i) => <li key={i}><code>{e}</code></li>)}</ul>
          )}
        </div>
      )}
      {p.funcionalidades?.length > 0 && <p className="preview-funcs">{p.funcionalidades.join(' · ')}</p>}

      {children}
    </div>
  )
}
