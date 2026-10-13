import projectWorker from './server/worker'

export default {
  async fetch(request, env, context) {
    const path = new URL(request.url).pathname
    if (path === '/api' || path.startsWith('/api/'))
      return projectWorker.fetch(request, env, context)

    // Assets serve the homepage and browser-only shell. Start also renders real
    // 404s for unmatched URLs, so they never hydrate against the homepage's HTML.
    const { default: start } = await import('@tanstack/react-start/server-entry')
    return start.fetch(request)
  },
} satisfies ExportedHandler<Env>
