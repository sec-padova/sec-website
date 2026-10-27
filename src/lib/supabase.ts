import { createClient } from '@supabase/supabase-js'

function isBrowserKey(key: string): boolean {
  if (key.startsWith('sb_publishable_')) return true
  if (!key.startsWith('eyJ')) return false

  try {
    const payload = key.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'
  } catch {
    return false
  }
}

export function createBrowserSupabaseClient(url: string, key: string) {
  const parsed = new URL(url)
  const localPreview = import.meta.env.DEV && import.meta.env.VITE_LOCAL_PREVIEW === 'true'
    && parsed.origin === window.location.origin && parsed.pathname === '/supabase'
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && (['localhost', '127.0.0.1'].includes(parsed.hostname) || localPreview))) {
    throw new Error('Supabase requires HTTPS outside local development')
  }
  if (!isBrowserKey(key)) {
    throw new Error('Use a Supabase publishable or anon key in the browser, never a secret key')
  }
  return createClient(url, key)
}

export function resolveBrowserSupabaseUrl(configuredUrl: string, origin: string): string {
  return import.meta.env.DEV && import.meta.env.VITE_LOCAL_PREVIEW === 'true'
    ? new URL('/supabase', origin).href
    : configuredUrl
}

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// The public landing page works before the deployment environment is configured.
export const supabase = url && key ? createBrowserSupabaseClient(resolveBrowserSupabaseUrl(url, window.location.origin), key) : null
