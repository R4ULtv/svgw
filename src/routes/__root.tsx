import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider, themeScript } from '@/components/theme'
import { CommandProvider } from '@/components/commands'
import { AdminSessionProvider } from '@/lib/admin-session'
import '../styles.css'
import sansFont from '@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2?url'

// Social crawlers require absolute image URLs. Matches the custom domain in wrangler.jsonc.
const SITE_URL = 'https://svgw.raulcarini.dev'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'svgw — your SVG workspace' },
      { name: 'description', content: 'Edit, save, and optimize SVGs in your browser.' },
      // The build swaps these image tags in the project shell; see vite.config.ts.
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'svgw' },
      { property: 'og:title', content: 'svgw — your SVG workspace' },
      { property: 'og:description', content: 'Edit, save, and optimize SVGs in your browser.' },
      { property: 'og:image', content: `${SITE_URL}/og/home.png` },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: 'svgw: Less setup. More play.' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:image', content: `${SITE_URL}/og/home.png` },
    ],
    links: [
      { rel: 'preload', href: sansFont, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
      {
        rel: 'icon',
        type: 'image/x-icon',
        sizes: '16x16 32x32 48x48 64x64 128x128 256x256',
        href: '/favicon.ico',
      },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
      { rel: 'icon', type: 'image/png', sizes: '64x64', href: '/favicon-64.png' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    ],
  }),
  component: () => (
    <CommandProvider>
      <AdminSessionProvider>
        <Outlet />
      </AdminSessionProvider>
    </CommandProvider>
  ),
  shellComponent: Document,
  notFoundComponent: () => (
    <main className="grid h-dvh place-items-center p-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-base font-medium">Page not found</h1>
        <Button render={<a href="/" />} nativeButton={false} variant="outline">
          Open svgw
        </Button>
      </div>
    </main>
  ),
})

// The theme script sets the `dark` class before React hydrates, so the class can differ from the prerendered shell.
function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>
          <TooltipProvider delay={400}>{children}</TooltipProvider>
          <Toaster position="bottom-right" />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
