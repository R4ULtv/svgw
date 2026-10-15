import { createFrameTask, type FrameScheduler } from './frame-task'

/** Deliver the latest canvas move once per frame, before any snapping or engine DOM work. */
export function installPointerFrames(surface: HTMLElement, scheduler?: FrameScheduler) {
  let pending: MouseEvent | null = null
  let delivering = false
  const task = createFrameTask(() => {
    const event = pending
    pending = null
    if (!event) return
    const copy = new MouseEvent(event.type, {
      bubbles: event.bubbles,
      cancelable: event.cancelable,
      composed: event.composed,
      view: event.view,
      detail: event.detail,
      screenX: event.screenX,
      screenY: event.screenY,
      clientX: event.clientX,
      clientY: event.clientY,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      button: event.button,
      buttons: event.buttons,
      relatedTarget: event.relatedTarget,
    })
    // Preserve grip/artwork targeting. If an edit removed it, discard that stale move.
    if (event.target instanceof Node && surface.contains(event.target)) {
      delivering = true
      try {
        event.target.dispatchEvent(copy)
      } finally {
        delivering = false
      }
    }
  }, scheduler)
  const move = (event: MouseEvent) => {
    // Snapping may synchronously redispatch another move while this one is being delivered.
    if (delivering) return
    event.preventDefault()
    event.stopImmediatePropagation()
    pending = event
    task.schedule()
  }
  // The last move must reach SVG-Edit before it commits geometry or changes tools/selection.
  const flush = () => task.flush()
  surface.addEventListener('mousemove', move, true)
  surface.ownerDocument.addEventListener('mousedown', flush, true)
  surface.addEventListener('mouseup', flush, true)
  surface.addEventListener('dblclick', flush, true)
  surface.ownerDocument.addEventListener('keydown', flush, true)
  return () => {
    task.cancel()
    pending = null
    surface.removeEventListener('mousemove', move, true)
    surface.ownerDocument.removeEventListener('mousedown', flush, true)
    surface.removeEventListener('mouseup', flush, true)
    surface.removeEventListener('dblclick', flush, true)
    surface.ownerDocument.removeEventListener('keydown', flush, true)
  }
}
