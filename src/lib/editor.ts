import type SvgCanvas from '@svgedit/svgcanvas'
import { exportLayers } from './layers'
import { normalizeColor } from './colors'

// SVG-Edit 7.4.2's bundled types are inaccurate: undo/redo live on undoMgr, not the canvas,
// and several public methods are missing. This type matches the runtime API.
type Command = { readonly __command?: never }

export type SvgEditor = Omit<
  SvgCanvas,
  | 'undo'
  | 'redo'
  | 'undoMgr'
  | 'getCurrentDrawing'
  | 'cloneLayer'
  | 'setResolution'
  | 'contentW'
  | 'contentH'
> & {
  setSvgOption(name: 'round_digits', value: number): void
  getSelectedElements(): (Element | null)[]
  addToSelection(elements: Element[], showGrips?: boolean): void
  removeFromSelection(elements: Element[]): void
  getCurrentDrawing(): { getCurrentLayer(): Element | null; getNumLayers(): number }
  getCurrentGroup(): Element | null
  setContext(element: Element): void
  leaveContext(): void
  identifyLayers(): void
  createLayer(name: string): void
  cloneLayer(name: string): void
  getNextId(): string
  uniquifyElems(root: Element): void
  /** Bounding box including strokes; defaults to all visible elements. */
  getStrokedBBox(
    elements?: Element[],
  ): { x: number; y: number; width: number; height: number } | null
  /** Width and height in px, or 'fit' to crop the canvas to the artwork. */
  setResolution(width: number | 'fit', height: number | 'fit'): boolean
  /** Sets the zoom and resizes selection handles; follow with updateCanvas to lay out. */
  setCurrentZoom(zoom: number): void
  /** Sizes the editor's root to `width` × `height` and centers the artboard in it at the current zoom. */
  updateCanvas(width: number, height: number): { x: number; y: number }
  gettingSelectorManager(): { requestSelector(element: Element): { resize(): void } }
  /** Document size in px, independent of zoom. */
  contentW: number
  contentH: number
  history: {
    BatchCommand: new (
      text?: string,
    ) => Command & { addSubCommand(command: Command): void; isEmpty(): boolean }
    InsertElementCommand: new (element: Element, text?: string) => Command
    MoveElementCommand: new (
      element: Element,
      oldNextSibling: Node | null,
      oldParent: Node,
      text?: string,
    ) => Command
    ChangeElementCommand: new (
      element: Element,
      oldValues: Record<string, string | null>,
      text?: string,
    ) => Command
  }
  undoMgr: SvgCanvas['undoMgr'] & {
    undo(): void
    redo(): void
    getNextUndoCommandText(): string
    beginUndoableChange(attr: string, elems: Element[]): void
    finishUndoableChange(): Command & { isEmpty(): boolean }
    addCommandToHistory(command: Command): void
  }
}

/** Toolbar tools. All but 'hand' are SVG-Edit modes; the hand pans the view and leaves SVG-Edit in 'select'. */
export type Tool = 'select' | 'rect' | 'ellipse' | 'path' | 'hand'
export type PaintAttribute = 'fill' | 'stroke'

export interface Selection {
  count: number
  label: string
  /** A normalized CSS color, 'none', or 'mixed' when the selection holds several paints. */
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
}

/**
 * Removes attributes whose value is the string "null". SVG-Edit copies paint settings from the
 * last selected object onto new shapes and writes unset ones as `stroke="null"`, which is invalid SVG.
 */
export function stripNullAttributes(root: Element) {
  for (const element of [root, ...root.querySelectorAll('*')]) {
    // Attributes are live; snapshot them so consecutive removals cannot skip an item.
    const attributes = [...element.attributes]
    for (const attribute of attributes)
      if (attribute.value === 'null') element.removeAttribute(attribute.name)
  }
}

/**
 * Serializes the open document with Illustrator-style layer markup. Use `forExport` for files
 * leaving svgw; project storage keeps svgw metadata such as layer locks.
 */
export function serializeDocument(editor: SvgEditor, { forExport = false } = {}) {
  const document = new DOMParser().parseFromString(editor.getSvgString(), 'image/svg+xml')
  const root = document.documentElement
  exportLayers(root, { forExport })
  stripNullAttributes(root)
  const resolution = { w: editor.contentW, h: editor.contentH }
  // SVG-Edit's fixed-size exporter omits viewBox. Retain it for scaled and offset artwork.
  root.setAttribute(
    'viewBox',
    editor.getSvgContent().getAttribute('viewBox') ?? `0 0 ${resolution.w} ${resolution.h}`,
  )
  root.setAttribute('width', String(resolution.w))
  root.setAttribute('height', String(resolution.h))
  return new XMLSerializer().serializeToString(root)
}

// Groups have no paint of their own: edits apply to their drawable descendants, as SVG-Edit's setColor does.
export function paintTargets(elements: Element[], attr: string) {
  const targets = new Set<Element>()
  for (const element of elements) {
    if (element.localName === 'g') {
      for (const child of element.querySelectorAll('*'))
        if (child instanceof SVGGeometryElement || child.localName === 'text') targets.add(child)
    } else targets.add(element)
  }
  return [...targets].filter(
    (element) =>
      attr !== 'fill' || (element.localName !== 'line' && element.localName !== 'polyline'),
  )
}

const names: Record<string, string> = {
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  circle: 'Circle',
  path: 'Path',
  g: 'Group',
  text: 'Text',
  line: 'Line',
  polyline: 'Polyline',
  polygon: 'Polygon',
  image: 'Image',
}

export function readSelection(elements: Element[]): Selection | null {
  if (!elements.length) return null
  const first = elements[0]
  const targets = paintTargets(elements, 'stroke')
  // Read each style once, before any DOM writes, and stop comparing paint once it is mixed.
  let fill: string | undefined
  let stroke: string | undefined
  let strokeWidth = 0
  const colors = new Map<string, string>()
  const paintColor = (value: string) => {
    if (!colors.has(value)) colors.set(value, normalizeColor(value) ?? 'none')
    return colors.get(value)!
  }
  if (!targets.length) strokeWidth = parseFloat(getComputedStyle(first).strokeWidth) || 0
  for (const [index, element] of targets.entries()) {
    const style = getComputedStyle(element)
    if (index === 0) strokeWidth = parseFloat(style.strokeWidth) || 0
    if (fill !== 'mixed' && element.localName !== 'line' && element.localName !== 'polyline') {
      const color = paintColor(style.fill)
      fill = fill === undefined || fill === color ? color : 'mixed'
    }
    if (stroke !== 'mixed') {
      const color = paintColor(style.stroke)
      stroke = stroke === undefined || stroke === color ? color : 'mixed'
    }
    if (fill === 'mixed' && stroke === 'mixed') break
  }
  return {
    count: elements.length,
    label:
      elements.length > 1
        ? `${elements.length} objects`
        : (names[first.localName] ?? first.localName),
    fill: fill ?? 'none',
    stroke: stroke ?? 'none',
    strokeWidth,
    opacity: Math.round(Number(first.getAttribute('opacity') ?? 1) * 100),
  }
}
