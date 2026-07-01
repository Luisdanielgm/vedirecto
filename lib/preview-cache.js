// Cache en memoria de previsualizaciones (single-instance, Dokploy). El preview
// corre el pipeline (scrape + LLM) UNA vez y guarda el resultado bajo un token;
// "Confirmar" lo reusa por token. Así no pagamos un segundo llamado a Cauce ni
// confiamos en data mandada por el cliente: el server guarda el análisis, el
// cliente solo tiene un token opaco de un solo uso. El token se ata al usuario
// que lo creó (owner) para que otra sesión no pueda confirmarlo.
const TTL_MS = 10 * 60 * 1000
const MAX_ENTRIES = 2000 // tope duro anti-fuga (single instance)
const store = new Map() // token -> { data, exp, owner }

function purge() {
  const now = Date.now()
  for (const [k, v] of store) if (v.exp < now) store.delete(k)
}

export function putPreview(data, owner = null) {
  purge()
  if (store.size > MAX_ENTRIES) store.clear()
  const token = crypto.randomUUID()
  store.set(token, { data, exp: Date.now() + TTL_MS, owner })
  return token
}

// Un solo uso: al confirmar se consume. Devuelve null si no existe, expiró, o no
// pertenece al solicitante (owner distinto).
export function takePreview(token, requester = null) {
  purge()
  const v = store.get(token)
  if (!v) return null
  if (v.owner && requester && v.owner !== requester) return null
  store.delete(token)
  return v.data
}
