import type { SvgEditor } from './editor'

/**
 * Layers follow Illustrator's model on top of SVG-Edit's: top-level groups are layers, and
 * groups and shapes inside them are listed as a tree. SVG-Edit marks layers with
 * `class="layer"` and a `<title>`; exports use Illustrator's `<g id="Layer_1" data-name="Layer 1">`
 * instead, so files round-trip between svgw and Illustrator without stray tooltips.
 */

const LOCK = 'data-svgw-locked'
const DRAWABLE = new Set([
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'image',
  'use',
  'foreignObject',
  'a',
  'switch',
])
const TYPE_NAMES: Record<string, string> = {
  g: 'Group',
  path: 'Path',
  rect: 'Rectangle',
  circle: 'Circle',
  ellipse: 'Ellipse',
  line: 'Line',
  polyline: 'Polyline',
  polygon: 'Polygon',
  text: 'Text',
  image: 'Image',
  use: 'Symbol',
  foreignObject: 'Embedded',
  a: 'Link',
  switch: 'Switch',
}

export type LayerKind = 'layer' | 'group' | 'object'

export interface LayerNode {
  key: string
  element: Element
  kind: LayerKind
  /** Display name: a layer's title, an object's name or id, or its type in angle brackets. */
  name: string
  tag: string
  hidden: boolean
  locked: boolean
  /** Fill color for shape rows, when it is a plain color. */
  swatch?: string
  /** Children in stacking order, topmost first, as in Illustrator. */
  children: LayerNode[]
}

// Stable React keys and expansion state for DOM elements, without writing ids into the document.
const keys = new WeakMap<Element, string>()
let nextKey = 0
export const keyOf = (element: Element) => {
  let key = keys.get(element)
  if (!key) keys.set(element, (key = `n${++nextKey}`))
  return key
}

export const isLayer = (element: Element) =>
  element.localName === 'g' &&
  element.classList.contains('layer') &&
  element.parentElement?.id === 'svgcontent'
export const isHidden = (element: Element) =>
  element.getAttribute('display') === 'none' || (element as SVGElement).style?.display === 'none'
export const isLocked = (element: Element) => element.hasAttribute(LOCK)
/** True when the element or any ancestor up to its layer is hidden or locked. */
export const isBlocked = (element: Element) => {
  for (
    let node: Element | null = element;
    node && node.id !== 'svgcontent';
    node = node.parentElement
  )
    if (isHidden(node) || isLocked(node)) return true
  return false
}
export const layerOf = (element: Element) => {
  let node: Element | null = element
  while (node && !isLayer(node)) node = node.parentElement
  return node
}
export const layerName = (layer: Element) =>
  [...layer.children].find((child) => child.localName === 'title')?.textContent ?? ''

const drawableChildren = (element: Element) =>
  [...element.children].filter((child) => DRAWABLE.has(child.localName))

function objectName(element: Element) {
  const named =
    element.getAttribute('data-name') ?? (/^svg_\d+$/.test(element.id) ? '' : element.id)
  if (named) return named
  if (element.localName === 'text' && element.textContent?.trim())
    return element.textContent.trim().slice(0, 40)
  return `<${TYPE_NAMES[element.localName] ?? element.localName}>`
}

function plainFill(element: Element) {
  const fill = getComputedStyle(element).fill
  return fill && fill !== 'none' && !fill.startsWith('url') ? fill : undefined
}

function toNode(element: Element): LayerNode {
  const layer = isLayer(element)
  const children =
    layer || element.localName === 'g' ? drawableChildren(element).reverse().map(toNode) : []
  return {
    key: keyOf(element),
    element,
    kind: layer ? 'layer' : element.localName === 'g' ? 'group' : 'object',
    name: layer ? layerName(element) : objectName(element),
    tag: element.localName,
    hidden: isHidden(element),
    locked: isLocked(element),
    swatch: layer || element.localName === 'g' ? undefined : plainFill(element),
    children,
  }
}

/** The layer tree for the open document, topmost layer first. */
export function buildLayerTree(editor: SvgEditor): LayerNode[] {
  return [...editor.getSvgContent().children].filter(isLayer).reverse().map(toNode)
}

// ---------------------------------------------------------------------------
// Import and export

const XML_NAME = /^[A-Za-z_][\w.-]*$/

