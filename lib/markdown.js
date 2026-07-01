// Render del directorio a Markdown — formato eficiente en tokens para que un LLM
// lo lea de un saque. Lo consume /api/sitios.md y /api/noticias.md.
//
// Los campos vienen del LLM que analiza HTML de sitios EXTERNOS (no confiables):
// los escapamos para que no puedan inyectar estructura Markdown (encabezados,
// listas, links falsos) y forjar entradas para un consumidor IA.

// Campo de una línea: colapsa saltos y escapa sintaxis estructural de Markdown.
const esc = (s) => String(s ?? '').replace(/\s+/g, ' ').replace(/([\\`*_#\[\]|>~])/g, '\\$1').trim()
// URL: sin espacios ni caracteres que rompan el contexto Markdown.
const escUrl = (s) => String(s ?? '').replace(/\s+/g, '').replace(/[<>()\[\]`]/g, '').trim()

export function sitiosToMarkdown(sitios) {
  const body = sitios.map((s) =>
    [
      `## ${esc(s.nombre)}`,
      s.url && `- URL: ${escUrl(s.url)}`,
      s.categorias?.length && `- Categorías: ${s.categorias.map(esc).join(', ')}`,
      s.tags?.length && `- Tags: ${s.tags.map(esc).join(', ')}`,
      s.endpoints?.length && `- Endpoints: ${s.endpoints.map(esc).join(', ')}`,
      s.descripcion && `\n${esc(s.descripcion)}`,
    ]
      .filter(Boolean)
      .join('\n')
  )
  return ['# VeDirecto — Directorio de sitios de ayuda · Venezuela', '', ...body].join('\n\n')
}

export function noticiasToMarkdown(noticias) {
  const body = noticias.map((n) =>
    [
      `## ${esc(n.titulo)}`,
      n.fecha && `- Fecha: ${esc(n.fecha)}`,
      n.fuente && `- Fuente: ${esc(n.fuente)}`,
      n.url && `- URL: ${escUrl(n.url)}`,
      n.resumen && `\n${esc(n.resumen)}`,
    ]
      .filter(Boolean)
      .join('\n')
  )
  return ['# VeDirecto — Noticias', '', ...body].join('\n\n')
}
