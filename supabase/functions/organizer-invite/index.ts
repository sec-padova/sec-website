import { createClient } from 'npm:@supabase/supabase-js@2.117.1'
import { createInvitationHandler } from './handler.ts'

const url = Deno.env.get('SUPABASE_URL')!
const browserKey = Deno.env.get('SUPABASE_ANON_KEY')!
const secret = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const admin = createClient(url, secret, options)
const caller = (token: string) => createClient(url, browserKey, {
  ...options, global: { headers: { Authorization: `Bearer ${token}` } },
})

Deno.serve(createInvitationHandler({
  siteUrl: Deno.env.get('ORGANIZER_SITE_URL')!,
  allowedOrigins: Deno.env.get('ORGANIZER_ALLOWED_ORIGINS')?.split(',').map(origin => origin.trim()).filter(Boolean),
  async authorize(token) {
    const client = caller(token)
    const { data: user, error } = await client.auth.getUser(token)
    if (error || !user.user) return false
    const { data, error: contextError } = await client.rpc('organizer_context')
    return !contextError && data?.authorized === true && data?.is_admin === true && Boolean(data?.profile)
  },
  async prepare(token, email) {
    return await caller(token).rpc('admin_prepare_organizer_invitation', { p_email: email })
  },
  async isConfirmed(id) {
    const { data, error } = await admin.auth.admin.getUserById(id)
    if (error) throw error
    return Boolean(data.user?.email_confirmed_at)
  },
  async generate(email, type, redirectTo) {
    const { data, error } = await admin.auth.admin.generateLink({ type, email, options: { redirectTo } })
    return { data: data.properties, error }
  },
}))
