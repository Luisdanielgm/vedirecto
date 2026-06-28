import { listNoticias } from '../../../lib/db'
import { noticiasToMarkdown } from '../../../lib/markdown'

export const dynamic = 'force-dynamic'

export async function GET() {
  return new Response(noticiasToMarkdown(listNoticias()), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  })
}
