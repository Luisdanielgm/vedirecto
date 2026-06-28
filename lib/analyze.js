import { cauceChat } from './cauce.js'

const SYSTEM = `Sos un analista que cataloga sitios web para un directorio público de ayuda en Venezuela y, a la vez, evalúa si el sitio es seguro.

Te paso la URL y el contenido scrapeado de un sitio. Devolvé SOLO un objeto JSON con estos campos:
{
  "nombre": string,                    // nombre claro del sitio/app
  "descripcion": string,               // 1-2 frases, en español, qué hace y para quién
  "categoria": string,                 // ej: Desaparecidos, Donaciones, Refugios, Salud, Voluntarios, Noticias
  "tags": string[],                    // 2-5 etiquetas en minúscula
  "endpoints": string[],               // rutas/APIs públicas que detectes (ej: /api/buscar); [] si no hay
  "riesgo": "seguro" | "dudoso" | "peligroso",
  "motivo_riesgo": string              // por qué le pusiste ese riesgo
}

CONTEXTO TEMPORAL (importante): estamos en el año 2026, tras el terremoto de Venezuela de junio de 2026. Las fechas de 2026 son REALES y esperables. NO trates una fecha de 2026 como "futura" ni como señal de que los datos sean falsos.

Reglas de seguridad:
- Marcá "peligroso" si ves señales CONCRETAS de phishing, estafa, robo de datos/credenciales, malware, o suplantación de una entidad oficial.
- Marcá "dudoso" solo si el sitio no se entiende, pide datos sensibles sin explicar para qué, o hay señales concretas de que no es legítimo.
- Señales DÉBILES que por sí solas NO justifican "dudoso": un dominio .xyz/.org/etc, la ausencia de página de contacto, o un diseño simple. Pesá el PROPÓSITO real del sitio.
- Marcá "seguro" si el propósito es claro y legítimo (un sitio de ayuda, directorio, donaciones, etc.), aunque no puedas verificar cada detalle.
- Ante señales concretas de daño, no pongas "seguro". Tu juicio es una opinión de riesgo, no una garantía.
Respondé únicamente el JSON, sin texto adicional.`

function parseJson(raw) {
  let s = (raw || '').trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1)
  return JSON.parse(s)
}

const RIESGOS = new Set(['seguro', 'dudoso', 'peligroso'])

export async function analizarSitio({ finalUrl, title, description, text }) {
  const content = `URL: ${finalUrl}
Título: ${title || '(sin título)'}
Meta descripción: ${description || '(ninguna)'}

Contenido visible (recortado):
${text || '(vacío)'}`

  const raw = await cauceChat([
    { role: 'system', content: SYSTEM },
    { role: 'user', content },
  ])

  let p
  try {
    p = parseJson(raw)
  } catch {
    // Si el LLM no devolvió JSON usable, lo tratamos como dudoso (conservador).
    return { nombre: title || finalUrl, descripcion: '', categoria: '', tags: [], endpoints: [], riesgo: 'dudoso', motivo_riesgo: 'No se pudo analizar la respuesta del modelo.' }
  }

  const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [])
  const riesgo = RIESGOS.has(p.riesgo) ? p.riesgo : 'dudoso'
  return {
    nombre: String(p.nombre || title || finalUrl).trim(),
    descripcion: String(p.descripcion || '').trim(),
    categoria: String(p.categoria || '').trim(),
    tags: arr(p.tags),
    endpoints: arr(p.endpoints),
    riesgo,
    motivo_riesgo: String(p.motivo_riesgo || '').trim(),
  }
}
