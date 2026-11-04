type Result = { error: { code?: string } | null }
export interface RegistrationDependencies {
  siteUrl: string
  allowedOrigins?: string[]
  hash: (token: string) => Promise<string>
  check: (hash: string, email?: string) => Promise<Result>
  create: (email: string, password: string) => Promise<Result & { id?: string }>
  identify: (jwt: string) => Promise<string | null>
  redeem: (hash: string, id: string) => Promise<Result>
  manage: (jwt: string, hash: string | null, revoke: boolean) => Promise<Result & { data?: unknown }>
  randomToken: () => string
}
export function createRegistrationHandler(deps: RegistrationDependencies) {
  const site = new URL(deps.siteUrl)
  const origins = new Set([site.origin, ...(deps.allowedOrigins ?? []).map(value => new URL(value).origin)])
  return async (request: Request) => {
    const origin = request.headers.get('origin')
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': origin && origins.has(origin) ? origin : site.origin,
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' }
    const respond = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers })
    const failure = (error: { code?: string }) => respond(error.code === 'PT410' ? 410 : error.code === 'PT429' ? 429 : 403,
      { error: error.code === 'PT410' ? 'This registration link has expired or been revoked. Ask the admin for a new link.' : error.code === 'PT429' ? 'Too many attempts. Please retry in 15 minutes.' : 'Access unavailable. Ask the admin to restore your access if it was revoked.' })
    if (origin && !origins.has(origin)) return respond(403, { error: 'Origin not allowed' })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return respond(405, { error: 'POST required' })
    try {
      const body = await request.json()
      const jwt = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1] ?? ''
      if (['create-link', 'revoke-link', 'link-status'].includes(body.action)) {
        const token = body.action === 'create-link' ? deps.randomToken() : null
        const result = await deps.manage(jwt, token ? await deps.hash(token) : null, body.action === 'revoke-link')
        if (result.error) return failure(result.error)
        return respond(200, { link: result.data, ...(token ? { invitation_url: new URL(`/organizers/register#join=${token}`, site).href } : {}) })
      }
      if (!['check', 'register', 'redeem'].includes(body.action) || typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) return respond(400, { error: 'Invalid registration link' })
      const hash = await deps.hash(body.token)
      let email: string | undefined
      if (body.action === 'register') {
        if (typeof body.email !== 'string' || body.email.trim().length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) || typeof body.password !== 'string' || body.password.length < 12) return respond(400, { error: 'Enter a valid email and a password of at least 12 characters.' })
        email = body.email.trim().toLowerCase()
      }
      const checked = await deps.check(hash, email)
      if (checked.error) return failure(checked.error)
      if (body.action === 'check') return respond(200, { valid: true })
      let id: string | undefined | null
      if (body.action === 'register') {
        const created = await deps.create(email!, body.password)
        if (created.error) return respond(created.error.code === 'email_exists' ? 409 : 400, { error: created.error.code === 'email_exists' ? 'An account already exists. Sign in with your existing password to join.' : 'Could not create your account. Check your password or try signing in if an earlier attempt created it.' })
        id = created.id
      } else id = await deps.identify(jwt)
      if (!id) return respond(401, { error: 'Sign in with your existing account to join.' })
      const result = await deps.redeem(hash, id)
      if (result.error) return failure(result.error)
      return respond(200, { registered: true })
    } catch { return respond(400, { error: 'Could not complete registration. Please retry or sign in if your account was already created.' }) }
  }
}
