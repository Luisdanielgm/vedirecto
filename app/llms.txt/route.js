export const dynamic = 'force-dynamic'

const TXT = `# VeDirecto · Venezuela
> Directorio público de sitios y aplicaciones de ayuda, con etiquetas, categorías y endpoints, más una sección de noticias.

## Endpoints (lectura libre, CORS abierto)
- /api/sitios       → directorio completo (JSON)
- /api/sitios.md    → directorio completo (Markdown)
- /api/noticias     → noticias (JSON)
- /api/noticias.md  → noticias (Markdown)

## Notas
- Datos de libre lectura, pensados para humanos y agentes.
- Las altas se hacen por análisis de un LLM sobre el sitio (no es un formulario abierto).
`

export async function GET() {
  return new Response(TXT, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  })
}
