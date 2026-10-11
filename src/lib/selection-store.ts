import type { Selection } from './editor'

/** Live inspector values have their own subscription, so dragging a picker cannot rerender the workspace. */
export function createSelectionStore() {
  let selection: Selection | null = null
  const listeners = new Set<() => void>()
  function set(next: Selection | null) {
    if (
      selection === next ||
      (selection &&
        next &&
        (Object.keys(next) as (keyof Selection)[]).every((key) => selection![key] === next[key]))
    )
      return
    selection = next
    for (const listener of listeners) listener()
  }
  return {
    getSnapshot: () => selection,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set,
    preview(attr: string, value: string | number) {
      if (!selection) return
      if (attr === 'fill' || attr === 'stroke') set({ ...selection, [attr]: String(value) })
      else if (attr === 'stroke-width') set({ ...selection, strokeWidth: Number(value) })
      else if (attr === 'opacity') set({ ...selection, opacity: Math.round(Number(value) * 100) })
    },
  }
}

export type SelectionStore = ReturnType<typeof createSelectionStore>
