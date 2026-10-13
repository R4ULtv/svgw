import { fileURLToPath, URL } from 'node:url'
import { writeFile } from 'node:fs/promises'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart({
      server: { build: { inlineCss: true } },
      spa: {
        enabled: true,
        // Use a browser-only route for the fallback so the Cloudflare prerender
        // runtime emits an empty shell independently of the public homepage.
        maskPath: '/projects',
        prerender: {
          outputPath: '/_shell.html',
          // Emit rewrites only after their target exists. The same asset runtime
          // serves build-time requests, so public rewrites would break prerendering.
          onSuccess: async () => {
            await writeFile(
              new URL('./dist/client/_redirects', import.meta.url),
              '/projects /_shell 200\n/projects/ /_shell 200\n/project/:id /_shell 200\n/project/:id/ /_shell 200\n',
            )
          },
        },
      },
      // Paint the public homepage before JavaScript; browser-only routes use the shell.
      prerender: { enabled: true, autoStaticPathsDiscovery: false, crawlLinks: false },
      pages: [{ path: '/' }],
    }),
    react(),
  ],
  worker: { format: 'es' },
})
