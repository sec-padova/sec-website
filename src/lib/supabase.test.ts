import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBrowserSupabaseClient, resolveBrowserSupabaseUrl } from './supabase'

describe('Supabase browser client', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('accepts a hosted HTTPS project and a publishable key', () => {
    const client = createBrowserSupabaseClient('https://example.supabase.co', 'sb_publishable_example')
    expect(client.auth).toBeDefined()
  })

  it('rejects server secrets and insecure hosted URLs', () => {
    expect(() => createBrowserSupabaseClient('https://example.supabase.co', 'sb_secret_example')).toThrow(/publishable/i)
    expect(() => createBrowserSupabaseClient('http://example.supabase.co', 'sb_publishable_example')).toThrow(/https/i)
  })

  it('uses the current device origin only for an explicitly enabled development preview', () => {
    vi.stubEnv('VITE_LOCAL_PREVIEW', 'true')
    expect(resolveBrowserSupabaseUrl('http://127.0.0.1:54321', 'http://192.168.1.2:5173')).toBe('http://192.168.1.2:5173/supabase')
    expect(createBrowserSupabaseClient(`${window.location.origin}/supabase`, 'sb_publishable_example').auth).toBeDefined()
    expect(() => createBrowserSupabaseClient('http://192.168.1.3:54321', 'sb_publishable_example')).toThrow(/https/i)
  })

  it('never enables the preview origin override in a production build', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_LOCAL_PREVIEW', 'true')
    expect(resolveBrowserSupabaseUrl('https://example.supabase.co', 'http://192.168.1.2:5173')).toBe('https://example.supabase.co')
    expect(() => createBrowserSupabaseClient('http://192.168.1.2:5173/supabase', 'sb_publishable_example')).toThrow(/https/i)
  })

  it('keeps the configured project URL when local preview is disabled', () => {
    vi.stubEnv('VITE_LOCAL_PREVIEW', 'false')
    expect(resolveBrowserSupabaseUrl('http://127.0.0.1:54321', 'http://192.168.1.2:5173')).toBe('http://127.0.0.1:54321')
  })
})
