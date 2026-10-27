type Result<T> = { data: T | null, error: unknown }

export interface InvitationDependencies {
  siteUrl: string
  allowedOrigins?: string[]
  authorize: (token: string) => Promise<boolean>
  prepare: (token: string, email: string) => Promise<Result<{ email: string, user_id: string | null }>>
  isConfirmed: (id: string) => Promise<boolean>
  invite: (email: string, redirectTo: string) => Promise<{ error: unknown }>
  recover: (email: string, redirectTo: string) => Promise<{ error: unknown }>
}

export function createInvitationHandler(dependencies: InvitationDependencies) {
  const site = new URL(dependencies.siteUrl)
  const allowedOrigins = new Set([site.origin, ...(dependencies.allowedOrigins ?? []).map(origin => new URL(origin).origin)])
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin')
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : site.origin,
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
    }
    const respond = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers })
    if (origin && !allowedOrigins.has(origin)) return respond(403, { error: 'Origin not allowed' })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return respond(405, { error: 'POST required' })
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]
    if (!token) return respond(401, { error: 'Sign in required' })
    try {
      if (!await dependencies.authorize(token)) return respond(403, { error: 'Admin access required' })
      let email: unknown
      try {
        email = (await request.json()).email
      } catch {
        return respond(400, { error: 'Invalid request' })
      }
      if (typeof email !== 'string' || email.trim().length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return respond(400, { error: 'Enter a valid email address' })
      }
      const prepared = await dependencies.prepare(token, email.trim().toLowerCase())
      if (prepared.error || !prepared.data) return respond(403, { error: 'Invitation could not be prepared' })
      // The database resolves existing accounts by email; the request cannot pick a user ID.
      const existing = prepared.data.user_id && await dependencies.isConfirmed(prepared.data.user_id)
      const redirectTo = new URL(existing ? '/organizers/recovery' : '/organizers/register', site).href
      const result = existing
        ? await dependencies.recover(prepared.data.email, redirectTo)
        : await dependencies.invite(prepared.data.email, redirectTo)
      if (result.error) return respond(502, { error: 'Email could not be sent. The invitation is saved; retry sending it.' })
      return respond(200, { message: existing ? 'Account access granted and a password setup email sent.' : 'Invitation email sent.' })
    } catch {
      return respond(502, { error: 'Email could not be sent. Please retry.' })
    }
  }
}
