import type { SvgEditor } from './editor'

/** Adapt the engine's resize gesture while retaining its geometry finalizer and undo step. */
export function installCanvasResize(editor: SvgEditor) {
  const surface = editor.getContainer()
  const mouseMove = editor.mouseMoveEvent
  let gesture: {
    element: SVGGraphicsElement
    x: number
    y: number
    center: DOMPoint
  } | null = null

  const press = (event: MouseEvent) => {
    gesture = null
    if (
      event.button !== 0 ||
      editor.getMode() !== 'select' ||
      !(event.target instanceof Element) ||
      !event.target.closest('[id^="selectorGrip_resize_"]')
    )
      return
    const element = editor.getSelectedElements()[0]
    if (!(element instanceof SVGGraphicsElement)) return
    const screen = element.getScreenCTM()
    const parent = (element.parentElement as SVGGraphicsElement | null)?.getScreenCTM()
    if (!screen || !parent) return
    const box = element.getBBox()
    gesture = {
      element,
      x: event.clientX,
      y: event.clientY,
      center: new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(
        parent.inverse().multiply(screen),
      ),
    }
  }

  const resize = (event: MouseEvent) => {
    const direction = editor.getMode() === 'resize' ? editor.getCurrentResizeMode() : ''
    const selected = direction ? editor.getSelectedElements()[0] : null
    const corner = ['nw', 'ne', 'se', 'sw'].includes(direction)
    const centered = !!gesture && selected === gesture.element && (event.metaKey || event.ctrlKey)
    // SVG-Edit constrains images without Shift, but other objects with Shift.
    // Normalize corners to proportional by default, with Shift for free resizing.
    const shiftKey =
      selected && corner && selected.localName !== 'image' ? !event.shiftKey : event.shiftKey
    if (shiftKey !== event.shiftKey || centered) {
      event.preventDefault()
      // Both sides move in a centered resize, so double the displacement before scaling.
      const x = centered ? gesture!.x + 2 * (event.clientX - gesture!.x) : event.clientX
      const y = centered ? gesture!.y + 2 * (event.clientY - gesture!.y) : event.clientY
      mouseMove.call(
        editor,
        new MouseEvent(event.type, {
          bubbles: event.bubbles,
          cancelable: event.cancelable,
          composed: event.composed,
          view: event.view,
          detail: event.detail,
          clientX: x,
          clientY: y,
          screenX: event.screenX + x - event.clientX,
          screenY: event.screenY + y - event.clientY,
          button: event.button,
          buttons: event.buttons,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
          shiftKey,
          relatedTarget: event.relatedTarget,
        }),
      )
    } else mouseMove.call(editor, event)

    if (!centered || !gesture) return
    const list = gesture.element.transform.baseVal
    // SVG-Edit puts its resize triple before a nonidentity matrix (after any rotation),
    // otherwise at the end. Match its 1e-10 identity tolerance; SVGTransform wrappers
    // have unstable identity, so comparing them by reference cannot identify the triple.
    const transforms = Array.from({ length: list.numberOfItems }, (_, i) => list.getItem(i))
    const hasMatrix = transforms.some(
      ({ type, matrix: m }) =>
        type === SVGTransform.SVG_TRANSFORM_MATRIX &&
        [m.a - 1, m.b, m.c, m.d - 1, m.e, m.f].some((value) => Math.abs(value) >= 1e-10),
    )
    const rotated = transforms.some(
      (item) => item.type === SVGTransform.SVG_TRANSFORM_ROTATE && item.angle,
    )
    const index = hasMatrix ? (rotated ? 1 : 0) : list.numberOfItems - 3
    const back = transforms[index]
    const scale = transforms[index + 1]
    const origin = transforms[index + 2]
    if (
      back?.type !== SVGTransform.SVG_TRANSFORM_TRANSLATE ||
      scale?.type !== SVGTransform.SVG_TRANSFORM_SCALE ||
      origin?.type !== SVGTransform.SVG_TRANSFORM_TRANSLATE
    )
      return
    let prefix = new DOMMatrix()
    for (let i = 0; i < index; i++) prefix = prefix.multiply(transforms[i].matrix)
    const center = gesture.center.matrixTransform(prefix.inverse())
    back.setTranslate(center.x, center.y)
    origin.setTranslate(-center.x, -center.y)
    editor.gettingSelectorManager().requestSelector(gesture.element).resize()
  }
  const release = () => {
    gesture = null
  }
  // Run after snapping/forwarding, and keep actual modifier keys for other listeners.
  surface.addEventListener('mousedown', press, true)
  surface.removeEventListener('mousemove', mouseMove)
  surface.addEventListener('mousemove', resize)
  surface.addEventListener('mouseup', release)
  return () => {
    surface.removeEventListener('mousedown', press, true)
    surface.removeEventListener('mousemove', resize)
    surface.addEventListener('mousemove', mouseMove)
    surface.removeEventListener('mouseup', release)
    gesture = null
  }
}
