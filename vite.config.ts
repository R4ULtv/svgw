import { fileURLToPath, URL } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // SVG-Edit's prebuilt bundle inlines its PDF export and core-js. Build the engine from its
      // ES source instead, with the PDF libraries stubbed out (see pdf-stub.ts).
      { find: /^@svgedit\/svgcanvas$/, replacement: '@svgedit/svgcanvas/svgcanvas.js' },
      {
        find: /^(jspdf|svg2pdf\.js)$/,
        replacement: fileURLToPath(new URL('./src/lib/pdf-stub.ts', import.meta.url)),
      },
    ],
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
            // Project links share one preview image, so they get a copy of the shell
            // whose Open Graph tags describe a project instead of the homepage.
            const shell = await readFile(
              new URL('./dist/client/_shell.html', import.meta.url),
              'utf8',
            )
            const projectShell = shell
              .replaceAll('/og/home.png', '/og/project.png')
              .replace(
                /(<meta property="og:title" content=")[^"]*/,
                '$1Open it up. Make it yours. — svgw',
              )
              .replace(/(<meta property="og:image:alt" content=")[^"]*/, '$1An SVG project in svgw')
            if (projectShell.split('/og/project.png').length !== 3)
              throw new Error('The project shell is missing its Open Graph image tags.')
            await writeFile(new URL('./dist/client/_project.html', import.meta.url), projectShell)
            await writeFile(
              new URL('./dist/client/_redirects', import.meta.url),
              '/projects /_shell 200\n/projects/ /_shell 200\n/project/:id /_project 200\n/project/:id/ /_project 200\n',
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
