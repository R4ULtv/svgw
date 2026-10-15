import type { EditablePath, SvgEditor } from './editor'
import { isBlocked, layerName, layerOf } from './layers'
import { deleteNodes, transformArc } from './path-nodes'
import { batchPathSegments } from './path-segment-batch'

export type PathAction = 'add' | 'delete' | 'line' | 'curve'
export interface PathEditingState {
  editing: boolean
  nodes: number
  canSplit: boolean
  canConvert: boolean
  /** The last click landed on artwork without editable nodes, such as a rectangle. */
  rejected: boolean
}

type Point = { x: number; y: number }
type NodePoint = Point & { index: number }
/** The engine's Segment class, which owns a node's grip and its selected-segment outline. */
interface EngineSegment {
  type: number
  item: Record<string, number | boolean>
  prev?: EngineSegment
  segsel?: Element | null
  path: EditablePath
  update(full?: boolean): void
  addGrip(): void
}

/** Screen-space point containment works in either drag direction, at any canvas transform. */
export function nodesInMarquee(
  nodes: NodePoint[],
  start: Point,
  end: Point,
  previous: number[] = [],
) {
  const selected = new Set(previous)
  for (const node of nodes)
    if (
      node.x >= Math.min(start.x, end.x) &&
      node.x <= Math.max(start.x, end.x) &&
      node.y >= Math.min(start.y, end.y) &&
      node.y <= Math.max(start.y, end.y)
    )
      selected.add(node.index)
  return [...selected].sort((a, b) => a - b)
}

