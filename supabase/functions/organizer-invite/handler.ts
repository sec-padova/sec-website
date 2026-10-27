type Result<T> = { data: T | null, error: unknown }

export interface InvitationDependencies {
  siteUrl: string
  allowedOrigins?: string[]
  authorize: (token: string) => Promise<boolean>
  prepare: (token: string, email: string) => Promise<Result<{ email: string, user_id: string | null }>>
  isConfirmed: (id: string) => Promise<boolean>
  generate: (email: string, type: 'invite' | 'recovery', redirectTo: string) => Promise<Result<{ hashed_token: string }>>
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
      const type = existing ? 'recovery' : 'invite'
      const link = new URL(existing ? '/organizers/recovery' : '/organizers/register', site)
      const result = await dependencies.generate(prepared.data.email, type, link.href)
      if (result.error || !result.data?.hashed_token) return respond(502, { error: 'Could not create the link. The invitation is saved; please retry.' })
      link.searchParams.set('token_hash', result.data.hashed_token)
      link.searchParams.set('type', type)
      return respond(200, { message: 'Private link ready. Send it directly to the invited person.', email: prepared.data.email, invitation_url: link.href })
    } catch {
      return respond(502, { error: 'Could not create the link. Please retry.' })
    }
  }
}
