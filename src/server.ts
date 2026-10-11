import projectWorker from './server/worker'

export default {
  async fetch(request, env, context) {
    const path = new URL(request.url).pathname
    if (path === '/api' || path.startsWith('/api/'))
      return projectWorker.fetch(request, env, context)

    // Static assets serve the production SPA; Start renders its shell in dev and during builds.
    const { default: start } = await import('@tanstack/react-start/server-entry')
    return start.fetch(request)
  },
} satisfies ExportedHandler<Env>
