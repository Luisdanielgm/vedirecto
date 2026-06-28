import { listNoticias } from '../../../lib/db'

export async function GET() {
  return Response.json(listNoticias(), { headers: { 'Access-Control-Allow-Origin': '*' } })
}
