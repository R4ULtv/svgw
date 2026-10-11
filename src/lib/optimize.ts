export interface OptimizationResult {
  svg: string
  originalBytes: number
  optimizedBytes: number
}

export async function optimizeSvg(svg: string): Promise<OptimizationResult> {
  // Vite emits a separate worker chunk; SVGO never runs on the UI thread.
  const worker = new Worker(new URL('../workers/svgo.worker.ts', import.meta.url), {
    type: 'module',
  })
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.terminate()
      reject(new Error('Optimization timed out. Try standard SVG export.'))
    }, 30_000)
    function finish() {
      clearTimeout(timeout)
      worker.terminate()
    }
    worker.onmessage = (event: MessageEvent<{ svg?: string; error?: string }>) => {
      finish()
      if (event.data.error || !event.data.svg) {
        reject(new Error(event.data.error ?? 'Could not optimize this SVG.'))
      } else {
        resolve({
          svg: event.data.svg,
          originalBytes: new Blob([svg]).size,
          optimizedBytes: new Blob([event.data.svg]).size,
        })
      }
    }
    worker.onerror = () => {
      finish()
      reject(new Error('Could not start the SVG optimization worker.'))
    }
    worker.postMessage(svg)
  })
}
