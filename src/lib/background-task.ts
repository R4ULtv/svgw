/** Debounce derived document work, then run it when the browser has idle time. */
export function createBackgroundTask(run: () => void, delay = 150) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let idle: number | undefined
  function cancel() {
    clearTimeout(timer)
    if (idle !== undefined) window.cancelIdleCallback(idle)
    timer = undefined
    idle = undefined
  }
  return {
    cancel,
    schedule() {
      cancel()
      timer = setTimeout(() => {
        timer = undefined
        if (typeof window.requestIdleCallback === 'function')
          idle = window.requestIdleCallback(
            () => {
              idle = undefined
              run()
            },
            { timeout: 1000 },
          )
        else run()
      }, delay)
    },
  }
}
