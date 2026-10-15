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

export interface ArtworkStats {
  layers: number
  /** Drawable objects inside the layers, groups included. */
  objects: number
  /** Object counts by type name ("Path", "Group"), most common first. */
  types: [string, number][]
}

/** Counts the layers and the objects inside them. */
export function artworkStats(content: SVGSVGElement): ArtworkStats {
  const layers = [...content.children].filter(isLayer)
  const counts = new Map<string, number>()
  const visit = (parent: Element) => {
    for (const child of drawableChildren(parent)) {
      const type = TYPE_NAMES[child.localName] ?? child.localName
      counts.set(type, (counts.get(type) ?? 0) + 1)
      visit(child)
    }
  }
  for (const layer of layers) visit(layer)
  const types = [...counts].sort((a, b) => b[1] - a[1])
  return {
    layers: layers.length,
    objects: types.reduce((total, [, count]) => total + count, 0),
    types,
  }
}

/** Empty layer/group containers and definitions do not count as document artwork. */
export function hasArtwork(root: Element): boolean {
  for (const child of root.children) {
    if (['g', 'svg', 'a', 'switch'].includes(child.localName)) {
      if (hasArtwork(child)) return true
    } else if (DRAWABLE.has(child.localName)) return true
  }
  return false
}

function objectName(element: Element) {
  const named =
    element.getAttribute('data-name') ??
    [...element.children].find((child) => child.localName === 'title')?.textContent ??
    (/^svg_\d+$/.test(element.id) ? '' : element.id)
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
  let swatch: string | undefined
  let swatchRead = false
  return {
    key: keyOf(element),
    element,
    kind: layer ? 'layer' : element.localName === 'g' ? 'group' : 'object',
    name: layer ? layerName(element) : objectName(element),
    tag: element.localName,
    hidden: isHidden(element),
    locked: isLocked(element),
    // Collapsed and virtualized objects need no style read. Cache the swatch only
    // when a mounted row asks for it; a document revision creates fresh nodes.
    get swatch() {
      if (!swatchRead) {
        swatchRead = true
        if (!layer && element.localName !== 'g') swatch = plainFill(element)
      }
      return swatch
    },
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

/** A stored project's SVG as exported files have it, without svgw-only metadata. */
export function exportedSvg(svg: string) {
  const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement
  exportLayers(root, { forExport: true })
  return new XMLSerializer().serializeToString(root)
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

function hiddenAttributes(element: Element, hidden: boolean) {
  const style = (element.getAttribute('style') ?? '')
    .replace(/(^|;)\s*display\s*:[^;]*/g, '')
    .replace(/^;+/, '')
    .trim()
  return { display: hidden ? 'none' : null, style: style || null }
}

export function setHidden(editor: SvgEditor, element: Element, hidden: boolean) {
  if (isLayer(element)) {
    editor.setLayerVisibility(layerName(element), !hidden)
    return
  }
  editor.undoMgr.addCommandToHistory(
    changeAttributes(editor, element, hiddenAttributes(element, hidden), hidden ? 'Hide' : 'Show'),
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

export type ArtworkState = 'hidden' | 'locked'

/** Change the entire selection as one undo step, preserving each element's previous state. */
export function setArtworkState(
  editor: SvgEditor,
  elements: Element[],
  state: ArtworkState,
  enabled: boolean,
) {
  const test = state === 'hidden' ? isHidden : isLocked
  const changing = [...new Set(elements)].filter((element) => test(element) !== enabled)
  if (!changing.length) return false
  const label = state === 'hidden' ? (enabled ? 'Hide' : 'Show') : enabled ? 'Lock' : 'Unlock'
  const batch = new editor.history.BatchCommand(label)
  for (const element of changing)
    batch.addSubCommand(
      changeAttributes(
        editor,
        element,
        state === 'hidden'
          ? hiddenAttributes(element, enabled)
          : { [LOCK]: enabled ? 'true' : null },
        label,
      ),
    )
  if (enabled) {
    const affected = new Set(changing)
    editor.removeFromSelection(
      editor.getSelectedElements().filter((element): element is Element => {
        for (let node = element; node; node = node.parentElement)
          if (affected.has(node)) return true
        return false
      }),
    )
  }
  editor.undoMgr.addCommandToHistory(batch)
  return true
}

/** Restore layers, groups, and objects, including collapsed branches, without touching definitions. */
export function restoreArtworkState(editor: SvgEditor, state: ArtworkState) {
  const elements: Element[] = []
  const visit = (nodes: LayerNode[]) => {
    for (const node of nodes) {
      elements.push(node.element)
      visit(node.children)
    }
  }
  visit(buildLayerTree(editor))
  return setArtworkState(editor, elements, state, false)
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

const SVG_NS = 'http://www.w3.org/2000/svg'

/** `name`, numbered if another layer already has it: SVG-Edit addresses layers by name. */
function uniqueLayerName(editor: SvgEditor, name: string) {
  const names = new Set([...editor.getSvgContent().children].filter(isLayer).map(layerName))
  let unique = name
  for (let index = 2; names.has(unique); index++) unique = `${name} ${index}`
  return unique
}

const withoutPointerEvents = (element: Element) =>
  (element.getAttribute('style') ?? '')
    .replace(/(^|;)\s*pointer-events\s*:[^;]*/g, '')
    .replace(/^;+/, '')
    .trim() || null

/**
 * Moves elements to a new parent or stacking position as one undo step. Elements keep their
 * on-canvas position when the new parent has a different transform, as Illustrator does.
 * Like Illustrator's sublayers, a layer moved inside another layer or group becomes a group, and a
 * group moved between layers becomes a layer; other objects moved there get a layer of their own.
 */
export function moveElements(editor: SvgEditor, elements: Element[], target: DropTarget) {
  const {
    BatchCommand,
    MoveElementCommand,
    ChangeElementCommand,
    InsertElementCommand,
    RemoveElementCommand,
  } = editor.history as History
  const batch = new BatchCommand('Move in Layers')
  const content = editor.getSvgContent()
  const toTop = target.parent === content
  const current = editor.getCurrentDrawing().getCurrentLayer()
  let layersChanged = false
  editor.clearSelection()
  if (editor.getCurrentGroup()) editor.leaveContext()
  // Moved elements keep their stacking order relative to each other.
  const ordered = [...elements].sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  )
  for (const element of ordered) {
    if (element === target.before || element.contains(target.parent)) continue
    const oldParent = element.parentElement
    if (!oldParent) continue
    const wasLayer = isLayer(element)
    let parent = target.parent
    let before = target.before
    // Work out the compensating transform before touching the DOM, so a failure can't leave a half-done move.
    const transform =
      oldParent !== parent ? compensatingTransform(element, oldParent, parent) : null

    // Commands are ordered so that undo and redo never leave a group without layer markup at the
    // top level, where SVG-Edit would wrap it in a layer of its own.
    if (toTop && !wasLayer) {
      const named = objectName(element)
      const name = uniqueLayerName(editor, named.startsWith('<') ? nextLayerName(editor) : named)
      if (element.localName === 'g') {
        // The group becomes the layer. Recording its style lets undo drop the pointer-events
        // SVG-Edit sets on layers, which would otherwise leave it unclickable.
        const title = [...element.children].find((child) => child.localName === 'title')
        if (title) {
          const old = title.textContent
          title.textContent = name
          batch.addSubCommand(new ChangeElementCommand(title, { '#text': old }))
        } else {
          const created = document.createElementNS(SVG_NS, 'title')
          created.textContent = name
          element.prepend(created)
          batch.addSubCommand(new InsertElementCommand(created))
        }
        batch.addSubCommand(
          changeAttributes(
            editor,
            element,
            {
              class: [...new Set([...element.classList, 'layer'])].join(' '),
              'data-name': null,
              style: element.getAttribute('style'),
            },
            'Make Layer',
          ),
        )
      } else {
        // Other objects get a new layer, created where they were dropped.
        const layer = document.createElementNS(SVG_NS, 'g')
        layer.setAttribute('class', 'layer')
        const title = document.createElementNS(SVG_NS, 'title')
        title.textContent = name
        layer.append(title)
        content.insertBefore(layer, before)
        batch.addSubCommand(new InsertElementCommand(layer))
        parent = layer
        before = null
      }
      layersChanged = true
    }

    const oldNext = element.nextSibling
    parent.insertBefore(element, before)
    batch.addSubCommand(new MoveElementCommand(element, oldNext, oldParent))
    if (transform !== null) {
      const old = element.getAttribute('transform')
      if (transform) element.setAttribute('transform', transform)
      else element.removeAttribute('transform')
      batch.addSubCommand(new ChangeElementCommand(element, { transform: old }))
    }

    if (wasLayer) {
      layersChanged = true
      if (!toTop) {
        // The layer becomes a group named after it, without SVG-Edit's layer markup.
        const name = layerName(element)
        for (const title of [...element.children].filter((child) => child.localName === 'title')) {
          const next = title.nextSibling
          title.remove()
          batch.addSubCommand(new RemoveElementCommand(title, next, element))
        }
        const classes = [...element.classList].filter((item) => item !== 'layer').join(' ')
        batch.addSubCommand(
          changeAttributes(
            editor,
            element,
            {
              class: classes || null,
              'data-name': name || null,
              style: withoutPointerEvents(element),
            },
            'Make Group',
          ),
        )
      }
    }
  }
  if (batch.isEmpty()) return false
  editor.undoMgr.addCommandToHistory(batch)
  if (layersChanged) {
    // SVG-Edit caches its layers; re-read them and keep the same layer active, or the one that
    // now contains it.
    editor.identifyLayers()
    const active = current && (isLayer(current) ? current : layerOf(current))
    if (active) editor.setCurrentLayer(layerName(active))
  }
  return true
}

const ctm = (element: Element) => {
  // Screen matrices relate the document root (moves to the top level) to the groups inside it.
  const matrix = (element as SVGGraphicsElement).getScreenCTM?.()
  // The legacy SVGMatrix becomes a DOMMatrix, which supports isIdentity and mixes with other matrices.
  return matrix ? DOMMatrix.fromMatrix(matrix) : null
}

/**
 * The transform that keeps `element` in place when moved from `from` into `to`: null if the move
 * needs no change, or empty if the element needs no transform at all.
 */
function compensatingTransform(element: Element, from: Element, to: Element) {
  const source = ctm(from)
  const destination = ctm(to)
  if (!source || !destination) return null
  const delta = destination.inverse().multiply(source)
  // Screen matrices are single precision, so compare the rounded change.
  if (matrixValue(delta) === 'translate(0 0)') return null
  const local = (element as SVGGraphicsElement).transform?.baseVal.consolidate()?.matrix
  const value = matrixValue(delta.multiply(local ? DOMMatrix.fromMatrix(local) : new DOMMatrix()))
  // An empty value removes a transform the move cancels out, as when a nested layer moves back.
  return value === 'translate(0 0)' ? '' : value
}

/** Select artwork across layers; enter a group only when the whole selection shares it. */
export function selectInLayers(editor: SvgEditor, elements: Element[], additive: boolean) {
  if (elements.some(isBlocked)) return
  const candidates = new Set([
    ...(additive
      ? editor.getSelectedElements().filter((element): element is Element => !!element)
      : []),
    ...elements,
  ])
  // A selected group already includes its descendants; selecting both would edit them twice.
  const selection = [...candidates].filter((element) => {
    for (let parent = element.parentElement; parent; parent = parent.parentElement)
      if (candidates.has(parent)) return false
    return true
  })
  const first = selection[0]
  if (!first) {
    editor.clearSelection()
    return
  }
  const layer = layerOf(first)
  if (!layer) return
  // Context and layer changes clear the engine's selection, so restore the complete snapshot.
  if (editor.getCurrentGroup()) editor.leaveContext()
  if (editor.getCurrentDrawing().getCurrentLayer() !== layer)
    editor.setCurrentLayer(layerName(layer))
  const parent = first.parentElement
  if (parent && parent !== layer && selection.every((element) => element.parentElement === parent))
    editor.setContext(parent)
  editor.selectOnly(selection, true)
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Bounds of `elements` in the document's coordinates, including half the stroke width unless
 * `stroke` is false. (SVG-Edit's getStrokedBBox drops artwork that extends past the canvas.)
 */
export function artworkBounds(
  content: SVGSVGElement,
  elements: Element[],
  { stroke = true } = {},
): Bounds | null {
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
    const style = stroke ? getComputedStyle(element) : null
    const pad =
      style?.stroke && style.stroke !== 'none' ? (parseFloat(style.strokeWidth) || 0) / 2 : 0
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

/** The selected objects that move on their own, or null when any of them is locked or hidden. */
export function selectionRoots(editor: SvgEditor) {
  const selected = editor.getSelectedElements().filter((element): element is Element => !!element)
  if (!selected.length || selected.some(isBlocked)) return null
  // A selected ancestor already moves its descendants.
  return selected.filter(
    (element) => !selected.some((other) => other !== element && other.contains(element)),
  )
}

/** Centers the selection as a whole on the artboard, preserving spacing and transforms. */
export function centerSelectionOnArtboard(editor: SvgEditor) {
  const elements = selectionRoots(editor)
  if (!elements) return false
  const content = editor.getSvgContent()
  const matrix = content.getScreenCTM()
  const box = artworkBounds(content, elements)
  if (!matrix || !box) return false
  const dx = editor.contentW / 2 - (box.x + box.width / 2)
  const dy = editor.contentH / 2 - (box.y + box.height / 2)
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return false

  // Convert the document translation into each parent's coordinates before changing anything.
  const moves = elements.map((element) => {
    const parent = (element.parentNode as SVGGraphicsElement | null)?.getScreenCTM?.()
    if (!parent) return null
    const local = parent.inverse().multiply(matrix)
    const x = local.a * dx + local.c * dy
    const y = local.b * dx + local.d * dy
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    return { element, x, y, transform: element.getAttribute('transform') }
  })
  if (moves.some((move) => !move)) return false

  const { BatchCommand, ChangeElementCommand } = editor.history
  const batch = new BatchCommand('Center Selection on Artboard')
  for (const move of moves) {
    if (!move) continue
    const { element, x, y, transform } = move
    element.setAttribute('transform', `translate(${x} ${y})${transform ? ` ${transform}` : ''}`)
    batch.addSubCommand(new ChangeElementCommand(element, { transform }))
    editor.gettingSelectorManager().requestSelector(element).resize()
  }
  editor.undoMgr.addCommandToHistory(batch)
  return true
}

/** Screen matrices are single precision; this drops their noise from the values written. */
const round = (value: number) => Math.round(value * 1e5) / 1e5 || 0
/** Scale factors need more precision: they multiply coordinates up to 20000. */
const roundScale = (value: number) => Math.round(value * 1e7) / 1e7 || 0
/** A transform matrix as SVG, with rounded values. */
const matrixValue = ({ a, b, c, d, e, f }: DOMMatrixReadOnly) =>
  roundScale(a) === 1 && roundScale(b) === 0 && roundScale(c) === 0 && roundScale(d) === 1
    ? `translate(${round(e)} ${round(f)})`
    : `matrix(${[a, b, c, d].map(roundScale).join(' ')} ${round(e)} ${round(f)})`
const GEOMETRY = [
  'x',
  'y',
  'width',
  'height',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x1',
  'y1',
  'x2',
  'y2',
  'font-size',
]

/**
 * The unrotated size of an object whose only transform is a rotation, as SVG-Edit leaves objects
 * turned with its handle. Its W and H show this size, which the handles also resize.
 */
export function rotatedSize(element: Element) {
  if (!(element instanceof SVGGraphicsElement)) return null
  const list = element.transform.baseVal
  if (list.numberOfItems !== 1) return null
  const item = list.getItem(0)
  if (item.type !== SVGTransform.SVG_TRANSFORM_ROTATE || !item.angle) return null
  const { width, height } = element.getBBox()
  return { width, height }
}

interface ElementEdit {
  /** Maps document coordinates to the element's parent's. */
  toParent: DOMMatrix
  /**
   * Adds a transform and lets SVG-Edit fold it into the element's geometry where it can.
   * Prepending applies it in the parent's coordinates, appending in the element's own.
   */
  apply(added: string, at: 'start' | 'end'): void
  /** Moves the element by a distance in document coordinates. */
  translate(dx: number, dy: number): void
}

/**
 * Runs `edit` on each element as one undo step, recording every attribute it and SVG-Edit
 * rewrite. Returns false, changing nothing, when an element's coordinates cannot be resolved, and
 * also when nothing changed.
 */
export function editElements(
  editor: SvgEditor,
  label: string,
  elements: Element[],
  edit: (element: Element, tools: ElementEdit) => void,
) {
  const ctm = editor.getSvgContent().getScreenCTM()
  if (!ctm) return false
  const screen = DOMMatrix.fromMatrix(ctm)
  const matrices = elements.map((element) => {
    const parent = (element.parentNode as SVGGraphicsElement | null)?.getScreenCTM?.()
    const matrix = parent ? DOMMatrix.fromMatrix(parent).inverse().multiply(screen) : null
    return matrix &&
      [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].every(Number.isFinite)
      ? matrix
      : null
  })
  if (matrices.some((matrix) => !matrix)) return false

  const { BatchCommand, ChangeElementCommand } = editor.history
  const batch = new BatchCommand(label)
  for (const [index, element] of elements.entries()) {
    const toParent = matrices[index]!
    // SVG-Edit may rewrite descendants too, such as a text's tspans.
    const before = [element, ...element.querySelectorAll('*')].map((node) => ({
      node,
      values: new Map([...node.attributes].map(({ name, value }) => [name, value])),
    }))
    const transform = element.getAttribute('transform')
    const apply = (added: string, at: 'start' | 'end') => {
      const current = element.getAttribute('transform')
      element.setAttribute(
        'transform',
        !current ? added : at === 'start' ? `${added} ${current}` : `${current} ${added}`,
      )
      editor.recalculateDimensions(element)
      // Groups keep their transforms; fold them into one rather than adding a few per edit.
      const list = (element as SVGGraphicsElement).transform?.baseVal
      if (list?.numberOfItems > 1) {
        const items = Array.from({ length: list.numberOfItems }, (_, index) => list.getItem(index))
        if (items.every((item) => item.type !== SVGTransform.SVG_TRANSFORM_ROTATE)) {
          element.setAttribute('transform', matrixValue(list.consolidate()!.matrix))
        }
      }
      // SVG-Edit computes in single precision too: 80 × 0.50625 comes out as 40.49999713897705.
      for (const name of GEOMETRY) {
        const value = element.getAttribute(name)
        if (value !== null && value.trim() !== '' && Number.isFinite(Number(value)))
          element.setAttribute(name, String(round(Number(value))))
      }
    }
    const translate = (dx: number, dy: number) => {
      const { a, b, c, d } = toParent
      const x = round(a * dx + c * dy)
      const y = round(b * dx + d * dy)
      if (x || y) apply(`translate(${x} ${y})`, 'start')
    }

    edit(element, { toParent, apply, translate })

    for (const { node, values } of before) {
      const old: Record<string, string | null> = {}
      for (const name of new Set([...values.keys(), ...node.getAttributeNames()]))
        if ((values.get(name) ?? null) !== node.getAttribute(name))
          old[name] = values.get(name) ?? null
      if (!Object.keys(old).length) continue
      // Undo otherwise moves a rotation's center to match the restored geometry.
      if (node === element) old.transform = transform
      batch.addSubCommand(new ChangeElementCommand(node, old))
    }
  }
  if (batch.isEmpty()) return false
  // Edited objects may sit inside a selected group; only selected ones have handles.
  for (const element of editor.getSelectedElements())
    if (element) editor.gettingSelectorManager().requestSelector(element).resize()
  editor.undoMgr.addCommandToHistory(batch)
  return true
}

/**
 * Moves and scales the selection as a whole so its bounds (without strokes) become `next`, as one
 * undo step. A single rotated object is resized along its own axes instead (see `rotatedSize`),
 * keeping its bounds' corner in place. Shapes absorb the change into their geometry where SVG-Edit
 * can, as after dragging a handle; groups keep it as a transform. An axis with no extent, such as
 * a horizontal line's height, can only move.
 */
export function setSelectionBounds(editor: SvgEditor, next: Bounds) {
  const elements = selectionRoots(editor)
  if (!elements || ![next.x, next.y, next.width, next.height].every(Number.isFinite)) return false
  const content = editor.getSvgContent()
  const box = artworkBounds(content, elements, { stroke: false })
  if (!box) return false
  const rotated = elements.length === 1 ? rotatedSize(elements[0]) : null
  const size = rotated ?? box
  const sx = size.width > 0 ? roundScale(next.width / size.width) : 1
  const sy = size.height > 0 ? roundScale(next.height / size.height) : 1
  if (!(sx > 0 && sy > 0)) return false

  return editElements(
    editor,
    'Change Position and Size',
    elements,
    (element, { toParent, apply, translate }) => {
      const scaleAbout = (x: number, y: number, at: 'start' | 'end') => {
        if (sx !== 1 || sy !== 1)
          apply(`translate(${x} ${y}) scale(${sx} ${sy}) translate(${-x} ${-y})`, at)
      }
      if (rotated) {
        // Resize along the object's own axes, as its handles do.
        const local = (element as SVGGraphicsElement).getBBox()
        scaleAbout(round(local.x), round(local.y), 'end')
      } else if (Math.abs(toParent.b) < 1e-9 && Math.abs(toParent.c) < 1e-9) {
        // Move, then scale about the new corner: the forms SVG-Edit's own drag and resize
        // produce, which it folds into a shape's x, y, width, and height.
        translate(next.x - box.x, next.y - box.y)
        const corner = new DOMPoint(next.x, next.y).matrixTransform(toParent)
        scaleAbout(round(corner.x), round(corner.y), 'start')
      } else {
        // A rotated or skewed parent: apply the document-space change as one matrix.
        const change = new DOMMatrix()
          .translate(next.x, next.y)
          .scale(sx, sy)
          .translate(-box.x, -box.y)
        apply(matrixValue(toParent.multiply(change).multiply(toParent.inverse())), 'start')
      }
      if (elements.length === 1) {
        // Rotated objects and text change their corner as they resize (text scales about its
        // baseline). Put it back where it was asked to be; smaller differences are
        // single-precision noise in the measured bounds.
        const after = artworkBounds(content, [element], { stroke: false })
        if (after && Math.max(Math.abs(next.x - after.x), Math.abs(next.y - after.y)) > 1e-3)
          translate(next.x - after.x, next.y - after.y)
      }
    },
  )
}

export type Alignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

/**
 * Lines the selected objects up along one edge or center of their combined bounds, or a single
 * object with the artboard, as one undo step. Bounds exclude strokes, matching X, Y, W, and H.
 */
export function alignSelection(editor: SvgEditor, alignment: Alignment) {
  const roots = selectionRoots(editor)
  if (!roots) return false
  const content = editor.getSvgContent()
  const items = roots.flatMap((element) => {
    const box = artworkBounds(content, [element], { stroke: false })
    return box ? [{ element, box }] : []
  })
  if (!items.length) return false
  const target =
    roots.length === 1
      ? { x: 0, y: 0, width: editor.contentW, height: editor.contentH }
      : artworkBounds(content, roots, { stroke: false })
  if (!target) return false
  // How far along the axis each edge or center sits: 0 the start, 0.5 the middle, 1 the end.
  const along = { left: 0, center: 0.5, right: 1, top: 0, middle: 0.5, bottom: 1 }[alignment]
  const horizontal = alignment === 'left' || alignment === 'center' || alignment === 'right'
  const offsets = new Map(
    items.map(({ element, box }) => [
      element,
      horizontal
        ? target.x + target.width * along - (box.x + box.width * along)
        : target.y + target.height * along - (box.y + box.height * along),
    ]),
  )
  return editElements(
    editor,
    `Align ${alignment}`,
    items.map(({ element }) => element),
    (element, { translate }) => {
      const offset = offsets.get(element)!
      if (horizontal) translate(offset, 0)
      else translate(0, offset)
    },
  )
}

/**
 * Spaces three or more selected objects evenly along an axis, keeping the outermost edges in
 * place, as one undo step.
 */
export function distributeSelection(editor: SvgEditor, axis: 'horizontal' | 'vertical') {
  const roots = selectionRoots(editor)
  if (!roots) return false
  const content = editor.getSvgContent()
  const horizontal = axis === 'horizontal'
  const items = roots
    .flatMap((element) => {
      const box = artworkBounds(content, [element], { stroke: false })
      return box
        ? [
            {
              element,
              start: horizontal ? box.x : box.y,
              size: horizontal ? box.width : box.height,
            },
          ]
        : []
    })
    .sort((a, b) => a.start - b.start)
  if (items.length < 3) return false
  const start = items[0].start
  const end = Math.max(...items.map((item) => item.start + item.size))
  const gap =
    (end - start - items.reduce((total, item) => total + item.size, 0)) / (items.length - 1)
  const offsets = new Map<Element, number>()
  let position = start
  for (const item of items) {
    offsets.set(item.element, position - item.start)
    position += item.size + gap
  }
  return editElements(
    editor,
    `Distribute ${axis}ly`,
    items.map(({ element }) => element),
    (element, { translate }) => {
      const offset = offsets.get(element)!
      if (horizontal) translate(offset, 0)
      else translate(0, offset)
    },
  )
}

/** Rotates a single selected object about its center, to `angle` degrees. */
export function setSelectionRotation(editor: SvgEditor, angle: number) {
  const elements = selectionRoots(editor)
  if (elements?.length !== 1 || !Number.isFinite(angle)) return false
  editor.setRotationAngle(angle)
  return true
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