/** Illustrator-style id for a name: "Layer 1" becomes "Layer_1". */
export function idFromName(name: string, taken: (id: string) => boolean) {
  let base =
    name
      .trim()
      .replace(/[^\w.-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'Layer'
  if (!XML_NAME.test(base)) base = `_${base}`
  let id = base
  for (let index = 2; taken(id); index++) id = `${base}_${index}`
  return id
}

/**
 * Turns Illustrator (`data-name`) and Inkscape (`inkscape:groupmode="layer"`) top-level layer
 * groups into SVG-Edit layers, so they appear as separate layers instead of one wrapped group.
 */
export function promoteLayers(svg: string) {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = document.documentElement
  const names = new Set<string>()
  let changed = false
  for (const group of root.children) {
    if (group.localName !== 'g') continue
    const titled = [...group.children].find((child) => child.localName === 'title')
    if (group.classList.contains('layer')) {
      if (titled?.textContent) names.add(titled.textContent)
      continue
    }
    const label =
      group.getAttribute('inkscape:label') ??
      group.getAttributeNS('http://www.inkscape.org/namespaces/inkscape', 'label')
    const mode =
      group.getAttribute('inkscape:groupmode') ??
      group.getAttributeNS('http://www.inkscape.org/namespaces/inkscape', 'groupmode')
    const dataName = group.getAttribute('data-name')
    if (!dataName && mode !== 'layer') continue
    let name = dataName ?? label ?? (group.id ? group.id.replace(/_/g, ' ') : 'Layer')
    // SVG-Edit addresses layers by name, so names must be unique.
    for (let index = 2, base = name; names.has(name); index++) name = `${base} ${index}`
    names.add(name)
    group.classList.add('layer')
    group.removeAttribute('data-name')
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
    title.textContent = name
    group.prepend(title)
    changed = true
  }
  return changed ? new XMLSerializer().serializeToString(root) : svg
}

/**
 * Converts SVG-Edit layers in a serialized document root to Illustrator's layer markup.
 * With `forExport`, also removes svgw-only metadata such as lock state.
 */
export function exportLayers(root: Element, { forExport }: { forExport: boolean }) {
  const ids = new Set([...root.querySelectorAll('[id]')].map((element) => element.id))
  for (const group of root.children) {
    if (group.localName !== 'g' || !group.classList.contains('layer')) continue
    const title = [...group.children].find((child) => child.localName === 'title')
    const name = title?.textContent ?? ''
    if (
      title?.previousSibling?.nodeType === Node.TEXT_NODE &&
      !title.previousSibling.textContent?.trim()
    )
      title.previousSibling.remove()
    title?.remove()
    group.classList.remove('layer')
    if (!group.classList.length) group.removeAttribute('class')
    if (name) group.setAttribute('data-name', name)
    if (!group.id) {
      group.id = idFromName(name, (id) => ids.has(id))
      ids.add(group.id)
    }
    if (group.getAttribute('display') === 'inline') group.removeAttribute('display')
  }
  // SVG-Edit writes inline pointer-events on layers and their contents; that is editor state, not artwork.
  for (const element of root.querySelectorAll('[style*="pointer-events"]')) {
    const style = (element as SVGElement).style
    style.removeProperty('pointer-events')
    if (!element.getAttribute('style')) element.removeAttribute('style')
  }
  if (forExport)
    for (const element of root.querySelectorAll(`[${LOCK}]`)) element.removeAttribute(LOCK)
}

// ---------------------------------------------------------------------------
// Editing (all undoable)

type History = SvgEditor['history']

function changeAttributes(
  editor: SvgEditor,
  element: Element,
  values: Record<string, string | null>,
  label: string,
) {
  const old = Object.fromEntries(
    Object.keys(values).map((attr) => [attr, element.getAttribute(attr)]),
  )
  for (const [attr, value] of Object.entries(values)) {
    if (value === null) element.removeAttribute(attr)
    else element.setAttribute(attr, value)
  }
  return new editor.history.ChangeElementCommand(element, old, label)
}

export function setHidden(editor: SvgEditor, element: Element, hidden: boolean) {
  if (isLayer(element)) {
    editor.setLayerVisibility(layerName(element), !hidden)
    return
  }
  const style = (element.getAttribute('style') ?? '')
    .replace(/(^|;)\s*display\s*:[^;]*/g, '')
    .replace(/^;+/, '')
    .trim()
  editor.undoMgr.addCommandToHistory(
    changeAttributes(
      editor,
      element,
      { display: hidden ? 'none' : null, style: style || null },
      hidden ? 'Hide' : 'Show',
    ),
  )
  if (hidden)
    editor.removeFromSelection(
      editor
        .getSelectedElements()
        .filter((item): item is Element => !!item && (item === element || element.contains(item))),
    )
}

export function setLocked(editor: SvgEditor, element: Element, locked: boolean) {
  editor.undoMgr.addCommandToHistory(
    changeAttributes(
      editor,
      element,
      { [LOCK]: locked ? 'true' : null },
      locked ? 'Lock' : 'Unlock',
    ),
  )
  if (locked)
    editor.removeFromSelection(
      editor
        .getSelectedElements()
        .filter((item): item is Element => !!item && (item === element || element.contains(item))),
    )
}

/** Unique "Layer N" name, like Illustrator's default naming. */
function nextLayerName(editor: SvgEditor) {
  const names = new Set([...editor.getSvgContent().children].filter(isLayer).map(layerName))
  let index = names.size + 1
  while (names.has(`Layer ${index}`)) index++
  return `Layer ${index}`
}

export function createLayer(editor: SvgEditor) {
  editor.leaveContext()
  editor.createLayer(nextLayerName(editor))
}

/** Renames a layer, or names an object: `data-name` keeps the typed name, `id` gets a valid version of it. */
export function rename(editor: SvgEditor, element: Element, name: string) {
  const trimmed = name.trim()
  if (!trimmed) return
  if (isLayer(element)) {
    const others = new Set(
      [...editor.getSvgContent().children]
        .filter((child) => isLayer(child) && child !== element)
        .map(layerName),
    )
    let unique = trimmed
    for (let index = 2; others.has(unique); index++) unique = `${trimmed} ${index}`
    editor.setCurrentLayer(layerName(element))
    editor.renameCurrentLayer(unique)
    return
  }
  const svg = editor.getSvgContent()
  const id = idFromName(
    trimmed,
    (candidate) => candidate !== element.id && !!svg.querySelector(`#${CSS.escape(candidate)}`),
  )
  editor.undoMgr.addCommandToHistory(
    changeAttributes(
      editor,
      element,
      { id, 'data-name': id === trimmed ? null : trimmed },
      'Rename',
    ),
  )
}

/** Where a moved element goes, in DOM terms. `before: null` appends as the topmost child. */
export interface DropTarget {
  parent: Element
  before: Element | null
}

/**
 * Moves elements to a new parent or stacking position as one undo step. Elements keep their
 * on-canvas position when the new parent has a different transform, as Illustrator does.
 */
export function moveElements(editor: SvgEditor, elements: Element[], target: DropTarget) {
  const { BatchCommand, MoveElementCommand, ChangeElementCommand } = editor.history as History
  const batch = new BatchCommand('Move in Layers')
  const movingLayers = elements.some(isLayer)
  const current = editor.getCurrentDrawing().getCurrentLayer()
  editor.clearSelection()
  for (const element of elements) {
    if (element === target.before || element.contains(target.parent)) continue
    const oldParent = element.parentElement
    if (!oldParent) continue
    const oldNext = element.nextSibling
    // Work out the compensating transform before touching the DOM, so a failure can't leave a half-done move.
    const transform =
      oldParent !== target.parent && !isLayer(element)
        ? compensatingTransform(element, oldParent, target.parent)
        : null
    target.parent.insertBefore(element, target.before)
    batch.addSubCommand(new MoveElementCommand(element, oldNext, oldParent))
    if (transform) {
      const old = element.getAttribute('transform')
      element.setAttribute('transform', transform)
      batch.addSubCommand(new ChangeElementCommand(element, { transform: old }))
    }
  }
  if (batch.isEmpty()) return false
  editor.undoMgr.addCommandToHistory(batch)
  if (movingLayers) {
    // SVG-Edit caches layer order; re-read it and keep the same layer active.
    editor.identifyLayers()
    if (current) editor.setCurrentLayer(layerName(current))
  }
  return true
}

const ctm = (element: Element) => {
  const matrix = (element as SVGGraphicsElement).getCTM?.()
  // getCTM returns a legacy SVGMatrix; DOMMatrix supports isIdentity and mixes with other matrices.
  return matrix ? DOMMatrix.fromMatrix(matrix) : null
}

/** The transform that keeps `element` in place when moved from `from` into `to`, or null if none is needed. */
function compensatingTransform(element: Element, from: Element, to: Element) {
  const source = ctm(from)
  const destination = ctm(to)
  if (!source || !destination) return null
  const delta = destination.inverse().multiply(source)
  if (delta.isIdentity) return null
  const local = (element as SVGGraphicsElement).transform?.baseVal.consolidate()?.matrix
  const m = delta.multiply(local ? DOMMatrix.fromMatrix(local) : new DOMMatrix())
  return `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`
}

/** Makes `elements` the selection, switching to their layer and entering their group like a canvas double-click. */
export function selectInLayers(editor: SvgEditor, elements: Element[], additive: boolean) {
  const first = elements[0]
  const layer = first && layerOf(first)
  if (!layer || elements.some(isBlocked)) return
  if (editor.getCurrentGroup()) editor.leaveContext()
  if (editor.getCurrentDrawing().getCurrentLayer() !== layer)
    editor.setCurrentLayer(layerName(layer))
  if (first.parentElement !== layer && first.parentElement) editor.setContext(first.parentElement)
  if (additive) editor.addToSelection(elements, true)
  else editor.selectOnly(elements, true)
}

/**
 * Bounds of `elements` in the document's coordinates, including half the stroke width.
 * (SVG-Edit's getStrokedBBox drops artwork that extends past the canvas.)
 */
export function artworkBounds(content: SVGSVGElement, elements: Element[]) {
  const toDocument = content.getScreenCTM()?.inverse()
  if (!toDocument) return null
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const element of elements) {
    if (!(element instanceof SVGGraphicsElement)) continue
    const box = element.getBBox()
    const matrix = element.getScreenCTM()
    if (!matrix || (!box.width && !box.height)) continue
    const style = getComputedStyle(element)
    const pad =
      style.stroke && style.stroke !== 'none' ? (parseFloat(style.strokeWidth) || 0) / 2 : 0
    const corners = [
      [box.x - pad, box.y - pad],
      [box.x + box.width + pad, box.y - pad],
      [box.x - pad, box.y + box.height + pad],
      [box.x + box.width + pad, box.y + box.height + pad],
    ]
    for (const [x, y] of corners) {
      const point = new DOMPoint(x, y).matrixTransform(matrix).matrixTransform(toDocument)
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
  }
  return Number.isFinite(minX)
    ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    : null
}

/**
 * Crops the canvas to the visible artwork on every layer, as one undo step. SVG-Edit's own
 * `setResolution('fit')` only measures and moves the current layer, which misaligns the others.
 */
export function fitCanvasToArtwork(editor: SvgEditor) {
  const content = editor.getSvgContent()
  const layers = [...content.children].filter(isLayer)
  const visible = layers
    .filter((layer) => !isHidden(layer))
    .flatMap((layer) => drawableChildren(layer).filter((element) => !isHidden(element)))
  const box = artworkBounds(content, visible)
  if (!box || box.width <= 0 || box.height <= 0) return false
  const { BatchCommand, ChangeElementCommand } = editor.history
  const batch = new BatchCommand('Fit Canvas to Artwork')
  if (box.x || box.y) {
    // Shift everything, hidden objects included, so layers stay aligned with each other.
    for (const element of layers.flatMap(drawableChildren)) {
      const old = element.getAttribute('transform')
      element.setAttribute('transform', `translate(${-box.x} ${-box.y})${old ? ` ${old}` : ''}`)
      batch.addSubCommand(new ChangeElementCommand(element, { transform: old }))
    }
  }
  const width = String(Math.ceil(box.width))
  const height = String(Math.ceil(box.height))
  // Record and write zoom-independent sizes, like SVG-Edit's setResolution; the workspace lays
  // the artboard out at the current zoom afterwards (and undo restores contentW/H from these).
  const old = {
    width: String(editor.contentW),
    height: String(editor.contentH),
    viewBox: content.getAttribute('viewBox'),
  }
  content.setAttribute('width', width)
  content.setAttribute('height', height)
  content.setAttribute('viewBox', `0 0 ${width} ${height}`)
  editor.contentW = Number(width)
  editor.contentH = Number(height)
  batch.addSubCommand(new ChangeElementCommand(content, old))
  editor.undoMgr.addCommandToHistory(batch)
  return true
}
