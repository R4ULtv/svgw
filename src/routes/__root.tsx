import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider, themeScript } from '@/components/theme'
import { CommandProvider } from '@/components/commands'
import { AdminSessionProvider } from '@/lib/admin-session'
import styles from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'svgw — your SVG workspace' },
      { name: 'description', content: 'Edit, save, and optimize SVGs in your browser.' },
    ],
    links: [
      { rel: 'stylesheet', href: styles },
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
