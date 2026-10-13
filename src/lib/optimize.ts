export interface OptimizationResult {
  svg: string
  originalBytes: number
  optimizedBytes: number
}

interface Pending {
  finish: (svg: string | undefined, error?: unknown) => void
}

let worker: Worker | undefined
let nextId = 0
let idle: ReturnType<typeof setTimeout> | undefined
const pending = new Map<number, Pending>()
let cached: { source: string; result: OptimizationResult } | undefined

function stop(error?: unknown) {
  worker?.terminate()
  worker = undefined
  cached = undefined
  for (const request of pending.values()) request.finish(undefined, error)
  clearTimeout(idle)
}

function getWorker() {
  clearTimeout(idle)
  if (!worker) {
    // Keep SVGO warm across edits; release its memory after ten idle seconds.
    worker = new Worker(new URL('../workers/svgo.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<{ id: number; svg?: string; error?: string }>) => {
      pending
        .get(event.data.id)
        ?.finish(event.data.svg, event.data.error ? new Error(event.data.error) : undefined)
    }
    worker.onerror = () => stop(new Error('Could not start the SVG optimization worker.'))
  }
  return worker
}

export async function optimizeSvg(
  svg: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<OptimizationResult> {
  signal?.throwIfAborted()
  if (cached?.source === svg) return cached.result
  const engine = getWorker()
  const id = ++nextId
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => stop(new Error('Optimization timed out. Try standard SVG export.')),
      30_000,
    )
    const abort = () => {
      finish(undefined, signal!.reason)
      // Cancel abandoned background work without interrupting another export.
      if (!pending.size) stop()
    }
    function finish(output: string | undefined, error?: unknown) {
      if (!pending.delete(id)) return
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
      if (error || !output) reject(error ?? new Error('Could not optimize this SVG.'))
      else {
        const result = {
          svg: output,
          originalBytes: new Blob([svg]).size,
          optimizedBytes: new Blob([output]).size,
        }
        cached = { source: svg, result }
        resolve(result)
      }
      if (!pending.size) idle = setTimeout(() => stop(), 10_000)
    }
    pending.set(id, { finish })
    signal?.addEventListener('abort', abort, { once: true })
    try {
      engine.postMessage({ id, svg })
    } catch (cause) {
      finish(undefined, cause)
    }
  })
}
