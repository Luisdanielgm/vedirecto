// Cache en memoria de previsualizaciones (single-instance, Dokploy). El preview
// corre el pipeline (scrape + LLM) UNA vez y guarda el resultado bajo un token;
// "Confirmar" lo reusa por token. Así no pagamos un segundo llamado a Cauce ni
// confiamos en data mandada por el cliente: el server guarda el análisis, el
// cliente solo tiene un token opaco de un solo uso.
const TTL_MS = 10 * 60 * 1000
const store = new Map() // token -> { data, exp }

function purge() {
  const now = Date.now()
  for (const [k, v] of store) if (v.exp < now) store.delete(k)
}

export function putPreview(data) {
  purge()
  const token = crypto.randomUUID()
  store.set(token, { data, exp: Date.now() + TTL_MS })
  return token
}

// Un solo uso: al confirmar se consume. Devuelve null si no existe o expiró.
export function takePreview(token) {
  purge()
  const v = store.get(token)
  if (!v) return null
  store.delete(token)
  return v.data
}
