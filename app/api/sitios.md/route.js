import { listSitios } from '../../../lib/db'
import { sitiosToMarkdown } from '../../../lib/markdown'

export const dynamic = 'force-dynamic'

export async function GET() {
  return new Response(sitiosToMarkdown(listSitios()), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  })
}
