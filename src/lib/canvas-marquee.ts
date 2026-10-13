import type { SvgEditor } from './editor'
import { isBlocked, isHidden, isLayer, isLocked, type Bounds } from './layers'

/** Bounds in document units without resolving the same parent transform/style per child. */
function boundsOf(
  element: SVGGraphicsElement,
  parentMatrix: DOMMatrix,
  toDocument: DOMMatrix,
  parentStyle: CSSStyleDeclaration,
  stylesheet: boolean,
): Bounds | null {
  const box = element.getBBox()
  if (!box.width && !box.height) return null
  let matrix = parentMatrix
  if (stylesheet || element.style.transform) {
    const screen = element.getScreenCTM()
    if (!screen) return null
    matrix = toDocument.multiply(screen)
  } else if (element.hasAttribute('transform')) {
    const transforms = element.transform.baseVal
    for (let index = 0; index < transforms.numberOfItems; index++)
      matrix = matrix.multiply(transforms.getItem(index).matrix)
  }
  let stroke = element.style.stroke || element.getAttribute('stroke') || parentStyle.stroke
  let width = ''
  if (stroke !== 'none')
    width =
      element.style.strokeWidth || element.getAttribute('stroke-width') || parentStyle.strokeWidth
  // CSS rules and relative widths require the element's resolved style. Plain presentation
  // attributes (the usual exported SVG) can reuse the parent's already-resolved inheritance.
  if (
    stylesheet ||
    /^(inherit|initial|unset|revert|revert-layer)$/.test(stroke) ||
    stroke?.includes('var(') ||
    (stroke !== 'none' && !/^\d*\.?\d+(?:px)?$/.test(width))
  ) {
    const style = getComputedStyle(element)
    stroke = style.stroke
    width = style.strokeWidth
  }
  const pad = stroke && stroke !== 'none' ? (parseFloat(width) || 0) / 2 : 0
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2
  const x = matrix.a * cx + matrix.c * cy + matrix.e,
    y = matrix.b * cx + matrix.d * cy + matrix.f
  const halfWidth =
      Math.abs(matrix.a) * (box.width / 2 + pad) + Math.abs(matrix.c) * (box.height / 2 + pad),
    halfHeight =
      Math.abs(matrix.b) * (box.width / 2 + pad) + Math.abs(matrix.d) * (box.height / 2 + pad)
  return { x: x - halfWidth, y: y - halfHeight, width: halfWidth * 2, height: halfHeight * 2 }
}

/** Box selection searches all editable layers, or just the group being edited. */
export function createMarqueeSelection(editor: SvgEditor) {
  let candidates: { element: Element; bounds: Bounds }[] | null = null
  const clear = () => {
    candidates = null
  }
  return {
    clear,
    intersections(rect?: Bounds) {
      const content = editor.getSvgContent()
      const rubber = editor.getRubberBox()
      if (!rect && !rubber) return []
      const box = rect ?? rubber!.getBBox()
      const scale = rect ? 1 : editor.getZoom()
      const area = {
        x: box.x / scale,
        y: box.y / scale,
        width: box.width / scale,
        height: box.height / scale,
      }
      if (!area.width || !area.height) return []
      if (!candidates) {
        const toDocument = content.getScreenCTM()?.inverse()
        if (!toDocument) return []
        const stylesheet = !!content.querySelector('style')
        const group = editor.getCurrentGroup()
        const parents = group ? [group] : [...content.children].filter(isLayer)
        candidates = []
        for (const parent of parents) {
          if (isBlocked(parent)) continue
          const screen = (parent as SVGGraphicsElement).getScreenCTM()
          if (!screen) continue
          const matrix = toDocument.multiply(screen)
          const style = getComputedStyle(parent)
          for (const element of parent.children) {
            // All ancestors are shared with the already-checked parent.
            if (!(element instanceof SVGGraphicsElement) || isHidden(element) || isLocked(element))
              continue
            const bounds = boundsOf(element, matrix, toDocument, style, stylesheet)
            if (bounds) candidates.push({ element, bounds })
          }
        }
        candidates.reverse()
      }
      // Geometry is read once per gesture; moving the box only compares cached bounds.
      return candidates
        .filter(
          ({ bounds }) =>
            area.x < bounds.x + bounds.width &&
            area.x + area.width > bounds.x &&
            area.y < bounds.y + bounds.height &&
            area.y + area.height > bounds.y,
        )
        .map(({ element }) => element)
    },
  }
}
