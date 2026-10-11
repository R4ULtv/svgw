export interface FrameScheduler {
  request: (callback: FrameRequestCallback) => number
  cancel: (id: number) => void
}

/** Coalesces work into one frame; flush preserves the last update at interaction boundaries. */
export function createFrameTask(
  run: () => void,
  scheduler: FrameScheduler = {
    request: (callback) => requestAnimationFrame(callback),
    cancel: (id) => cancelAnimationFrame(id),
  },
) {
  let frame: number | null = null
  const cancel = () => {
    if (frame !== null) scheduler.cancel(frame)
    frame = null
  }
  return {
    schedule() {
      if (frame !== null) return
      frame = scheduler.request(() => {
        frame = null
        run()
      })
    },
    flush() {
      if (frame === null) return
      cancel()
      run()
    },
    cancel,
  }
}
