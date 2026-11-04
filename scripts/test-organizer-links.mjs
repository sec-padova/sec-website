import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'

// Run against local Supabase only. This exercises PostgREST's safeupdate guard,
// which ordinary pgTAP sessions do not enable.
const local = JSON.parse(execFileSync('./node_modules/.bin/supabase', ['status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
assert.equal(new URL(local.API_URL).origin, 'http://127.0.0.1:54321', 'HTTP tests require the local Supabase API')
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, options)
const client = createClient(local.API_URL, local.PUBLISHABLE_KEY ?? local.ANON_KEY, options)
const sql = query => execFileSync('docker', ['exec', '-i', 'supabase_db_sec-website', 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const literal = value => `'${value.replaceAll("'", "''")}'`

async function invoke(action, extra = {}) {
  const result = await client.functions.invoke('organizer-register', { body: { action, ...extra } })
  if (result.error) {
    const response = result.error.context
    return { status: response?.status ?? 0, data: response ? await response.json() : null }
  }
  return { status: 200, data: result.data }
}

test('admin creates, replaces, and revokes shared links through the HTTP API', async () => {
  const snapshot = sql('select row_to_json(l) from private.organizer_registration_link l;')
  const email = `organizer-http-${randomUUID()}@example.com`
  const password = `Local-test-${randomUUID()}`
  let userId
  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { first_name: 'HTTP', last_name: 'Test', affiliation: 'external' } })
    assert.equal(created.error, null, 'disposable local account creation succeeds')
    userId = created.data.user.id
    assert.match(userId, /^[a-f0-9-]{36}$/)
    sql(`insert into public.organizers(id) values (${literal(userId)});
      insert into private.organizer_profiles values (${literal(userId)}, 'HTTP', 'Test');
      insert into private.workspace_admins values (${literal(userId)});`)
    const signedIn = await client.auth.signInWithPassword({ email, password })
    assert.equal(signedIn.error, null)

    const first = await invoke('create-link')
    assert.equal(first.status, 200, 'authenticated admin can create a link through PostgREST')
    assert.equal(Date.parse(first.data.link.expires_at) - Date.parse(first.data.link.created_at), 8 * 60 * 60 * 1000)
    const firstToken = new URLSearchParams(new URL(first.data.invitation_url).hash.slice(1)).get('join')
    assert.equal((await invoke('check', { token: firstToken })).status, 200)

    const second = await invoke('create-link')
    assert.equal(second.status, 200, 'replacement succeeds under safeupdate')
    const secondToken = new URLSearchParams(new URL(second.data.invitation_url).hash.slice(1)).get('join')
    assert.notEqual(firstToken, secondToken)
    assert.equal((await invoke('check', { token: firstToken })).status, 410)
    assert.equal((await invoke('check', { token: secondToken })).status, 200)

    assert.equal((await invoke('revoke-link')).status, 200, 'revocation succeeds under safeupdate')
    assert.equal((await invoke('check', { token: secondToken })).status, 410)
    assert.ok((await invoke('link-status')).data.link.revoked_at)
  } finally {
    try {
      sql(`update private.organizer_registration_link set (token_hash, created_by, created_at, expires_at, revoked_at) =
        (select token_hash, created_by, created_at, expires_at, revoked_at
          from json_populate_record(null::private.organizer_registration_link, ${literal(snapshot)})) where singleton;`)
    } finally {
      if (userId) assert.equal((await admin.auth.admin.deleteUser(userId)).error, null, 'disposable local account is removed')
      await client.auth.signOut({ scope: 'local' })
    }
  }
})
