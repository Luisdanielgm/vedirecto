import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')

// Apertura PEREZOSA: no abrir en el import (si no, `next build` levanta varios
// workers que abren la DB a la vez → "database is locked"). Se abre recién en
// la primera consulta, en runtime. Las rutas son force-dynamic, así que el build
// nunca las ejecuta.
let _db = null

function getDb() {
  if (_db) return _db
  mkdirSync(DATA_DIR, { recursive: true })
  const db = new DatabaseSync(path.join(DATA_DIR, 'vedirecto.sqlite'))
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
  db.exec(`
    CREATE TABLE IF NOT EXISTS sitios (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      url         TEXT UNIQUE NOT NULL,
      nombre      TEXT NOT NULL,
      descripcion TEXT,
      categoria   TEXT,           -- legacy (primera categoría)
      categorias  TEXT,           -- JSON array (1-3)
      imagen      TEXT,           -- url de og:image / favicon del sitio
      tags        TEXT,           -- JSON array
      endpoints   TEXT,           -- JSON array
      riesgo      TEXT DEFAULT 'sin-analizar',  -- seguro | dudoso | peligroso | sin-analizar
      estado      TEXT DEFAULT 'publicado',     -- publicado | pendiente | rechazado
      creado      TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS noticias (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo  TEXT NOT NULL,
      resumen TEXT,
      fuente  TEXT,
      url     TEXT UNIQUE,
      fecha   TEXT,
      creado  TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS visitas (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo      TEXT NOT NULL,             -- 'pagina' | 'click'
      sitio_id  INTEGER,                   -- sitio clickeado (solo para 'click')
      dia       TEXT NOT NULL,             -- YYYY-MM-DD
      visitante TEXT,                      -- hash NO reversible sha256(salt|dia|ip); cuenta únicos sin guardar IP
      creado    TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS auditoria (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      email   TEXT,                       -- usuario logueado (de Supabase)
      ip      TEXT,                       -- IP del request
      accion  TEXT NOT NULL,              -- login | alta | batch | reindex | borrado | estado
      detalle TEXT,
      creado  TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS fuentes (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      url     TEXT UNIQUE NOT NULL,        -- home/sección de un medio
      nombre  TEXT,
      activa  INTEGER DEFAULT 1,
      ultimo  TEXT,                        -- último chequeo (ISO)
      creado  TEXT DEFAULT (datetime('now'))
    );
  `)
  migrate(db)
  seedIfEmpty(db)
  seedFuentes(db)
  _db = db
  return _db
}

// Migración no destructiva para DBs ya creadas (el volumen de producción).
function migrate(db) {
  const cols = db.prepare('PRAGMA table_info(sitios)').all().map((c) => c.name)
  if (!cols.includes('categorias')) {
    db.exec('ALTER TABLE sitios ADD COLUMN categorias TEXT')
    // backfill: la categoría única pasa a ser un array de uno.
    db.exec("UPDATE sitios SET categorias = json_array(categoria) WHERE categorias IS NULL AND categoria IS NOT NULL AND categoria != ''")
  }
  if (!cols.includes('imagen')) {
    db.exec('ALTER TABLE sitios ADD COLUMN imagen TEXT')
  }
  if (!cols.includes('api')) db.exec('ALTER TABLE sitios ADD COLUMN api TEXT')
  if (!cols.includes('funcionalidades')) db.exec('ALTER TABLE sitios ADD COLUMN funcionalidades TEXT')
  // Chequeo de enlaces: último status HTTP visto y cuándo (para detectar caídos).
  if (!cols.includes('http_status')) db.exec('ALTER TABLE sitios ADD COLUMN http_status INTEGER')
  if (!cols.includes('ultimo_check')) db.exec('ALTER TABLE sitios ADD COLUMN ultimo_check TEXT')

  const vcols = db.prepare('PRAGMA table_info(visitas)').all().map((c) => c.name)
  if (!vcols.includes('visitante')) db.exec('ALTER TABLE visitas ADD COLUMN visitante TEXT')
}

// Sin seed: el directorio arranca VACÍO. La única forma de entrar es por el
// pipeline de alta (scraping + análisis de seguridad del LLM). Las noticias
// entran por el cron. Nada hardcodeado sin verificar.
function seedIfEmpty() {}

