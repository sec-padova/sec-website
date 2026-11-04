// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createRegistrationHandler, type RegistrationDependencies } from './handler'
const token = 'a'.repeat(64)
function fixture(overrides: Partial<RegistrationDependencies> = {}) {
  const deps = { siteUrl: 'https://sec.example.org', hash: vi.fn().mockResolvedValue('hashed'), randomToken: () => token,
    check: vi.fn().mockResolvedValue({ error: null }), create: vi.fn().mockResolvedValue({ id: 'new', error: null }),
    identify: vi.fn().mockResolvedValue('existing'), redeem: vi.fn().mockResolvedValue({ error: null }),
    manage: vi.fn().mockResolvedValue({ data: { expires_at: '2026-11-04T20:00:00Z' }, error: null }), ...overrides }
  const handler = createRegistrationHandler(deps)
  const request = (body: object) => handler(new Request('https://api.example.org', { method: 'POST', headers: { origin: deps.siteUrl, authorization: 'Bearer jwt' }, body: JSON.stringify(body) }))
  return { deps, request, handler }
}
describe('shared organizer registration', () => {
  it('checks validity before provisioning and rechecks through admission', async () => {
    const { deps, request } = fixture()
    expect((await request({ action: 'register', token, email: ' Ada@Example.org ', password: 'a-long-password' })).status).toBe(200)
    expect(deps.check).toHaveBeenCalledWith('hashed', 'ada@example.org')
    expect(deps.create).toHaveBeenCalledWith('ada@example.org', 'a-long-password')
    expect(deps.redeem).toHaveBeenCalledWith('hashed', 'new')
    expect(deps.check.mock.invocationCallOrder[0]).toBeLessThan(deps.create.mock.invocationCallOrder[0])
  })
  it.each(['PT410', 'PT429', '42501'])('does not provision rejected requests (%s)', async code => {
    const { deps, request } = fixture({ check: vi.fn().mockResolvedValue({ error: { code } }) })
    expect((await request({ action: 'register', token, email: 'ada@example.org', password: 'a-long-password' })).status).toBe(code === 'PT410' ? 410 : code === 'PT429' ? 429 : 403)
    expect(deps.create).not.toHaveBeenCalled()
  })
  it('cannot choose another account when redeeming', async () => {
    const { deps, request } = fixture()
    await request({ action: 'redeem', token, user_id: 'victim' })
    expect(deps.redeem).toHaveBeenCalledWith('hashed', 'existing')
    expect(deps.create).not.toHaveBeenCalled()
  })
  it('requires a verified identity for existing accounts', async () => {
    const { request, deps } = fixture({ identify: vi.fn().mockResolvedValue(null) })
    expect((await request({ action: 'redeem', token })).status).toBe(401)
    expect(deps.redeem).not.toHaveBeenCalled()
  })
  it('never overwrites credentials for an existing email', async () => {
    const { request, deps } = fixture({ create: vi.fn().mockResolvedValue({ error: { code: 'email_exists' } }) })
    expect((await request({ action: 'register', token, email: 'ada@example.org', password: 'a-long-password' })).status).toBe(409)
    expect(deps.redeem).not.toHaveBeenCalled()
  })
  it('rejects malformed tokens and foreign origins', async () => {
    const { request, handler, deps } = fixture()
    expect((await request({ action: 'register', token: 'short' })).status).toBe(400)
    expect((await handler(new Request('https://api.example.org', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }))).status).toBe(403)
    expect(deps.check).not.toHaveBeenCalled()
  })
  it('reports database safety errors as server failures rather than revoked access', async () => {
    const { request } = fixture({ manage: vi.fn().mockResolvedValue({ error: { code: '21000' } }) })
    const response = await request({ action: 'create-link' })
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toContain('server error')
    expect(body.error).not.toMatch(/revoked|restore/i)
  })
  it('distinguishes an invalid session from a missing admin grant', async () => {
    const { request } = fixture({ manage: vi.fn().mockResolvedValue({ error: { code: 'SESSION_INVALID' } }) })
    const response = await request({ action: 'create-link' })
    expect(response.status).toBe(401)
    expect((await response.json()).error).toContain('session')
  })
  it('returns a fragment link only after admin authorization', async () => {
    const { request, deps } = fixture()
    expect(await (await request({ action: 'create-link' })).json()).toMatchObject({ invitation_url: `https://sec.example.org/organizers/register#join=${token}` })
    deps.manage.mockResolvedValueOnce({ error: { code: '42501' } })
    const denied = await request({ action: 'create-link' })
    expect(denied.status).toBe(403)
    expect(await denied.text()).not.toContain(token)
  })
})
