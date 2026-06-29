import { getAuthedUser, isAdmin } from '../../../lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getAuthedUser()
  return Response.json({ email: user?.email ?? null, isAdmin: isAdmin(user) })
}