/** Expose SVG-Edit's node editor as a persistent, direct-selection tool. */
export function installPathEditing(editor: SvgEditor, refresh: () => void) {
  let active = false
  let target: Element | null = null
  let consumedPress = false
  let rejected = false
  const surface = editor.getContainer()
  const getPath = editor.getPath_
  const pointFromGrip = editor.getPointFromGrip
  const recalcRotatedPath = editor.recalcRotatedPath
  const getSvgString = editor.getSvgString
  const patched = new Map<
    EditablePath,
    { update: EditablePath['update']; movePts: EditablePath['movePts'] }
  >()
  let marquee: {
    path: EditablePath
    start: Point
    nodes: NodePoint[]
    previous: number[]
    box: SVGRectElement | null
  } | null = null

  function cancelMarquee() {
    marquee?.box?.remove()
    marquee = null
  }

  function selectNodes(path: EditablePath, indices: number[]) {
    if (
      path.selected_pts.length === indices.length &&
      indices.every((index, i) => path.selected_pts[i] === index)
    )
      return
    path.clearSelection()
    if (indices.length) path.addPtsToSelection(indices)
    refresh()
  }

  function startMarquee(event: MouseEvent) {
    const path = editor.getPathObj()!
    const matrix = editor
      .getSvgRoot()
      .querySelector<SVGGraphicsElement>('#pathpointgrip_container')
      ?.getScreenCTM()
    if (!matrix) return
    const nodes: NodePoint[] = []
    path.segs.forEach((segment, index) => {
      const grip = segment.ptgrip
      if (!grip || grip.getAttribute('display') === 'none') return
      const point = new DOMPoint(
        Number(grip.getAttribute('cx')),
        Number(grip.getAttribute('cy')),
      ).matrixTransform(matrix)
      nodes.push({ index, x: point.x, y: point.y })
    })
    marquee = {
      path,
      start: { x: event.clientX, y: event.clientY },
      nodes,
      previous: event.shiftKey ? [...path.selected_pts] : [],
      box: null,
    }
    selectNodes(path, marquee.previous)
  }

  function updateMarquee(event: MouseEvent) {
    const gesture = marquee
    if (!gesture) return
    if (editor.getMode() !== 'pathedit' || editor.getPathObj() !== gesture.path) {
      cancelMarquee()
      return
    }
    const end = { x: event.clientX, y: event.clientY }
    if (!gesture.box && Math.hypot(end.x - gesture.start.x, end.y - gesture.start.y) < 3) return
    const root = editor.getSvgRoot()
    const matrix = root.getScreenCTM()?.inverse()
    if (!matrix) return
    if (!gesture.box) {
      gesture.box = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      gesture.box.id = 'svgw-node-marquee'
      gesture.box.setAttribute('pointer-events', 'none')
      root.append(gesture.box)
    }
    const first = new DOMPoint(gesture.start.x, gesture.start.y).matrixTransform(matrix)
    const last = new DOMPoint(end.x, end.y).matrixTransform(matrix)
    for (const [name, value] of Object.entries({
      x: Math.min(first.x, last.x),
      y: Math.min(first.y, last.y),
      width: Math.abs(first.x - last.x),
      height: Math.abs(first.y - last.y),
    }))
      gesture.box.setAttribute(name, String(value))
    selectNodes(gesture.path, nodesInMarquee(gesture.nodes, gesture.start, end, gesture.previous))
  }

  // The engine's outline maps an arc's radii, rotation and flags through the grip transform as
  // though they were points, turning small rounded corners into huge loops. Redraw it instead.
  function outlineArc(segment: EngineSegment) {
    const { item, prev, segsel, path } = segment
    if (segment.type !== 10 || !prev || !segsel) return
    const zoom = editor.getZoom()
    const m = path.matrix ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
    const grip = ({ x, y }: Record<string, number | boolean>) => [
      (m.a * Number(x) + m.c * Number(y) + m.e) * zoom,
      (m.b * Number(x) + m.d * Number(y) + m.f) * zoom,
    ]
    const arc = transformArc(
      {
        r1: Number(item.r1),
        r2: Number(item.r2),
        angle: Number(item.angle),
        sweep: !!item.sweepFlag,
      },
      { a: m.a * zoom, b: m.b * zoom, c: m.c * zoom, d: m.d * zoom },
    )
    segsel.setAttribute(
      'd',
      `M${grip(prev.item)} A${arc.r1},${arc.r2} ${arc.angle} ${item.largeArcFlag ? 1 : 0} ${arc.sweep ? 1 : 0} ${grip(item)}`,
    )
  }
  let segmentClass: Pick<EngineSegment, 'update' | 'addGrip'> | null = null
  let segmentMethods: Pick<EngineSegment, 'update' | 'addGrip'> | null = null
  function patchSegments(path: EditablePath) {
    const segment: unknown = path.segs[0] && Object.getPrototypeOf(path.segs[0])
    if (segmentClass || !segment || typeof (segment as EngineSegment).addGrip !== 'function') return
    segmentClass = segment as EngineSegment
    const { update, addGrip } = segmentClass
    segmentMethods = { update, addGrip }
    segmentClass.update = function (this: EngineSegment, full) {
      update.call(this, full)
      outlineArc(this)
    }
    segmentClass.addGrip = function (this: EngineSegment) {
      addGrip.call(this)
      outlineArc(this)
    }
  }

  // The engine positions nodes using only rotate(), ignoring ancestor and matrix transforms.
  // Work in document coordinates, preserve the SVG's transforms, and invert the full matrix
  // after removing zoom when mapping a drag back into path coordinates.
  editor.getPath_ = (element) => {
    const path = getPath.call(editor, element)
    patchSegments(path)
    if (!patched.has(path)) {
      const update = path.update
      const movePts = path.movePts
      patched.set(path, { update, movePts })
      path.movePts = (dx, dy) => batchPathSegments(path.elem, () => movePts.call(path, dx, dy))
      path.update = () => {
        update.call(path)
        if (editor.getMode() === 'pathedit') {
          const content = editor.getSvgContent().getScreenCTM()
          const screen = path.elem.getScreenCTM()
          if (content && screen) {
            path.matrix = content.inverse().multiply(screen)
            path.imatrix = path.matrix.inverse()
            for (const segment of path.segs) segment.update()
          }
        }
        return path
      }
    }
    return path
  }
  editor.getPointFromGrip = (point, path) => {
    if (editor.getMode() !== 'pathedit') return pointFromGrip.call(editor, point, path)
    const local = new DOMPoint(point.x / editor.getZoom(), point.y / editor.getZoom())
    return path.imatrix ? local.matrixTransform(path.imatrix) : local
  }
  editor.recalcRotatedPath = () => {
    // Keeping the original transform also keeps undo/redo confined to the path's d attribute.
    if (!patched.has(editor.getPathObj()!)) recalcRotatedPath.call(editor)
  }
  editor.getSvgString = () => {
    if (editor.getMode() !== 'pathedit') return getSvgString.call(editor)
    // SVG-Edit's serializer clears path editing. Autosave and export must leave an ongoing
    // node gesture and its selection intact; the grips live outside the serialized content.
    const clear = editor.pathActions.clear
    editor.pathActions.clear = () => {}
    try {
      return getSvgString.call(editor)
    } finally {
      editor.pathActions.clear = clear
    }
  }

  function end(keepSelection = false) {
    cancelMarquee()
    const previous = target
    if (editor.getMode() === 'pathedit') editor.pathActions.toSelectMode()
    target = null
    if (keepSelection && previous?.isConnected && !isBlocked(previous))
      editor.selectOnly([previous], true)
  }

  function edit(element: Element) {
    const data = element.getAttribute('d') ?? ''
    // A move-only SVG path has no segments; SVG-Edit cannot construct its node model.
    if (element.localName !== 'path' || isBlocked(element) || !/[lhvcsqta]/i.test(data)) return
    end()
    editor.setMode('select')
    editor.leaveContext()
    const layer = layerOf(element)
    if (layer) editor.setCurrentLayer(layerName(layer))
    // Initialize the engine's path selection before exposing its node grips.
    editor.selectOnly([element], true)
    editor.pathActions.toEditMode(element)
    // The engine pre-selects an arbitrary node; Delete and arrow keys must wait for a choice.
    editor.getPathObj()?.clearSelection()
    target = element
    refresh()
  }

  const press = (event: MouseEvent) => {
    if (!active || event.button !== 0 || !(event.target instanceof Element)) return
    const element = event.target
    if (element.closest('#pathpointgrip_container')) return
    consumedPress = true
    event.preventDefault()
    event.stopImmediatePropagation()
    const artwork = editor.getSvgContent().contains(element) && !element.classList.contains('layer')
    rejected = artwork && element.localName !== 'path'
    if (editor.getMode() === 'pathedit' && (element.localName !== 'path' || element === target))
      startMarquee(event)
    else if (element.localName === 'path' && artwork) edit(element)
    else end()
    refresh()
  }
  const move = (event: MouseEvent) => {
    if (!marquee) return
    event.preventDefault()
    event.stopImmediatePropagation()
    updateMarquee(event)
  }
  const release = (event: MouseEvent) => {
    if (!consumedPress) return
    consumedPress = false
    event.stopImmediatePropagation()
    updateMarquee(event)
    cancelMarquee()
    refresh()
  }
  // Capture before the engine: clicking a path enters edit mode without moving the object.
  surface.addEventListener('mousedown', press, true)
  surface.addEventListener('mousemove', move, true)
  surface.addEventListener('mouseup', release, true)
  const view = surface.ownerDocument?.defaultView
  view?.addEventListener('blur', cancelMarquee)

  function sync(): PathEditingState {
    const editing = editor.getMode() === 'pathedit'
    if (editing) {
      active = true
      target = editor.getPathObj()?.elem ?? null
    }
    if (target && (!target.isConnected || isBlocked(target))) end()
    // A layer-panel selection can replace the target while this tool is active.
    const selected = editor.getSelectedElements().filter((item): item is Element => !!item)
    if (active && selected.length === 1 && selected[0].localName === 'path') edit(selected[0])
    else if (active && selected.length && selected[0].localName !== 'path') {
      // Choosing another kind of object in Layers returns to its normal object controls.
      active = false
      end()
      editor.selectOnly(selected, true)
    }
    const path = editor.getMode() === 'pathedit' ? editor.getPathObj() : null
    const indices = path?.selected_pts ?? []
    const segments = indices.map((index) => path!.segs[index])
    return {
      editing: Boolean(path),
      nodes: indices.length,
      canSplit:
        segments.length > 0 && segments.every((seg) => seg?.prev && [4, 6].includes(seg.type)),
      canConvert: segments.length > 0 && segments.every((seg) => seg?.prev),
      rejected: active && !path && rejected,
    }
  }

  return {
    sync,
    isActive: () => active,
    activate() {
      const selected = editor.getSelectedElements().filter((item): item is Element => !!item)
      active = true
      // Groups may still contain paths, which the next click can reach.
      rejected =
        selected.length > 0 &&
        selected.every((element) => !['path', 'g'].includes(element.localName))
      if (selected.length === 1 && selected[0].localName === 'path') edit(selected[0])
      else if (editor.getMode() !== 'pathedit') {
        editor.setMode('select')
        editor.clearSelection()
      }
      refresh()
    },
    deactivate(keepSelection = false) {
      active = false
      rejected = false
      end(keepSelection)
    },
    action(action: PathAction) {
      const state = sync()
      if (!state.editing || !state.nodes) return
      editor.getPathObj()!.selected_pts.sort((a, b) => a - b)
      if (action === 'add' && state.canSplit) editor.pathActions.clonePathNode()
      if (action === 'line' && state.canConvert) editor.pathActions.setSegType(4)
      if (action === 'curve' && state.canConvert) editor.pathActions.setSegType(6)
      if (action === 'delete') {
        const path = editor.getPathObj()!
        // The engine deletes nodes one at a time through stale neighbor references, which
        // corrupts the next subpath when a whole open subpath goes. Rebuild the data instead.
        const data = deleteNodes(path.segs, path.selected_pts)
        const visible = path.segs.filter((seg) => seg.ptgrip)
        // The engine's final-node deletion calls a nonexistent canvas.canvas method.
        if (data === '' || (data === null && state.nodes >= visible.length - 1)) {
          const element = path.elem
          end()
          editor.selectOnly([element], true)
          editor.deleteSelectedElements()
        } else if (data === null) editor.pathActions.deletePathNode()
        else {
          path.storeD()
          path.elem.setAttribute('d', data)
          path.init().clearSelection()
          path.endChanges('Delete path node(s)')
        }
      }
      refresh()
    },
    nudge(dx: number, dy: number) {
      const state = sync()
      if (!state.editing || !state.nodes) return
      const path = editor.getPathObj()!
      const matrix = path.imatrix
      path.storeD()
      path.movePts(
        matrix ? matrix.a * dx + matrix.c * dy : dx,
        matrix ? matrix.b * dx + matrix.d * dy : dy,
      )
      path.endChanges('Move path nodes')
      refresh()
    },
    dispose() {
      cancelMarquee()
      surface.removeEventListener('mousedown', press, true)
      surface.removeEventListener('mousemove', move, true)
      surface.removeEventListener('mouseup', release, true)
      view?.removeEventListener('blur', cancelMarquee)
      editor.getPath_ = getPath
      editor.getPointFromGrip = pointFromGrip
      editor.recalcRotatedPath = recalcRotatedPath
      editor.getSvgString = getSvgString
      for (const [path, original] of patched) {
        path.update = original.update
        path.movePts = original.movePts
      }
      if (segmentClass && segmentMethods) Object.assign(segmentClass, segmentMethods)
    },
  }
}
