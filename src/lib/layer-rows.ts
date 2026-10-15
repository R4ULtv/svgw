import { isBlocked, type LayerNode } from './layers'

export const LAYER_ROW_HEIGHT = 32
export interface LayerRow {
  node: LayerNode
  depth: number
  hiddenAbove: boolean
  lockedAbove: boolean
  position: number
  siblings: number
}

function hasVisibleArtwork(node: LayerNode): boolean {
  if (node.hidden) return false
  return node.kind === 'object' || node.children.some(hasVisibleArtwork)
}

/** Only layers containing visible artwork open automatically; manual choices take precedence. */
export function isLayerExpanded(node: LayerNode, expansion: ReadonlyMap<string, boolean>) {
  return expansion.get(node.key) ?? (node.kind === 'layer' && hasVisibleArtwork(node))
}

/** Flatten only expanded branches, retaining the hierarchy for indentation and ARIA. */
export function layerRows(tree: LayerNode[], expansion: ReadonlyMap<string, boolean>) {
  const rows: LayerRow[] = []
  function visit(nodes: LayerNode[], depth: number, hiddenAbove: boolean, lockedAbove: boolean) {
    nodes.forEach((node, index) => {
      rows.push({
        node,
        depth,
        hiddenAbove,
        lockedAbove,
        position: index + 1,
        siblings: nodes.length,
      })
      if (isLayerExpanded(node, expansion))
        visit(node.children, depth + 1, hiddenAbove || node.hidden, lockedAbove || node.locked)
    })
  }
  visit(tree, 0, false, false)
  return rows
}

/**
 * Select artwork in panel order, including unmounted rows but excluding collapsed branches.
 * A layer stands for its artwork at either end of the range or while collapsed; an expanded
 * layer's own rows follow it.
 */
export function layerSelectionRange(rows: LayerRow[], anchor: Element | null, target: Element) {
  const end = rows.findIndex((row) => row.node.element === target)
  if (end < 0) return []
  const start = rows.findIndex((row) => row.node.element === anchor)
  const first = Math.min(start < 0 ? end : start, end)
  const elements = rows
    .slice(first, Math.max(start, end) + 1)
    .flatMap(({ node, depth }, offset) => {
      const index = first + offset
      if (isBlocked(node.element)) return []
      if (node.kind !== 'layer') return [node.element]
      const collapsed = !(rows[index + 1]?.depth > depth)
      return index === start || index === end || collapsed
        ? node.children.filter((child) => !isBlocked(child.element)).map((child) => child.element)
        : []
    })
  return [...new Set(elements)]
}

/** A bounded number of mounted rows, regardless of document size. */
export function layerRowWindow(count: number, scrollTop: number, height: number) {
  if (count <= 80) return { start: 0, end: count }
  const overscan = 8
  const visible = Math.ceil(Math.max(1, height) / LAYER_ROW_HEIGHT)
  const first = Math.min(
    Math.max(0, count - visible),
    Math.floor(Math.max(0, scrollTop) / LAYER_ROW_HEIGHT),
  )
  return { start: Math.max(0, first - overscan), end: Math.min(count, first + visible + overscan) }
}
