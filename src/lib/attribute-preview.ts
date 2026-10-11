import type { SvgEditor } from './editor'
import { createFrameTask, type FrameScheduler } from './frame-task.ts'

type Value = string | number
interface PreviewOptions {
  editor: () => SvgEditor | null
  targets: (selected: Element[], attr: string) => Element[]
  previewed: (attr: string, value: Value) => void
  committed: () => void
  started?: () => void
  finished?: () => void
  scheduler?: FrameScheduler
}

/** Keeps one set of targets and one undo snapshot for the entire color/slider gesture. */
export function createAttributePreview(options: PreviewOptions) {
  let gesture: {
    editor: SvgEditor
    attr: string
    selected: Element[]
    targets: Element[]
    value?: Value
    applied?: Value
  } | null = null
  const frame = createFrameTask(() => {
    if (!gesture || gesture.value === undefined) return
    const { editor, attr, selected, targets, value } = gesture
    gesture.value = undefined
    // These presentation attributes need no geometry/rotation recalculation. SVG-Edit's generic
    // setter queues a selector resize per object, even for fill and opacity.
    if (['fill', 'stroke', 'stroke-width', 'opacity'].includes(attr)) {
      const text = String(value)
      let changed = false
      for (const target of targets)
        if (target.getAttribute(attr) !== text) {
          target.setAttribute(attr, text)
          changed = true
        }
      // Changing one visible stroke color to another keeps the bounds. Only width changes,
      // the first stroke update, or toggling stroke visibility require new selection handles.
      const strokeBoundsChanged =
        attr === 'stroke' &&
        (gesture.applied === undefined || (gesture.applied === 'none') !== (value === 'none'))
      if (changed && (attr === 'stroke-width' || strokeBoundsChanged)) {
        for (const element of selected)
          editor.gettingSelectorManager().requestSelector(element).resize()
      }
    } else editor.changeSelectedAttributeNoUndo(attr, value, targets)
    gesture.applied = value
    options.previewed(attr, value)
  }, options.scheduler)

  function commit() {
    if (!gesture) return
    frame.flush()
    const { editor } = gesture
    gesture = null
    const command = editor.undoMgr.finishUndoableChange()
    if (!command.isEmpty()) {
      editor.undoMgr.addCommandToHistory(command)
      options.committed()
    }
    options.finished?.()
  }

  return {
    preview(attr: string, value: Value) {
      const editor = options.editor()
      if (!editor) return
      if (gesture && (gesture.attr !== attr || gesture.editor !== editor)) commit()
      if (!gesture) {
        const selected = editor
          .getSelectedElements()
          .filter((item): item is Element => item !== null)
        const targets = options.targets(selected, attr)
        if (!targets.length) return
        options.started?.()
        editor.undoMgr.beginUndoableChange(attr, targets)
        gesture = { editor, attr, selected, targets }
      }
      gesture.value = value
      frame.schedule()
    },
    commit,
    cancel() {
      frame.cancel()
      if (gesture) gesture.editor.undoMgr.finishUndoableChange()
      gesture = null
    },
  }
}