// Fuentes de noticias verificadas (investigadas manualmente). Solo se siembran
// si la tabla está vacía, para no repisar altas/bajas que haga el admin. El
// crawler filtra por palabras clave de la emergencia, así que solo entran notas
// referentes al terremoto.
const FUENTES_SEED = [
  ['https://efectococuyo.com/tag/terremoto/', 'Efecto Cocuyo'],
  ['https://elpitazo.net/tag/terremoto/', 'El Pitazo'],
  ['https://talcualdigital.com/tag/terremoto/', 'TalCual'],
  ['https://runrun.es/', 'Runrunes'],
  ['https://venezuelareporta.org/noticias', 'Venezuela Reporta'],
  ['https://redquipu.com/actualizaciones', 'RedQuipu'],
]
function seedFuentes(db) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM fuentes').get()
  if (n > 0) return
  const stmt = db.prepare('INSERT OR IGNORE INTO fuentes (url, nombre) VALUES (?, ?)')
  for (const [url, nombre] of FUENTES_SEED) stmt.run(url, nombre)
}

// JSON.parse tolerante: una fila con JSON corrupto NO debe tumbar todo el listado.
const jparse = (v, fallback) => {
  if (!v) return fallback
  try { return JSON.parse(v) } catch { return fallback }
}
const parseRow = (r) => ({
  ...r,
  tags: jparse(r.tags, []),
  endpoints: jparse(r.endpoints, []),
  categorias: jparse(r.categorias, r.categoria ? [r.categoria] : []),
  funcionalidades: jparse(r.funcionalidades, []),
  api: jparse(r.api, null),
})

export function listSitios() {
  return getDb()
    .prepare("SELECT * FROM sitios WHERE estado = 'publicado' ORDER BY creado DESC")
    .all()
    .map(parseRow)
}

export function listNoticias() {
  // node:sqlite devuelve filas con prototipo null; RSC solo acepta objetos
  // planos al pasar props a Client Components. Copiamos a objeto plano.
  return getDb()
    .prepare('SELECT * FROM noticias ORDER BY fecha DESC, creado DESC')
    .all()
    .map((r) => ({ ...r }))
}

export function getNoticiaByUrl(url) {
  return getDb().prepare('SELECT * FROM noticias WHERE url = ?').get(url) || null
}

export function addNoticia(n) {
  const info = getDb()
    .prepare('INSERT OR IGNORE INTO noticias (titulo, resumen, fuente, url, fecha) VALUES (?, ?, ?, ?, ?)')
    .run(n.titulo, n.resumen || null, n.fuente || null, n.url || null, n.fecha || null)
  return { id: Number(info.lastInsertRowid), changed: info.changes > 0 }
}

export function deleteNoticia(id) {
  return getDb().prepare('DELETE FROM noticias WHERE id = ?').run(id).changes > 0
}

// --- Fuentes de noticias (para el crawler programado) ---
export function listFuentes() {
  return getDb().prepare('SELECT * FROM fuentes ORDER BY creado DESC').all()
}
export function listFuentesActivas() {
  return getDb().prepare('SELECT * FROM fuentes WHERE activa = 1').all()
}
export function addFuente(url, nombre) {
  const info = getDb()
    .prepare('INSERT OR IGNORE INTO fuentes (url, nombre) VALUES (?, ?)')
    .run(url, nombre || null)
  return { id: Number(info.lastInsertRowid), changed: info.changes > 0 }
}
export function deleteFuente(id) {
  return getDb().prepare('DELETE FROM fuentes WHERE id = ?').run(id).changes > 0
}
export function touchFuente(id) {
  getDb().prepare("UPDATE fuentes SET ultimo = datetime('now') WHERE id = ?").run(id)
}

