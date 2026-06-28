// Render del directorio a Markdown — formato eficiente en tokens para que un LLM
// lo lea de un saque. Lo consume /api/sitios.md y /api/noticias.md.

export function sitiosToMarkdown(sitios) {
  const body = sitios.map((s) =>
    [
      `## ${s.nombre}`,
      s.url && `- URL: ${s.url}`,
      s.categoria && `- Categoría: ${s.categoria}`,
      s.tags?.length && `- Tags: ${s.tags.join(', ')}`,
      s.endpoints?.length && `- Endpoints: ${s.endpoints.join(', ')}`,
      s.descripcion && `\n${s.descripcion}`,
    ]
      .filter(Boolean)
      .join('\n')
  )
  return ['# VeDirecto — Directorio de sitios de ayuda · Venezuela', '', ...body].join('\n\n')
}

export function noticiasToMarkdown(noticias) {
  const body = noticias.map((n) =>
    [`## ${n.titulo}`, n.fecha && `- Fecha: ${n.fecha}`, n.fuente && `- Fuente: ${n.fuente}`, n.url && `- URL: ${n.url}`, n.resumen && `\n${n.resumen}`]
      .filter(Boolean)
      .join('\n')
  )
  return ['# VeDirecto — Noticias', '', ...body].join('\n\n')
}
