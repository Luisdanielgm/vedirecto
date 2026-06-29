import { cauceChat } from './cauce.js'

const SYSTEM = `Sos un analista que cataloga sitios web para un directorio público de ayuda en Venezuela y, a la vez, evalúa si el sitio es seguro.

Te paso la URL y el contenido scrapeado de un sitio. Devolvé SOLO un objeto JSON con estos campos:
{
  "nombre": string,                    // nombre claro del sitio/app
  "descripcion": string,               // 1-2 frases, en español, qué hace y para quién
  "categorias": string[],              // 1 a 3 categorías en Title Case según el propósito REAL del sitio (ej: ["Rescate","Donaciones"]). Si es multi-función, poné todas las que apliquen.
  "tags": string[],                    // 2-5 etiquetas en minúscula
  "endpoints": string[],               // rutas/APIs públicas que detectes (ej: /api/buscar); [] si no hay
  "riesgo": "seguro" | "dudoso" | "peligroso",
  "motivo_riesgo": string,             // por qué le pusiste ese riesgo
  "relevante": boolean,                // ¿pertenece a ESTE directorio? (ver PROPÓSITO)
  "motivo_relevancia": string,         // por qué es o no relevante
  "duplicado": boolean,                // ¿es el MISMO recurso que uno ya listado del mismo dominio?
  "duplicado_de": string               // nombre del sitio ya listado que duplica, o "" si no
}

CONTEXTO TEMPORAL (importante): estamos en el año 2026, tras el terremoto de Venezuela de junio de 2026. Las fechas de 2026 son REALES y esperables. NO trates una fecha de 2026 como "futura" ni como señal de que los datos sean falsos.

PROPÓSITO DEL DIRECTORIO (para "relevante"): VeDirecto reúne sitios de AYUDA para la emergencia del terremoto de Venezuela 2026 y su recuperación: rescate, personas desaparecidas, refugios, donaciones/acopios, salud (hospitales, salud mental), mascotas, niñez, edificaciones dañadas/reconstrucción, mapas, voluntarios e iniciativas ciudadanas de ayuda en Venezuela relacionadas con la emergencia.
- relevante=true si el sitio encaja en eso.
- relevante=false si NO tiene relación con Venezuela ni con esta emergencia/ayuda (ej: una tienda random, un blog ajeno, un servicio sin vínculo).

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

export async function analizarSitio({ finalUrl, title, description, text, sameDomain = [] }) {
  const dupContext = sameDomain.length
    ? `\nYA LISTADOS del mismo dominio (decidí si el sitio nuevo es el MISMO recurso = duplicado, o una sección/herramienta distinta):\n${sameDomain.map((s) => `- ${s.nombre} (${s.url})`).join('\n')}`
    : ''
  const content = `URL: ${finalUrl}
Título: ${title || '(sin título)'}
Meta descripción: ${description || '(ninguna)'}

Contenido visible (recortado):
${text || '(vacío)'}${dupContext}`

  // Reintenta una vez si el modelo no devuelve JSON parseable (evita falsos "dudoso").
  let p = null
  for (let intento = 0; intento < 2 && !p; intento++) {
    const userMsg =
      intento === 0
        ? content
        : `${content}\n\nIMPORTANTE: respondé ÚNICAMENTE un objeto JSON válido, sin texto antes ni después.`
    try {
      const raw = await cauceChat([
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userMsg },
      ])
      p = parseJson(raw)
    } catch {
      p = null
    }
  }

  if (!p) {
    // Si el LLM no devolvió JSON usable, lo tratamos como dudoso (conservador).
    return { nombre: title || finalUrl, descripcion: '', categorias: ['Otros'], categoria: 'Otros', tags: [], endpoints: [], riesgo: 'dudoso', motivo_riesgo: 'No se pudo analizar la respuesta del modelo.', relevante: true, motivo_relevancia: '', duplicado: false, duplicado_de: '' }
  }

  const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [])
  const titleCase = (s) =>
    s.trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase())
  const categorias = (() => {
    const out = []
    for (const x of arr(p.categorias)) {
      const c = titleCase(x)
      if (c && c.length <= 24 && !out.some((o) => o.toLowerCase() === c.toLowerCase())) out.push(c)
    }
    return out.length ? out.slice(0, 3) : ['Otros']
  })()
  const riesgo = RIESGOS.has(p.riesgo) ? p.riesgo : 'dudoso'
  return {
    nombre: String(p.nombre || title || finalUrl).trim(),
    descripcion: String(p.descripcion || '').trim(),
    categorias,
    categoria: categorias[0], // compat con la columna legacy
    tags: arr(p.tags),
    endpoints: arr(p.endpoints),
    riesgo,
    motivo_riesgo: String(p.motivo_riesgo || '').trim(),
    relevante: p.relevante !== false, // default true: no bloquear por un campo ausente
    motivo_relevancia: String(p.motivo_relevancia || '').trim(),
    duplicado: p.duplicado === true,
    duplicado_de: String(p.duplicado_de || '').trim(),
  }
}