// --- Backup: snapshot consistente del SQLite en DATA_DIR/backups, con rotación. ---
// VACUUM INTO produce una copia íntegra y compactada, segura aun con WAL activo
// (no sirve copiar el .sqlite en caliente: podés capturar un estado a medias).
export function backupDb({ keep = 14 } = {}) {
  const db = getDb()
  const dir = path.join(DATA_DIR, 'backups')
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') // 2026-06-30-14-05-00
  const dest = path.join(dir, `vedirecto-${stamp}.sqlite`)
  db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`)

  // Rotación: conservar solo los `keep` más recientes.
  const backups = readdirSync(dir)
    .filter((f) => f.startsWith('vedirecto-') && f.endsWith('.sqlite'))
    .map((f) => ({ f, t: statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  const sobran = backups.slice(keep)
  for (const { f } of sobran) rmSync(path.join(dir, f), { force: true })

  return { archivo: path.basename(dest), ruta: dest, conservados: Math.min(backups.length, keep), borrados: sobran.length }
}

export function getSitioByUrl(url) {
  const r = getDb().prepare('SELECT * FROM sitios WHERE url = ?').get(url)
  return r ? parseRow(r) : null
}

// Liviano: todas las URLs/nombres para dedup normalizado y match por dominio.
export function listSitiosLite() {
  return getDb().prepare('SELECT id, nombre, url FROM sitios').all()
}

// Sitios publicados a chequear (detección de enlaces caídos).
export function sitiosParaCheck() {
  return getDb().prepare("SELECT id, nombre, url FROM sitios WHERE estado = 'publicado'").all()
}

// Guarda el resultado del último chequeo HTTP de un sitio.
export function marcarCheck(id, status) {
  getDb()
    .prepare("UPDATE sitios SET http_status = ?, ultimo_check = datetime('now') WHERE id = ?")
    .run(status, id)
}

// Todos los sitios (cualquier estado) — para el dashboard admin.
export function listAllSitios() {
  return getDb().prepare('SELECT * FROM sitios ORDER BY creado DESC').all().map(parseRow)
}

// Categorías distintas ya en uso — para que el LLM reuse en vez de fragmentar.
export function listCategorias() {
  const rows = getDb().prepare('SELECT categorias FROM sitios WHERE categorias IS NOT NULL').all()
  const set = new Set()
  for (const r of rows) {
    try {
      JSON.parse(r.categorias).forEach((c) => c && set.add(c))
    } catch {}
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'es'))
}

export function setEstado(id, estado) {
  return getDb().prepare('UPDATE sitios SET estado = ? WHERE id = ?').run(estado, id).changes > 0
}

// Fusiona la categoría `de` en `a` en todos los sitios (instantáneo, sin LLM).
export function mergeCategoria(de, a) {
  de = (de || '').trim()
  a = (a || '').trim()
  if (!de || !a || de === a) return 0
  const db = getDb()
  const rows = db.prepare('SELECT id, categorias FROM sitios').all()
  const upd = db.prepare('UPDATE sitios SET categorias = ?, categoria = ? WHERE id = ?')
  let n = 0
  for (const r of rows) {
    let cats
    try {
      cats = JSON.parse(r.categorias || '[]')
    } catch {
      cats = []
    }
    if (!cats.includes(de)) continue
    const next = []
    for (const c of cats) {
      const v = c === de ? a : c
      if (!next.includes(v)) next.push(v)
    }
    upd.run(JSON.stringify(next), next[0] || null, r.id)
    n++
  }
  return n
}

// --- Métricas de visitas (propias, sin terceros ni datos personales) ---
export function registrarVisita(tipo, sitioId = null, visitante = null) {
  const dia = new Date().toISOString().slice(0, 10)
  getDb()
    .prepare('INSERT INTO visitas (tipo, sitio_id, dia, visitante) VALUES (?, ?, ?, ?)')
    .run(tipo, sitioId, dia, visitante)
}

export function estadisticas() {
  const db = getDb()
  const hoy = new Date().toISOString().slice(0, 10)
  const total = db.prepare("SELECT COUNT(*) AS n FROM visitas WHERE tipo = 'pagina'").get().n
  const totalClicks = db.prepare("SELECT COUNT(*) AS n FROM visitas WHERE tipo = 'click'").get().n
  const unicosHoy = db
    .prepare("SELECT COUNT(DISTINCT visitante) AS n FROM visitas WHERE tipo = 'pagina' AND dia = ? AND visitante IS NOT NULL")
    .get(hoy).n
  const porDia = db
    .prepare("SELECT dia, COUNT(*) AS n, COUNT(DISTINCT visitante) AS u FROM visitas WHERE tipo = 'pagina' GROUP BY dia ORDER BY dia DESC LIMIT 14")
    .all()
  const topSitios = db
    .prepare(
      `SELECT v.sitio_id AS id, s.nombre AS nombre, COUNT(*) AS n
       FROM visitas v LEFT JOIN sitios s ON s.id = v.sitio_id
       WHERE v.tipo = 'click' GROUP BY v.sitio_id ORDER BY n DESC LIMIT 10`
    )
    .all()
  return { total, totalClicks, unicosHoy, porDia, topSitios }
}

// --- Auditoría: solo acciones de usuarios LOGUEADOS (login/alta/admin) ---
export function registrarAccion(email, ip, accion, detalle = '') {
  getDb()
    .prepare('INSERT INTO auditoria (email, ip, accion, detalle) VALUES (?, ?, ?, ?)')
    .run(email || null, ip || null, accion, detalle || null)
}

export function listAuditoria(limit = 100) {
  return getDb().prepare('SELECT * FROM auditoria ORDER BY id DESC LIMIT ?').all(limit)
}

export function deleteSitio(id) {
  return getDb().prepare('DELETE FROM sitios WHERE id = ?').run(id).changes > 0
}

export function getSitioById(id) {
  const r = getDb().prepare('SELECT * FROM sitios WHERE id = ?').get(id)
  return r ? parseRow(r) : null
}

// Re-análisis (reindexar): refresca el contenido. NO toca url/estado/creado.
export function updateSitioContent(id, s) {
  const categorias = Array.isArray(s.categorias) && s.categorias.length
    ? s.categorias
    : s.categoria
      ? [s.categoria]
      : []
  getDb()
    .prepare(
      `UPDATE sitios SET nombre=?, descripcion=?, categoria=?, categorias=?, imagen=?, tags=?, endpoints=?, funcionalidades=?, api=?, riesgo=?
       WHERE id=?`
    )
    .run(
      s.nombre,
      s.descripcion,
      categorias[0] || null,
      JSON.stringify(categorias),
      s.imagen || null,
      JSON.stringify(s.tags || []),
      JSON.stringify(s.endpoints || []),
      JSON.stringify(s.funcionalidades || []),
      JSON.stringify(s.api || null),
      s.riesgo,
      id
    )
  return getSitioById(id)
}

// Inserta un sitio ya analizado. estado se deriva del riesgo:
//   seguro → publicado · dudoso → pendiente · peligroso → rechazado
export function addSitio(s) {
  const estado = s.riesgo === 'seguro' ? 'publicado' : s.riesgo === 'dudoso' ? 'pendiente' : 'rechazado'
  const categorias = Array.isArray(s.categorias) && s.categorias.length
    ? s.categorias
    : s.categoria
      ? [s.categoria]
      : []
  const info = getDb()
    .prepare(
      `INSERT OR IGNORE INTO sitios (url, nombre, descripcion, categoria, categorias, imagen, tags, endpoints, funcionalidades, api, riesgo, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      s.finalUrl,
      s.nombre,
      s.descripcion,
      categorias[0] || null,
      JSON.stringify(categorias),
      s.imagen || null,
      JSON.stringify(s.tags || []),
      JSON.stringify(s.endpoints || []),
      JSON.stringify(s.funcionalidades || []),
      JSON.stringify(s.api || null),
      s.riesgo,
      estado
    )
  // Carrera/duplicado exacto: la url ya existía (UNIQUE). Devolvemos el existente
  // en vez de reventar con una excepción no capturada (evita el 500).
  if (info.changes === 0) {
    const ex = getDb().prepare('SELECT id, estado FROM sitios WHERE url = ?').get(s.finalUrl)
    return { id: ex ? Number(ex.id) : null, estado: ex?.estado || estado, duplicate: true }
  }
  return { id: Number(info.lastInsertRowid), estado, duplicate: false }
}

// --- Poda de datos viejos (evita crecimiento sin fin del SQLite) ---
export function podarVisitas(dias = 90) {
  const corte = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10)
  return getDb().prepare('DELETE FROM visitas WHERE dia < ?').run(corte).changes
}

export function podarAuditoria(dias = 180) {
  return getDb().prepare("DELETE FROM auditoria WHERE creado < datetime('now', ?)").run(`-${dias} days`).changes
}
