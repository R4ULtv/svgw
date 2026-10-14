import type { SvgEditor } from './editor'
import { createMarqueeSelection } from './canvas-marquee'
import { installCanvasResize } from './canvas-resize'
import { layerName, layerOf } from './layers'

/** Keep SVG-Edit's pointer coordinates and temporary modes in sync with the workspace. */
export function installCanvasInteractions(editor: SvgEditor, refresh: () => void) {
  const setRootSctm = editor.setRootSctm
  const getIntersectionList = editor.getIntersectionList
  const selection = createMarqueeSelection(editor)
  editor.getIntersectionList = selection.intersections
  const surface = editor.getContainer()
  const disposeResize = installCanvasResize(editor)
  let marquee = false
  let boxed: Element[] | null = null
  const press = (event: MouseEvent) => {
    selection.clear()
    boxed = null
    marquee =
      event.button === 0 &&
      editor.getMode() === 'select' &&
      editor.getMouseTarget(event) === editor.getSvgRoot()
  }
  surface.addEventListener('mousedown', press, true)
  const beforeRelease = () => {
    if (!marquee) return
    boxed = editor.getSelectedElements().filter((element): element is Element => !!element)
    // SVG-Edit falls through from box selection to its move/resize finalizer. Hide the
    // selection from that handler so selecting transformed artwork cannot create an edit.
    editor.clearSelection(true)
  }
  surface.addEventListener('mouseup', beforeRelease, true)
  // SVG-Edit 7.4.2 takes this matrix from the first <g>, which can be a transformed,
  // hidden layer or a definition. Pointer positions belong to the active editing context.
  // Resolve it on each press, so opening a document, zooming, and panning stay accurate.
  editor.setRootSctm = (matrix) => {
    const context = (editor.getCurrentGroup() ??
      editor.getCurrentDrawing().getCurrentLayer()) as SVGGraphicsElement | null
    const screen = (
      marquee ? editor.getSvgContent() : (context ?? editor.getSvgContent())
    ).getScreenCTM()
    setRootSctm.call(editor, screen ? screen.inverse() : matrix)
  }
  // The engine restores Select on release without emitting 'selected' or 'changed'.
  // Listen after its surface handler, including releases forwarded from outside the canvas.
  const release = () => {
    if (boxed) {
      const layer = boxed[0] && layerOf(boxed[0])
      if (
        !editor.getCurrentGroup() &&
        layer &&
        layer !== editor.getCurrentDrawing().getCurrentLayer()
      ) {
        // Layer activation clears selection. Restore the entire box selection so subsequent
        // handles and drawing tools use a visible layer without dropping the other objects.
        editor.setCurrentLayer(layerName(layer))
      }
      editor.selectOnly(boxed, true)
      boxed = null
    }
    selection.clear()
    marquee = false
    refresh()
  }
  surface.addEventListener('mouseup', release)
  return () => {
    disposeResize()
    surface.removeEventListener('mousedown', press, true)
    surface.removeEventListener('mouseup', beforeRelease, true)
    surface.removeEventListener('mouseup', release)
    editor.setRootSctm = setRootSctm
    editor.getIntersectionList = getIntersectionList
    selection.clear()
    boxed = null
  }
}
