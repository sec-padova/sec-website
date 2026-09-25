import { describe, expect, it } from 'vitest'
import { createBrowserSupabaseClient } from './supabase'

describe('Supabase browser client', () => {
  it('accepts a hosted HTTPS project and a publishable key', () => {
    const client = createBrowserSupabaseClient('https://example.supabase.co', 'sb_publishable_example')
    expect(client.auth).toBeDefined()
  })

  it('rejects server secrets and insecure hosted URLs', () => {
    expect(() => createBrowserSupabaseClient('https://example.supabase.co', 'sb_secret_example')).toThrow(/publishable/i)
    expect(() => createBrowserSupabaseClient('http://example.supabase.co', 'sb_publishable_example')).toThrow(/https/i)
  })
})
