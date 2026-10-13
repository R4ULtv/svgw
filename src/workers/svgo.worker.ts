import { optimize } from 'svgo/browser'

const worker = self as unknown as {
  onmessage: ((event: MessageEvent<{ id: number; svg: string }>) => void) | null
  postMessage: (value: { id: number; svg: string } | { id: number; error: string }) => void
}

worker.onmessage = (event) => {
  try {
    const result = optimize(event.data.svg, {
      multipass: true,
      floatPrecision: 4,
      plugins: [
        {
          name: 'preset-default',
          params: {
            overrides: {
              cleanupIds: false,
              collapseGroups: false,
              mergePaths: false,
              removeHiddenElems: false,
            },
          },
        },
      ],
    })
    worker.postMessage({ id: event.data.id, svg: result.data })
  } catch (error) {
    worker.postMessage({
      id: event.data.id,
      error: error instanceof Error ? error.message : 'Optimization failed.',
    })
  }
}
