// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createInvitationHandler, type InvitationDependencies } from './handler'

function fixture(overrides: Partial<InvitationDependencies> = {}) {
  const dependencies = {
    siteUrl: 'https://sec.example.org',
    authorize: vi.fn().mockResolvedValue(true),
    prepare: vi.fn().mockResolvedValue({ data: { email: 'ada@example.com', user_id: null }, error: null }),
    isConfirmed: vi.fn().mockResolvedValue(false),
    generate: vi.fn().mockResolvedValue({ data: { hashed_token: 'private-token' }, error: null }),
    ...overrides,
  }
  const handler = createInvitationHandler(dependencies)
  const request = (body: object = { email: ' Ada@Example.com ' }, authorization = 'Bearer verified-token') => handler(new Request('https://functions.example.org/organizer-invite', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization, origin: dependencies.siteUrl }, body: JSON.stringify(body),
  }))
  return { dependencies, handler, request }
}

describe('organizer invitation endpoint', () => {
  it('rejects missing authentication and non-admin callers before side effects', async () => {
    const { request, dependencies } = fixture({ authorize: vi.fn().mockResolvedValue(false) })
    expect((await request({}, '')).status).toBe(401)
    expect((await request()).status).toBe(403)
    expect(dependencies.prepare).not.toHaveBeenCalled()
    expect(dependencies.generate).not.toHaveBeenCalled()
  })

  it('rejects foreign origins and malformed input', async () => {
    const { handler, request, dependencies } = fixture()
    expect((await handler(new Request('https://example.org', { method: 'OPTIONS', headers: { origin: 'https://attacker.example.org' } }))).status).toBe(403)
    expect((await request({ email: 'invalid' })).status).toBe(400)
    expect((await request({ email: null })).status).toBe(400)
    expect(dependencies.prepare).not.toHaveBeenCalled()
  })

  it('prepares a normalized invitation and returns a private link on the fixed site without sending email', async () => {
    const { request, dependencies } = fixture()
    const response = await request({ email: ' Ada@Example.com ', user_id: 'forged', is_admin: true, redirectTo: 'https://attacker.example.org' })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toMatchObject({ email: 'ada@example.com', invitation_url: 'https://sec.example.org/organizers/register?token_hash=private-token&type=invite' })
    expect(dependencies.prepare).toHaveBeenCalledWith('verified-token', 'ada@example.com')
    expect(dependencies.generate).toHaveBeenCalledWith('ada@example.com', 'invite', 'https://sec.example.org/organizers/register')
  })

  it('does not generate a link if preparation is denied after authorization', async () => {
    const { request, dependencies } = fixture({ prepare: vi.fn().mockResolvedValue({ data: null, error: { code: '42501' } }) })
    expect((await request()).status).toBe(403)
    expect(dependencies.generate).not.toHaveBeenCalled()
  })

  it('allows an explicitly configured local origin while keeping invitation links on the shared site', async () => {
    const { handler, dependencies } = fixture({ allowedOrigins: ['http://localhost:5173'] })
    const response = await handler(new Request('https://functions.example.org/organizer-invite', {
      method: 'POST', headers: { authorization: 'Bearer verified-token', origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'ada@example.com' }),
    }))
    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect(dependencies.generate).toHaveBeenCalledWith('ada@example.com', 'invite', 'https://sec.example.org/organizers/register')
  })

  it('uses password setup for an existing confirmed account', async () => {
    const { request, dependencies } = fixture({
      prepare: vi.fn().mockResolvedValue({ data: { email: 'ada@example.com', user_id: 'known-user' }, error: null }),
      isConfirmed: vi.fn().mockResolvedValue(true),
    })
    const response = await request()
    expect(response.status).toBe(200)
    expect(dependencies.isConfirmed).toHaveBeenCalledWith('known-user')
    expect(dependencies.generate).toHaveBeenCalledWith('ada@example.com', 'recovery', 'https://sec.example.org/organizers/recovery')
    expect(await response.json()).toMatchObject({ invitation_url: 'https://sec.example.org/organizers/recovery?token_hash=private-token&type=recovery' })
  })

  it('creates another invitation link for an unconfirmed existing account', async () => {
    const { request, dependencies } = fixture({ prepare: vi.fn().mockResolvedValue({ data: { email: 'ada@example.com', user_id: 'pending-user' }, error: null }) })
    expect((await request()).status).toBe(200)
    expect(dependencies.generate).toHaveBeenCalledWith('ada@example.com', 'invite', 'https://sec.example.org/organizers/register')
  })

  it('reports generation failure without exposing provider errors or tokens and allows retry', async () => {
    const { request, dependencies } = fixture()
    vi.mocked(dependencies.generate).mockResolvedValueOnce({ data: null, error: new Error('secret provider details') })
    const failed = await request()
    expect(failed.status).toBe(502)
    expect(await failed.text()).not.toContain('secret provider details')
    expect((await request()).status).toBe(200)
    expect(dependencies.prepare).toHaveBeenCalledTimes(2)
  })

  it('rejects a response without a token', async () => {
    const { request } = fixture({ generate: vi.fn().mockResolvedValue({ data: null, error: null }) })
    expect((await request()).status).toBe(502)
  })
})
