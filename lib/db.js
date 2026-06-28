import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
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
      categoria   TEXT,
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
  `)
  seedIfEmpty(db)
  _db = db
  return _db
}

// Sin seed: el directorio arranca VACÍO. La única forma de entrar es por el
// pipeline de alta (scraping + análisis de seguridad del LLM). Las noticias
// entran por el cron. Nada hardcodeado sin verificar.
function seedIfEmpty() {}

const parseRow = (r) => ({
  ...r,
  tags: r.tags ? JSON.parse(r.tags) : [],
  endpoints: r.endpoints ? JSON.parse(r.endpoints) : [],
})

export function listSitios() {
  return getDb()
    .prepare("SELECT * FROM sitios WHERE estado = 'publicado' ORDER BY creado DESC")
    .all()
    .map(parseRow)
}

export function listNoticias() {
  return getDb().prepare('SELECT * FROM noticias ORDER BY fecha DESC, creado DESC').all()
}

export function getSitioByUrl(url) {
  const r = getDb().prepare('SELECT * FROM sitios WHERE url = ?').get(url)
  return r ? parseRow(r) : null
}

// Inserta un sitio ya analizado. estado se deriva del riesgo:
//   seguro → publicado · dudoso → pendiente · peligroso → rechazado
export function addSitio(s) {
  const estado = s.riesgo === 'seguro' ? 'publicado' : s.riesgo === 'dudoso' ? 'pendiente' : 'rechazado'
  const info = getDb()
    .prepare(
      `INSERT INTO sitios (url, nombre, descripcion, categoria, tags, endpoints, riesgo, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      s.finalUrl,
      s.nombre,
      s.descripcion,
      s.categoria,
      JSON.stringify(s.tags || []),
      JSON.stringify(s.endpoints || []),
      s.riesgo,
      estado
    )
  return { id: Number(info.lastInsertRowid), estado }
}
