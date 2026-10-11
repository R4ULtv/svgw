import { optimize } from 'svgo/browser'

const worker = self as unknown as {
  onmessage: ((event: MessageEvent<string>) => void) | null
  postMessage: (value: { svg: string } | { error: string }) => void
}

worker.onmessage = (event) => {
  try {
    const result = optimize(event.data, {
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
    worker.postMessage({ svg: result.data })
  } catch (error) {
    worker.postMessage({ error: error instanceof Error ? error.message : 'Optimization failed.' })
  }
}
