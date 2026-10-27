import { defineConfig } from 'vitest/config'
import { loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const localPreviewRoutes = [
  '^/supabase/auth/v1/(?:token|logout|signup|recover|verify|user|settings)(?:\\?|$)',
  '^/supabase/(?:rest|functions)/v1(?:/|\\?|$)',
]

function previewRequestPath(url: string): string | null {
  let path = url.split('?')[0]
  try {
    for (let pass = 0; pass < 5 && path.includes('%'); pass += 1) {
      path = decodeURIComponent(path)
    }
  } catch {
    return null
  }
  if (path.includes('%') || /[\u0000-\u001f]/.test(path)) return null
  return path.replace(/\\/g, '/')
}

export default defineConfig(({ command, mode }) => {
  const environment = loadEnv(mode, process.cwd(), ['VITE_', 'LOCAL_PREVIEW_'])
  const localPreview = command === 'serve' && environment.VITE_LOCAL_PREVIEW === 'true'
  const previewHost = environment.LOCAL_PREVIEW_HOST?.trim().toLowerCase()
  if (localPreview && previewHost && !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(previewHost)) {
    throw new Error('LOCAL_PREVIEW_HOST must be a hostname without a protocol, port, or path')
  }
  const proxy = {
    target: 'http://127.0.0.1:54321',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/supabase/, ''),
  }
  const previewGuard: Plugin = {
    name: 'local-preview-route-guard',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = previewRequestPath(request.url ?? '/')
        const segments = path?.toLowerCase().split('/').filter(Boolean) ?? []
        const sensitivePath = !path || segments.some(segment => segment === '..' || segment === '@fs'
          || /^\.env/.test(segment) || ['.git', '.agents', '.codex', '.aws', '.temp'].includes(segment))
        const supabasePath = segments[0] === 'supabase'
        // Keep private config and source files out of the remotely shared dev server.
        // Encoded proxy paths are rejected rather than interpreted differently by Vite and Kong.
        const unsupportedProxy = supabasePath && (request.url?.split('?')[0] !== path
          || !localPreviewRoutes.some(route => new RegExp(route).test(path!)))
        if (sensitivePath || unsupportedProxy) {
          response.statusCode = 404
          response.end('Not found')
          return
        }
        next()
      })
    },
  }

  return {
    plugins: [react(), ...(localPreview ? [previewGuard] : [])],
    server: localPreview ? {
      allowedHosts: previewHost ? [previewHost] : undefined,
      // Forward browser operations only, never Auth administration or Studio.
      proxy: Object.fromEntries(localPreviewRoutes.map(route => [route, proxy])),
    } : undefined,
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
  }
})
