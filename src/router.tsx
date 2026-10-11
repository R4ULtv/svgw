import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    // The editor manages pan, zoom, and initial centering. Restoring page scroll
    // here would overwrite the new canvas with the previous project's position.
    scrollRestoration: ({ location }) => !location.pathname.startsWith('/project/'),
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
