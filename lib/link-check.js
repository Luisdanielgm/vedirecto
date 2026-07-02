import { safeFetch } from './net-guard.js'
import { sitiosParaCheck, marcarCheck } from './db.js'

// Un 403/401/429 NO es "caído": muchos sitios bloquean bots pero funcionan para
// personas. Solo contamos como caído lo inequívoco: no conecta, no existe, o el
// servidor está roto.
export function esCaido(status) {
  return status === 0 || status === 404 || status === 410 || status >= 500
}

// Chequea cada sitio publicado (GET liviano) y guarda su status. Devuelve el
// resumen con la lista de caídos, para el admin. No despublica nada automático:
// un falso positivo (caída temporal) no debería sacar un recurso de emergencia.
export async function chequearSitios() {
  const sitios = sitiosParaCheck()
  const caidos = []
  for (const s of sitios) {
    let status = 0
    try {
      const r = await safeFetch(s.url, { timeoutMs: 8000, maxBytes: 2048 })
      status = r.status
    } catch {
      status = 0
    }
    marcarCheck(s.id, status)
    if (esCaido(status)) caidos.push({ id: s.id, nombre: s.nombre, url: s.url, status })
  }
  return { revisados: sitios.length, caidos: caidos.length, lista: caidos }
}
