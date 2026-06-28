// Liveness probe para Docker/Dokploy. No toca la DB a propósito.
export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({ status: 'ok' })
}
