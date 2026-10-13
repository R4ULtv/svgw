let canvas: Promise<typeof import('@svgedit/svgcanvas')> | undefined

/** Start fetching the engine alongside the route UI, and retry failed downloads. */
export function loadCanvas() {
  canvas ??= import('@svgedit/svgcanvas').catch((cause: unknown) => {
    canvas = undefined
    throw cause
  })
  return canvas
}
