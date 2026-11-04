import { createClient } from 'npm:@supabase/supabase-js@2.117.1'
import { createRegistrationHandler } from './handler.ts'

const url = Deno.env.get('SUPABASE_URL')!
const key = Deno.env.get('SUPABASE_ANON_KEY')!
const secret = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const admin = createClient(url, secret, options)
Deno.serve(createRegistrationHandler({
  siteUrl: Deno.env.get('ORGANIZER_SITE_URL')!,
  allowedOrigins: Deno.env.get('ORGANIZER_ALLOWED_ORIGINS')?.split(',').map(value => value.trim()).filter(Boolean),
  async hash(token) {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  },
  randomToken() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('') },
  async check(hash, email) { return await admin.rpc('check_organizer_registration', { p_hash: hash, p_email: email ?? null }) },
  async create(email, password) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { organizer_registration: 'shared-link' } })
    return { id: data.user?.id, error }
  },
  async identify(jwt) {
    const { data, error } = await admin.auth.getUser(jwt)
    return error ? null : data.user?.id ?? null
  },
  async redeem(hash, id) { return await admin.rpc('redeem_organizer_registration', { p_hash: hash, p_user_id: id }) },
  async manage(jwt, hash, revoke) {
    const caller = createClient(url, key, { ...options, global: { headers: { Authorization: `Bearer ${jwt}` } } })
    const { data, error } = await caller.auth.getUser(jwt)
    if (error || !data.user) return { error: { code: '42501' } }
    return await caller.rpc('admin_registration_link', { p_hash: hash, p_revoke: revoke })
  },
}))
